const HEAD = 0.45;
const GAP = 0.3;
const TAIL = 0.6;

export function buildCues(script, durations) {
  const cues = [];
  let cursor = HEAD;
  let index = 0;
  script.scenes.forEach((scene, sceneIndex) => {
    const ids = [...new Set(scene.lines.map((line) => line.characterId))];
    const present = ids.map((id, i) => ({
      id,
      homeX: (i - (ids.length - 1) / 2) * 1.7,
    }));
    scene.lines.forEach((line) => {
      const spoken = line.text?.trim() ? durations[index] : 1.15;
      const t0 = cursor;
      const t1 = cursor + spoken;
      cues.push({
        index,
        sceneIndex,
        t0: round(t0),
        t1: round(t1),
        backgroundId: scene.backgroundId,
        characterId: line.characterId,
        action: line.action,
        camera: line.camera,
        text: line.text?.trim() || "",
        present,
      });
      cursor = t1 + GAP;
      index += 1;
    });
  });
  if (cues.length) cursor -= GAP;
  return { cues, duration: round(cursor + TAIL) };
}

export function compileScene(script, cues, duration) {
  const blocks = cues.map((cue, i) => {
    const label = cue.text || cue.action;
    return `  // ${i + 1}. ${label}\n  if (t < ${cue.t1.toFixed(3)}) return ${inline(cue)};`;
  });
  const hold = { ...cues[cues.length - 1], text: "" };
  return `// Generated from "${script.title}" (${script.id}).
// Regenerated whenever this script is generated.
// Characters, backgrounds, components, and the Three.js rig live in the library
// and in public/engine. This file only says who speaks, when, and how they move.

export const FORMAT = ${JSON.stringify(
    {
      id: script.id,
      title: script.title,
      fps: script.fps || 12,
      width: script.width || 1280,
      height: script.height || 720,
      duration,
    },
    null,
    2,
  )};

export function shotAt(t) {
${blocks.join("\n")}
  return ${inline(hold)};
}
`;
}

function inline(value) {
  return JSON.stringify(value);
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}
