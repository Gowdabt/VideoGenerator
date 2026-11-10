import * as THREE from "/vendor/three/build/three.module.js";
import { makeCharacter, makeComponent, poseCharacter } from "./parts.js";

const params = new URLSearchParams(location.search);
const filmId = params.get("film");
const version = params.get("v") || "";
const capture = params.get("capture") === "1";
const canvas = document.querySelector("#view");
const caption = document.querySelector("#caption");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 80);
const hemi = new THREE.HemisphereLight("#fff6ea", "#445533", 0.8);
const sun = new THREE.DirectionalLight("#fff2dd", 1.3);
sun.position.set(6, 10, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
const shadow = sun.shadow.camera;
shadow.near = 0.5;
shadow.far = 30;
shadow.left = -12;
shadow.right = 12;
shadow.top = 12;
shadow.bottom = -12;
scene.add(hemi, sun);

const backgroundGroups = new Map();
const rigs = new Map();
let library = null;
let shotAt = null;
let format = null;

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function ease(value) {
  return value * value * (3 - 2 * value);
}

function luma(hex) {
  const color = new THREE.Color(hex);
  return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
}

function actorPosition(person, shot, local, dur) {
  const along = clamp(local / dur, 0, 1);
  const speaking = person.id === shot.characterId;
  if (speaking && shot.action === "walk") {
    return { x: person.homeX - 1.15 + along * 2.3, z: 0.15 };
  }
  if (speaking) return { x: person.homeX * 0.35, z: 0.65 };
  return { x: person.homeX, z: -0.15 };
}

function cameraFor(shot, speaker, local, dur) {
  const along = ease(clamp(local / dur, 0, 1));
  if (shot.camera === "close") {
    return {
      pos: [speaker.x * 0.25, 1.5, 3.45 - along * 0.3],
      look: [speaker.x, 1.38, speaker.z],
    };
  }
  if (shot.camera === "follow") {
    return {
      pos: [speaker.x - 1.5, 1.75, speaker.z + 3.3],
      look: [speaker.x, 1.15, speaker.z],
    };
  }
  if (shot.camera === "overhead") {
    return {
      pos: [0.2, 8.4 - along * 0.6, 0.4],
      look: [speaker.x * 0.3, 0, 0],
    };
  }
  return {
    pos: [along * 0.7, 2.35, 7.1],
    look: [0, 1, 0],
  };
}

function apply(time) {
  const shot = shotAt(Math.max(0, time));
  const background = library.backgrounds.find((item) => item.id === shot.backgroundId) || library.backgrounds[0];
  for (const [id, group] of backgroundGroups) group.visible = id === background.id;

  if (!scene.background) scene.background = new THREE.Color();
  scene.background.set(background.sky);
  const far = 42 - (Number(background.fog) || 0) * 26;
  if (!scene.fog) scene.fog = new THREE.Fog(background.horizon || background.sky, far * 0.35, far);
  scene.fog.color.set(background.horizon || background.sky);
  scene.fog.near = far * 0.35;
  scene.fog.far = far;

  const light = luma(background.sky);
  sun.intensity = 0.35 + light * 1.55;
  hemi.intensity = 0.25 + light * 0.75;
  hemi.color.set(light < 0.25 ? "#8aa0c8" : "#fff6ea");
  hemi.groundColor.set(background.ground);

  const local = time - shot.t0;
  const dur = Math.max(0.001, shot.t1 - shot.t0);
  let speaker = { x: 0, z: 0.4 };
  for (const [id, rig] of rigs) {
    const person = shot.present.find((item) => item.id === id);
    rig.visible = Boolean(person);
    if (!person) continue;
    const position = actorPosition(person, shot, local, dur);
    rig.position.x = position.x;
    rig.position.z = position.z;
    poseCharacter(rig, person.id === shot.characterId ? shot.action : "idle", time, local);
    if (person.id === shot.characterId) speaker = position;
  }

  const framing = cameraFor(shot, speaker, local, dur);
  camera.position.set(framing.pos[0], framing.pos[1], framing.pos[2]);
  camera.lookAt(framing.look[0], framing.look[1], framing.look[2]);
  caption.textContent = shot.text || "";
  renderer.render(scene, camera);
}

window.render = (time) => {
  try {
    apply(time);
  } catch (error) {
    window.RENDER_ERROR = error.message;
    throw error;
  }
};

function buildWorld() {
  for (const background of library.backgrounds) {
    const group = new THREE.Group();
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(16, 48),
      new THREE.MeshStandardMaterial({ color: background.ground, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    group.add(ground);
    for (const place of background.components || []) {
      const spec = library.components.find((item) => item.id === place.componentId);
      if (spec) group.add(makeComponent(spec, place));
    }
    group.visible = false;
    scene.add(group);
    backgroundGroups.set(background.id, group);
  }
  for (const character of library.characters) {
    const rig = makeCharacter(character);
    rig.visible = false;
    scene.add(rig);
    rigs.set(character.id, rig);
  }
}

async function boot() {
  library = await fetch("/api/library").then((response) => response.json());
  if (!filmId) {
    caption.textContent = "Generate a script to preview it.";
    window.READY = true;
    return;
  }
  let mod;
  try {
    mod = await import(`/films/${filmId}/generated/scene.js?v=${encodeURIComponent(version)}`);
  } catch (error) {
    window.RENDER_ERROR = "Generate the script before previewing it.";
    caption.textContent = window.RENDER_ERROR;
    window.READY = true;
    return;
  }
  shotAt = mod.shotAt;
  format = mod.FORMAT;
  window.FORMAT = format;
  window.DUR = format.duration;
  buildWorld();
  window.render(0);
  window.READY = true;
  if (!capture) {
    const started = performance.now();
    const loop = (now) => {
      window.render(((now - started) / 1000) % format.duration);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

boot().catch((error) => {
  window.RENDER_ERROR = error.message;
  caption.textContent = error.message;
  window.READY = true;
});
