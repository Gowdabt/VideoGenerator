# Video Generator

A local film studio. Characters, backgrounds, and props are built once and reused. Each script regenerates only its voice and its scene code, then Three.js plays that scene.

This follows the idea in [lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar): a film is code that draws frame `t`, plus a voice track, muxed with ffmpeg. That project is a Claude skill with dozens of hand-directed styles. This app does not need Claude, a network call, or that style library.

## What is reused, and what is regenerated

| Once, then reused | Regenerated for every script |
|---|---|
| Characters (shape, colors, macOS voice) | Spoken wavs |
| Components: tree, bench, rock, lamp, house, cloud | `data/films/<id>/generated/scene.js` |
| Backgrounds that place those components | The mp4, if you render |
| The Three.js rig in `public/engine/` | |

`scene.js` only records who is on screen, which background is up, and when each line starts. Walk, wave, talk, and the cameras live in the shared engine.

## Run

```sh
cd /Users/hbt/HarshithGowda/Apps/VideoGenerator
npm install
npm start
```

Open http://127.0.0.1:4173

Needs Node 20+, ffmpeg, and Google Chrome. Voice uses the Mac `say` command, so it stays on this machine.

## Make a film

1. **Library.** Adjust Mira and Dev, or add a character. Pick a macOS voice for each one. Add props, then place those props on a background. Click **Save library**.
2. **Script.** The sample is Morning Walk: the park, then the night street. Add a scene, choose a background you already saved, then add lines. A line is a character, an action (`idle`, `walk`, `wave`, `talk`, `look`), a camera (`wide`, `close`, `follow`, `overhead`), and the sentence they say.
3. **Generate voice and code.** Writes the wavs and `data/films/<id>/generated/scene.js`, and plays the preview.
4. **Render video.** Same generation, then Chrome draws every frame and ffmpeg writes `data/films/<id>/film.mp4`. The page shows the file underneath the preview.

Changing a background or a character does not rewrite old voice files. Generate that script again when you want a new read or a new cut.

12 fps at 1280×720 is the default so a short film renders in about a minute. Raise fps on the script if you want smoother motion.

## Layout

- `data/library.json` — shared cast, props, and places
- `data/scripts/` — one JSON file per script
- `public/engine/parts.js` — reusable meshes and the walk / wave / talk poses
- `public/engine/runtime.js` — draws whatever the generated scene says at time `t`
- `server/compile.js` — turns a script plus voice lengths into `scene.js`
- `server/render.js` — headless Chrome frames, then ffmpeg
