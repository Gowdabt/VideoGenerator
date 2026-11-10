import fs from "node:fs";
import path from "node:path";

export const root = path.resolve(import.meta.dirname, "..");
export const dataDir = path.join(root, "data");
export const libraryPath = path.join(dataDir, "library.json");
export const scriptsDir = path.join(dataDir, "scripts");
export const filmsDir = path.join(dataDir, "films");

export function safeId(id) {
  const value = String(id || "").trim();
  if (!/^[a-z0-9-]{1,64}$/.test(value)) {
    throw new Error("Ids use lowercase letters, numbers, and hyphens (max 64).");
  }
  return value;
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

export function loadLibrary() {
  return readJson(libraryPath);
}

export function saveLibrary(library) {
  validateLibrary(library);
  writeJson(libraryPath, library);
  return library;
}

export function listScripts() {
  if (!fs.existsSync(scriptsDir)) return [];
  return fs
    .readdirSync(scriptsDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => readJson(path.join(scriptsDir, name)))
    .map((script) => ({ id: script.id, title: script.title }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function readScript(id) {
  const file = path.join(scriptsDir, `${safeId(id)}.json`);
  if (!fs.existsSync(file)) throw new Error(`No script named ${id}.`);
  return readJson(file);
}

export function saveScript(script) {
  const library = loadLibrary();
  validateScript(script, library);
  writeJson(path.join(scriptsDir, `${script.id}.json`), script);
  return script;
}

function uniqueIds(items, label) {
  const seen = new Set();
  for (const item of items) {
    safeId(item.id);
    if (seen.has(item.id)) throw new Error(`Duplicate ${label} id "${item.id}".`);
    seen.add(item.id);
  }
}

export function validateLibrary(library) {
  if (!library || !Array.isArray(library.characters) || !Array.isArray(library.components) || !Array.isArray(library.backgrounds)) {
    throw new Error("Library needs characters, components, and backgrounds.");
  }
  uniqueIds(library.characters, "character");
  uniqueIds(library.components, "component");
  uniqueIds(library.backgrounds, "background");
  const componentIds = new Set(library.components.map((item) => item.id));
  for (const component of library.components) {
    if (!["tree", "bench", "rock", "lamp", "house", "cloud"].includes(component.kind)) {
      throw new Error(`Unknown component kind "${component.kind}".`);
    }
  }
  for (const background of library.backgrounds) {
    for (const place of background.components || []) {
      if (!componentIds.has(place.componentId)) {
        throw new Error(`Background "${background.name}" uses missing component "${place.componentId}".`);
      }
    }
  }
}

export function validateScript(script, library) {
  safeId(script.id);
  if (!script.title?.trim()) throw new Error("Script needs a title.");
  if (!Array.isArray(script.scenes) || script.scenes.length === 0) {
    throw new Error("Script needs at least one scene.");
  }
  const characters = new Set(library.characters.map((item) => item.id));
  const backgrounds = new Set(library.backgrounds.map((item) => item.id));
  for (const scene of script.scenes) {
    if (!backgrounds.has(scene.backgroundId)) {
      throw new Error(`Scene uses missing background "${scene.backgroundId}".`);
    }
    if (!Array.isArray(scene.lines) || scene.lines.length === 0) {
      throw new Error("Every scene needs a line.");
    }
    for (const line of scene.lines) {
      if (!characters.has(line.characterId)) {
        throw new Error(`Line uses missing character "${line.characterId}".`);
      }
      if (!["idle", "walk", "wave", "talk", "look"].includes(line.action)) {
        throw new Error(`Unknown action "${line.action}".`);
      }
      if (!["wide", "close", "follow", "overhead"].includes(line.camera)) {
        throw new Error(`Unknown camera "${line.camera}".`);
      }
    }
  }
}
