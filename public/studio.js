const KINDS = ["tree", "bench", "rock", "lamp", "house", "cloud"];
const ACTIONS = ["idle", "walk", "wave", "talk", "look"];
const CAMERAS = ["wide", "close", "follow", "overhead"];

const libraryEl = document.querySelector("#library");
const scriptEl = document.querySelector("#script");
const picker = document.querySelector("#script-picker");
const logEl = document.querySelector("#log");
const player = document.querySelector("#player");
const preview = document.querySelector("#preview");

let library = null;
let script = null;
let voices = [];

const slug = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "item";

function uniqueId(list, base) {
  let id = slug(base);
  let n = 2;
  while (list.some((item) => item.id === id)) {
    id = `${slug(base).slice(0, 60)}-${n}`;
    n += 1;
  }
  return id;
}

function setPath(root, path, value) {
  const parts = path.split(".");
  let cursor = root;
  for (let i = 0; i < parts.length - 1; i += 1) cursor = cursor[parts[i]];
  cursor[parts.at(-1)] = value;
}

function getPath(root, path) {
  return path.split(".").reduce((cursor, part) => cursor?.[part], root);
}

function field(path, label, value, type = "text") {
  const inputType = type === "number" ? "number" : type;
  const extra = type === "number" ? 'step="0.1"' : "";
  return `<label>${label}<input data-path="${path}" type="${inputType}" ${extra} value="${escapeAttr(value)}"></label>`;
}

function select(path, label, value, options) {
  const choices = options
    .map((option) => {
      const id = option.id || option;
      const name = option.name || option;
      return `<option value="${escapeAttr(id)}" ${id === value ? "selected" : ""}>${escapeHtml(name)}</option>`;
    })
    .join("");
  return `<label>${label}<select data-path="${path}">${choices}</select></label>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}
const escapeAttr = escapeHtml;

function log(message) {
  logEl.textContent = message;
}

async function api(url, options) {
  const response = await fetch(url, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || response.statusText);
  return body;
}

function renderLibrary() {
  const voiceOptions = voices.length
    ? voices
    : [{ id: "Samantha", name: "Samantha" }];
  const componentOptions = library.components.map((item) => ({ id: item.id, name: item.name }));
  libraryEl.innerHTML = `
    <h3>Characters</h3>
    ${library.characters.map((character, index) => `
      <article class="card">
        <div class="card-head"><strong>${escapeHtml(character.name || "Character")}</strong>
          <button type="button" class="danger" data-remove="characters.${index}">Remove</button></div>
        <div class="grid">
          ${field(`characters.${index}.id`, "Id", character.id)}
          ${field(`characters.${index}.name`, "Name", character.name)}
          ${field(`characters.${index}.body`, "Body", character.body, "color")}
          ${field(`characters.${index}.accent`, "Hair and legs", character.accent, "color")}
          ${select(`characters.${index}.voice`, "Voice", character.voice, voiceOptions.map((voice) => ({ id: voice.name || voice.id, name: voice.lang ? `${voice.name} (${voice.lang})` : voice.name })))}
          ${field(`characters.${index}.scale`, "Scale", character.scale, "number")}
        </div>
      </article>`).join("")}
    <button type="button" data-add="character">Add character</button>

    <h3 style="margin-top:18px">Components</h3>
    ${library.components.map((component, index) => `
      <article class="card">
        <div class="card-head"><strong>${escapeHtml(component.name || "Component")}</strong>
          <button type="button" class="danger" data-remove="components.${index}">Remove</button></div>
        <div class="grid">
          ${field(`components.${index}.id`, "Id", component.id)}
          ${field(`components.${index}.name`, "Name", component.name)}
          ${select(`components.${index}.kind`, "Kind", component.kind, KINDS)}
          ${field(`components.${index}.color`, "Color", component.color, "color")}
          ${field(`components.${index}.accent`, "Accent", component.accent, "color")}
        </div>
      </article>`).join("")}
    <button type="button" data-add="component">Add component</button>

    <h3 style="margin-top:18px">Backgrounds</h3>
    ${library.backgrounds.map((background, index) => `
      <article class="card">
        <div class="card-head"><strong>${escapeHtml(background.name || "Background")}</strong>
          <button type="button" class="danger" data-remove="backgrounds.${index}">Remove</button></div>
        <div class="grid">
          ${field(`backgrounds.${index}.id`, "Id", background.id)}
          ${field(`backgrounds.${index}.name`, "Name", background.name)}
          ${field(`backgrounds.${index}.sky`, "Sky", background.sky, "color")}
          ${field(`backgrounds.${index}.ground`, "Ground", background.ground, "color")}
          ${field(`backgrounds.${index}.horizon`, "Fog color", background.horizon, "color")}
          ${field(`backgrounds.${index}.fog`, "Fog amount", background.fog, "number")}
        </div>
        ${(background.components || []).map((place, placeIndex) => `
          <div class="place">
            ${select(`backgrounds.${index}.components.${placeIndex}.componentId`, "Component", place.componentId, componentOptions)}
            ${field(`backgrounds.${index}.components.${placeIndex}.x`, "X", place.x, "number")}
            ${field(`backgrounds.${index}.components.${placeIndex}.z`, "Z", place.z, "number")}
            ${field(`backgrounds.${index}.components.${placeIndex}.scale`, "Scale", place.scale, "number")}
            <button type="button" class="danger" data-remove="backgrounds.${index}.components.${placeIndex}">Remove</button>
          </div>`).join("")}
        <button type="button" data-add="placement" data-index="${index}">Add piece to this background</button>
      </article>`).join("")}
    <button type="button" data-add="background">Add background</button>
  `;
}

function renderScript() {
  const characters = library.characters.map((item) => ({ id: item.id, name: item.name }));
  const backgrounds = library.backgrounds.map((item) => ({ id: item.id, name: item.name }));
  scriptEl.innerHTML = `
    <div class="grid">
      ${field("title", "Title", script.title)}
      <label>Frames per second<input data-path="fps" type="number" value="${script.fps || 12}"></label>
    </div>
    ${script.scenes.map((scene, sceneIndex) => `
      <article class="card">
        <div class="card-head"><strong>Scene ${sceneIndex + 1}</strong>
          <button type="button" class="danger" data-remove="scenes.${sceneIndex}">Remove scene</button></div>
        ${select(`scenes.${sceneIndex}.backgroundId`, "Background", scene.backgroundId, backgrounds)}
        ${scene.lines.map((line, lineIndex) => `
          <div class="card">
            <div class="card-head"><span>Line ${lineIndex + 1}</span>
              <button type="button" class="danger" data-remove="scenes.${sceneIndex}.lines.${lineIndex}">Remove line</button></div>
            <div class="grid">
              ${select(`scenes.${sceneIndex}.lines.${lineIndex}.characterId`, "Character", line.characterId, characters)}
              ${select(`scenes.${sceneIndex}.lines.${lineIndex}.action`, "Action", line.action, ACTIONS)}
              ${select(`scenes.${sceneIndex}.lines.${lineIndex}.camera`, "Camera", line.camera, CAMERAS)}
            </div>
            ${field(`scenes.${sceneIndex}.lines.${lineIndex}.text`, "Spoken line", line.text)}
          </div>`).join("")}
        <button type="button" data-add="line" data-index="${sceneIndex}">Add line</button>
      </article>`).join("")}
    <button type="button" data-add="scene">Add scene</button>
  `;
}

async function loadPicker(selectId) {
  const scripts = await api("/api/scripts");
  picker.innerHTML = scripts
    .map((item) => `<option value="${escapeAttr(item.id)}">${escapeHtml(item.title)}</option>`)
    .join("");
  picker.value = selectId || scripts[0]?.id || "";
}

libraryEl.addEventListener("input", (event) => {
  const path = event.target.dataset.path;
  if (!path) return;
  const value = event.target.type === "number" ? Number(event.target.value) : event.target.value;
  setPath(library, path, value);
});
libraryEl.addEventListener("change", (event) => {
  if (event.target.tagName === "SELECT") {
    setPath(library, event.target.dataset.path, event.target.value);
  }
});
libraryEl.addEventListener("click", (event) => {
  const remove = event.target.dataset.remove;
  const add = event.target.dataset.add;
  if (remove) {
    const parts = remove.split(".");
    const index = Number(parts.pop());
    let list = library;
    for (const part of parts) list = list[part];
    list.splice(index, 1);
    renderLibrary();
  }
  if (add === "character") {
    library.characters.push({
      id: uniqueId(library.characters, "character"),
      name: "New character",
      body: "#d98b5f",
      accent: "#2a211c",
      voice: voices[0]?.name || "Samantha",
      scale: 1,
    });
    renderLibrary();
  }
  if (add === "component") {
    library.components.push({
      id: uniqueId(library.components, "prop"),
      name: "New prop",
      kind: "tree",
      color: "#2f6b3a",
      accent: "#6b4226",
    });
    renderLibrary();
  }
  if (add === "background") {
    library.backgrounds.push({
      id: uniqueId(library.backgrounds, "place"),
      name: "New background",
      sky: "#9ec9ef",
      ground: "#7daa55",
      horizon: "#d5ecf5",
      fog: 0.2,
      components: [],
    });
    renderLibrary();
  }
  if (add === "placement") {
    const background = library.backgrounds[Number(event.target.dataset.index)];
    background.components.push({
      componentId: library.components[0]?.id || "",
      x: 0,
      z: -2,
      scale: 1,
    });
    renderLibrary();
  }
});

scriptEl.addEventListener("input", (event) => {
  if (!event.target.dataset.path) return;
  const value = event.target.type === "number" ? Number(event.target.value) : event.target.value;
  setPath(script, event.target.dataset.path, value);
});
scriptEl.addEventListener("change", (event) => {
  if (event.target.tagName === "SELECT") setPath(script, event.target.dataset.path, event.target.value);
});
scriptEl.addEventListener("click", (event) => {
  const remove = event.target.dataset.remove;
  const add = event.target.dataset.add;
  if (remove) {
    const parts = remove.split(".");
    const index = Number(parts.pop());
    let list = script;
    for (const part of parts) list = list[part];
    list.splice(index, 1);
    renderScript();
  }
  if (add === "scene") {
    script.scenes.push({
      backgroundId: library.backgrounds[0]?.id || "",
      lines: [blankLine()],
    });
    renderScript();
  }
  if (add === "line") {
    script.scenes[Number(event.target.dataset.index)].lines.push(blankLine());
    renderScript();
  }
});

function blankLine() {
  return {
    characterId: library.characters[0]?.id || "",
    action: "talk",
    camera: "wide",
    text: "",
  };
}

picker.addEventListener("change", () => openScript(picker.value));

document.querySelector("#save-library").addEventListener("click", async () => {
  try {
    library = await api("/api/library", { method: "PUT", body: JSON.stringify(library) });
    log("Library saved. Backgrounds and components stay available for every script.");
    renderLibrary();
    renderScript();
  } catch (error) {
    log(error.message);
  }
});

document.querySelector("#save-script").addEventListener("click", () => saveCurrent());
document.querySelector("#new-script").addEventListener("click", async () => {
  const title = `Film ${picker.options.length + 1}`;
  const id = uniqueId(
    [...picker.options].map((option) => ({ id: option.value })),
    title,
  );
  script = {
    id,
    title,
    fps: 12,
    width: 1280,
    height: 720,
    scenes: [{ backgroundId: library.backgrounds[0]?.id || "", lines: [blankLine()] }],
  };
  await saveCurrent();
});

document.querySelector("#generate").addEventListener("click", () => runGenerate(false));
document.querySelector("#render").addEventListener("click", () => runGenerate(true));

async function saveCurrent() {
  script = await api(`/api/scripts/${script.id}`, { method: "PUT", body: JSON.stringify(script) });
  await loadPicker(script.id);
  log(`Saved “${script.title}”.`);
  return script;
}

async function openScript(id) {
  script = await api(`/api/scripts/${id}`);
  renderScript();
  showFilm(id);
}

function showFilm(id) {
  preview.src = `/preview.html?film=${encodeURIComponent(id)}&v=${Date.now()}`;
}

async function runGenerate(renderVideo) {
  const buttons = [...document.querySelectorAll("button")];
  buttons.forEach((button) => {
    button.disabled = true;
  });
  log(renderVideo ? "Saving, speaking, and rendering frames…" : "Saving, speaking, and writing scene code…");
  player.hidden = true;
  try {
    await saveCurrent();
    const result = await api("/api/generate", {
      method: "POST",
      body: JSON.stringify({ id: script.id, render: renderVideo }),
    });
    showFilm(script.id);
    const lines = [
      `Generated “${result.title}” (${result.duration}s).`,
      `Scene code: ${result.scene}`,
      `Voice: ${result.voice}`,
    ];
    if (result.video) {
      lines.push(`Video: ${result.video}`);
      player.hidden = false;
      player.src = `${result.video}?v=${Date.now()}`;
    }
    log(lines.join("\n"));
  } catch (error) {
    log(error.message);
  } finally {
    buttons.forEach((button) => {
      button.disabled = false;
    });
  }
}

const statusPromise = api("/api/status");
const voicesPromise = api("/api/voices");
library = await api("/api/library");
await loadPicker("morning");
renderLibrary();
await openScript(picker.value || "morning");

const status = await statusPromise;
document.querySelector("#tool-status").textContent = [
  status.ffmpeg ? "ffmpeg ready" : "ffmpeg missing",
  status.chrome ? "Chrome ready" : "Chrome missing",
].join(" · ");
voices = await voicesPromise;
for (const select of document.querySelectorAll("select[data-path$='.voice']")) {
  const saved = getPath(library, select.dataset.path);
  select.innerHTML = voices
    .map((voice) => `<option value="${escapeAttr(voice.name)}">${escapeHtml(`${voice.name} (${voice.lang})`)}</option>`)
    .join("");
  if (saved) select.value = saved;
}
