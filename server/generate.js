import fs from "node:fs";
import path from "node:path";
import { filmsDir, loadLibrary, readScript, safeId } from "./store.js";
import { aiffDuration, concatWav, silenceWav, synthesize, toWav } from "./voice.js";
import { buildCues, compileScene } from "./compile.js";
import { renderFilm } from "./render.js";

export async function generateFilm({ id, port, render }) {
  const script = readScript(safeId(id));
  const library = loadLibrary();
  const filmDir = path.join(filmsDir, script.id);
  const voiceDir = path.join(filmDir, "voice");
  const generated = path.join(filmDir, "generated");
  fs.rmSync(filmDir, { recursive: true, force: true });
  fs.mkdirSync(voiceDir, { recursive: true });
  fs.mkdirSync(generated, { recursive: true });

  const flat = script.scenes.flatMap((scene) => scene.lines);
  const durations = [];
  for (let i = 0; i < flat.length; i += 1) {
    const line = flat[i];
    const text = line.text?.trim();
    if (!text) {
      durations.push(1.15);
      continue;
    }
    const character = library.characters.find((item) => item.id === line.characterId);
    const aiff = path.join(voiceDir, `line-${i}.aiff`);
    const wav = path.join(voiceDir, `line-${i}.wav`);
    await synthesize({ text, voice: character?.voice || "Samantha", aiffPath: aiff });
    durations.push(await aiffDuration(aiff));
    await toWav(aiff, wav);
  }

  const { cues, duration } = buildCues(script, durations);
  const sceneJs = compileScene(script, cues, duration);
  fs.writeFileSync(path.join(generated, "scene.js"), sceneJs);
  fs.copyFileSync(path.join(filmsDir, "..", "library.json"), path.join(filmDir, "library.json"));

  await mixVoice({ filmDir, voiceDir, cues, duration, flat });

  let video = null;
  if (render) {
    const fps = script.fps || 12;
    const width = script.width || 1280;
    const height = script.height || 720;
    await renderFilm({
      url: `http://127.0.0.1:${port}/preview.html?film=${script.id}`,
      filmDir,
      fps,
      width,
      height,
      duration,
    });
    video = `/films/${script.id}/film.mp4`;
  }

  return {
    id: script.id,
    title: script.title,
    duration,
    cues: cues.map(({ text, t0, t1, characterId, action }) => ({ text, t0, t1, characterId, action })),
    scene: `/films/${script.id}/generated/scene.js`,
    voice: `/films/${script.id}/voice.wav`,
    video,
  };
}

async function mixVoice({ filmDir, voiceDir, cues, duration, flat }) {
  const head = path.join(voiceDir, "head.wav");
  const gap = path.join(voiceDir, "gap.wav");
  const tail = path.join(voiceDir, "tail.wav");
  await silenceWav(head, cues[0].t0);
  await silenceWav(gap, roundGap(cues));
  await silenceWav(tail, Math.max(0.05, duration - cues[cues.length - 1].t1));

  const list = [head];
  cues.forEach((cue, i) => {
    if (i > 0) list.push(gap);
    if (flat[i].text?.trim()) list.push(path.join(voiceDir, `line-${i}.wav`));
    else {
      const hold = path.join(voiceDir, `hold-${i}.wav`);
      list.push(hold);
    }
  });
  for (let i = 0; i < flat.length; i += 1) {
    if (!flat[i].text?.trim()) {
      await silenceWav(path.join(voiceDir, `hold-${i}.wav`), cues[i].t1 - cues[i].t0);
    }
  }
  list.push(tail);
  const listFile = path.join(voiceDir, "list.txt");
  fs.writeFileSync(listFile, list.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join("\n") + "\n");
  await concatWav(listFile, path.join(filmDir, "voice.wav"));
}

function roundGap(cues) {
  if (cues.length < 2) return 0.3;
  return Math.max(0.05, cues[1].t0 - cues[0].t1);
}
