import * as THREE from "/vendor/three/build/three.module.js";

function mesh(geometry, color, material = {}) {
  const body = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.02, ...material }),
  );
  body.castShadow = true;
  body.receiveShadow = true;
  return body;
}

export function makeCharacter(spec) {
  const group = new THREE.Group();
  const scale = Number(spec.scale) || 1;
  group.scale.setScalar(scale);

  const body = mesh(new THREE.CapsuleGeometry(0.26, 0.52, 4, 10), spec.body);
  body.position.y = 1.02;

  const head = new THREE.Group();
  head.position.y = 1.62;
  const skull = mesh(new THREE.SphereGeometry(0.24, 16, 12), spec.body);
  const hair = mesh(new THREE.SphereGeometry(0.25, 16, 12), spec.accent);
  hair.scale.set(1, 0.62, 1);
  hair.position.y = 0.1;
  const eyeL = mesh(new THREE.SphereGeometry(0.035, 8, 8), "#1a1a1a");
  const eyeR = eyeL.clone();
  eyeL.position.set(-0.08, 0.02, 0.2);
  eyeR.position.set(0.08, 0.02, 0.2);
  const mouth = mesh(new THREE.SphereGeometry(0.05, 8, 8), "#3a221c");
  mouth.position.set(0, -0.1, 0.2);
  mouth.scale.y = 0.35;
  head.add(skull, hair, eyeL, eyeR, mouth);

  const armL = limb(spec.body, -1);
  const armR = limb(spec.body, 1);
  armL.position.set(-0.34, 1.32, 0);
  armR.position.set(0.34, 1.32, 0);
  const legL = limb(spec.accent, -1, 0.08, 0.34);
  const legR = limb(spec.accent, 1, 0.08, 0.34);
  legL.position.set(-0.12, 0.62, 0);
  legR.position.set(0.12, 0.62, 0);

  group.add(body, head, armL, armR, legL, legR);
  group.userData = { head, armL, armR, legL, legR, mouth };
  return group;
}

function limb(color, side, radius = 0.07, length = 0.36) {
  const pivot = new THREE.Group();
  const part = mesh(new THREE.CapsuleGeometry(radius, length, 3, 8), color);
  part.position.y = -(length * 0.5 + radius);
  pivot.add(part);
  pivot.userData.side = side;
  return pivot;
}

export function poseCharacter(rig, action, t, local) {
  const parts = rig.userData;
  parts.armL.rotation.set(0, 0, 0.08);
  parts.armR.rotation.set(0, 0, -0.08);
  parts.legL.rotation.set(0, 0, 0);
  parts.legR.rotation.set(0, 0, 0);
  parts.head.rotation.set(0, 0, 0);
  parts.mouth.scale.set(1, 0.35, 1);
  rig.position.y = Math.sin(t * 2) * 0.02;

  if (action === "walk") {
    const step = Math.sin(local * 9);
    parts.legL.rotation.x = step * 0.75;
    parts.legR.rotation.x = -step * 0.75;
    parts.armL.rotation.x = -step * 0.55;
    parts.armR.rotation.x = step * 0.55;
    rig.position.y = Math.abs(Math.sin(local * 9)) * 0.055;
  } else if (action === "wave") {
    parts.armR.rotation.z = -2.2;
    parts.armR.rotation.x = Math.sin(local * 12) * 0.35;
  } else if (action === "talk") {
    parts.mouth.scale.y = 0.4 + Math.abs(Math.sin(local * 16)) * 1.7;
    parts.head.rotation.y = Math.sin(local * 1.6) * 0.14;
  } else if (action === "look") {
    parts.head.rotation.y = 0.5;
  }
}

export function makeComponent(spec, place = {}) {
  const group = new THREE.Group();
  if (spec.kind === "tree") group.add(...tree(spec));
  else if (spec.kind === "bench") group.add(...bench(spec));
  else if (spec.kind === "rock") group.add(rock(spec));
  else if (spec.kind === "lamp") group.add(...lamp(spec));
  else if (spec.kind === "house") group.add(...house(spec));
  else group.add(...cloud(spec));

  group.position.set(Number(place.x) || 0, 0, Number(place.z) || 0);
  group.scale.setScalar(Number(place.scale) || 1);
  return group;
}

function tree(spec) {
  const trunk = mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.9, 8), spec.accent);
  trunk.position.y = 0.45;
  const crown = mesh(new THREE.ConeGeometry(0.75, 1.25, 9), spec.color);
  crown.position.y = 1.4;
  const tip = mesh(new THREE.ConeGeometry(0.48, 0.85, 9), spec.color);
  tip.position.y = 2.05;
  return [trunk, crown, tip];
}

function bench(spec) {
  const seat = mesh(new THREE.BoxGeometry(1.3, 0.08, 0.38), spec.color);
  seat.position.y = 0.42;
  const back = mesh(new THREE.BoxGeometry(1.3, 0.36, 0.08), spec.color);
  back.position.set(0, 0.66, -0.15);
  const legs = [-0.52, 0.52].flatMap((x) => {
    const front = mesh(new THREE.BoxGeometry(0.08, 0.42, 0.08), spec.accent);
    const rear = front.clone();
    front.position.set(x, 0.21, 0.12);
    rear.position.set(x, 0.21, -0.12);
    return [front, rear];
  });
  return [seat, back, ...legs];
}

function rock(spec) {
  const body = mesh(new THREE.DodecahedronGeometry(0.42, 0), spec.color);
  body.position.y = 0.28;
  body.scale.set(1.2, 0.75, 1);
  return body;
}

function lamp(spec) {
  const pole = mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.1, 8), spec.color);
  pole.position.y = 1.05;
  const bulb = mesh(new THREE.SphereGeometry(0.16, 12, 10), spec.accent, {
    emissive: spec.accent,
    emissiveIntensity: 1.6,
    roughness: 0.35,
  });
  bulb.position.y = 2.15;
  const light = new THREE.PointLight(spec.accent, 4, 7, 2);
  light.position.y = 2.1;
  return [pole, bulb, light];
}

function house(spec) {
  const walls = mesh(new THREE.BoxGeometry(1.5, 1, 1.2), spec.color);
  walls.position.y = 0.5;
  const roof = mesh(new THREE.ConeGeometry(1.15, 0.7, 4), spec.accent);
  roof.position.y = 1.3;
  roof.rotation.y = Math.PI / 4;
  const door = mesh(new THREE.BoxGeometry(0.28, 0.48, 0.06), "#3a2a22");
  door.position.set(0, 0.28, 0.6);
  return [walls, roof, door];
}

function cloud(spec) {
  return [-0.35, 0, 0.38].map((x, i) => {
    const puff = mesh(new THREE.SphereGeometry(0.28 + (i === 1 ? 0.08 : 0), 12, 10), spec.color);
    puff.position.set(x, 1.6, 0);
    return puff;
  });
}
