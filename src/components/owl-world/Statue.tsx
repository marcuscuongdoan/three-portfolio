"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";

const WARRIOR_URL = "/models/decorations/Warrior_of_Dawn.glb";

/**
 * Life for a model with no rig: three meshes (body, hammer, and a "head"
 * mesh that also holds the shield), so it's done per vertex, weighted by
 * where each vertex sits:
 *  - breathing: the chest rises and falls, everything above it lifts a touch;
 *  - standing: the weight shifts from foot to foot;
 *  - the head (what's above the neck and close to its axis, so the shield
 *    and pauldrons stay put) looks about now and then.
 *
 * The model's vertices are in its own frame (Z up, centimetres); the
 * shader works in metres, Y up, from the feet, facing +Z, then converts back.
 */
const IDLE_HEAD = /* glsl */ `
  uniform float uBreath;
  uniform float uSway;
  uniform vec2 uLook;
  uniform float uHeadMix;
  vec3 idleToM(vec3 r) { return vec3(r.x, -r.z, r.y) * 0.01; }
  vec3 idleToR(vec3 m) { return vec3(m.x, m.z, -m.y) * 100.0; }
  const vec3 IDLE_NECK = vec3(0.03, 1.38, -0.12);
  mat3 idleRotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
  mat3 idleRotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
  // Rotate p (and its normal) by r about pivot o, by weight w
  void idleTurn(inout vec3 p, inout vec3 n, mat3 r, vec3 o, float w) {
    p = mix(p, o + r * (p - o), w);
    n = mix(n, r * n, w);
  }
  void idleDeform(inout vec3 m, inout vec3 n) {
    vec3 m0 = m;
    // The head turns about the neck
    float d = length(m0.xz - IDLE_NECK.xz);
    float head = smoothstep(1.28, 1.42, m0.y) * (1.0 - smoothstep(0.17, 0.26, d)) * uHeadMix;
    idleTurn(m, n, idleRotY(uLook.x) * idleRotX(uLook.y), IDLE_NECK, head);
    // Breathing: the chest swells and everything above it lifts a touch
    float chest = smoothstep(0.85, 1.3, m0.y);
    float swell = chest * (1.0 - smoothstep(1.35, 1.55, m0.y));
    m.xz += (m.xz - IDLE_NECK.xz) * uBreath * 0.012 * swell;
    m.y += uBreath * 0.01 * chest;
    // The weight shifts from foot to foot: a lean from the ground up
    m.x += uSway * m0.y * 0.012;
  }
  void main() {`;

const IDLE_NORMAL = /* glsl */ `
  #include <beginnormal_vertex>
  {
    vec3 m = idleToM(position);
    vec3 n = vec3(objectNormal.x, -objectNormal.z, objectNormal.y);
    idleDeform(m, n);
    n = normalize(n);
    objectNormal = vec3(n.x, n.z, -n.y);
  }`;

const IDLE_POSITION = /* glsl */ `
  #include <begin_vertex>
  {
    vec3 m = idleToM(transformed);
    vec3 n = vec3(0.0, 1.0, 0.0);
    idleDeform(m, n);
    transformed = idleToR(m);
  }`;

type Idle = {
  uBreath: { value: number };
  uSway: { value: number };
  uLook: { value: THREE.Vector2 };
};

/** A copy of the material that runs the idle, driven by `idle` */
function idleMaterial(source: THREE.Material, idle: Idle, headMix: number) {
  const m = source.clone();
  const uniforms = { ...idle, uHeadMix: { value: headMix } };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("void main() {", IDLE_HEAD)
      .replace("#include <beginnormal_vertex>", IDLE_NORMAL)
      .replace("#include <begin_vertex>", IDLE_POSITION);
  };
  return m;
}

/** Glances: hold a look for a while, then turn to another (often back ahead) */
class Glance {
  look = new THREE.Vector2();
  private target = new THREE.Vector2();
  private next = 0;
  constructor(private rand: () => number) {
    this.next = 1 + rand() * 3;
  }
  step(t: number, dt: number) {
    if (t > this.next) {
      const ahead = this.rand() < 0.35;
      this.target.set(ahead ? 0 : (this.rand() * 2 - 1) * 0.5, ahead ? 0 : this.rand() * 0.16 - 0.06);
      this.next = t + 2.5 + this.rand() * 4;
    }
    // Eased like a head turn: quick to start, settling slowly
    this.look.x = THREE.MathUtils.damp(this.look.x, this.target.x, 2.4, dt);
    this.look.y = THREE.MathUtils.damp(this.look.y, this.target.y, 2.4, dt);
  }
}

/** One statue's copy of the model, and the rhythm it idles to */
class WarriorIdle {
  readonly model: THREE.Object3D;
  private idle: Idle = { uBreath: { value: 0 }, uSway: { value: 0 }, uLook: { value: new THREE.Vector2() } };
  private materials: THREE.Material[] = [];
  private glance: Glance;
  private phase: number;

  constructor(scene: THREE.Object3D, seed: number) {
    this.model = scene.clone();
    this.model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      // The hammer only breathes with the hand; it doesn't turn with the head
      mesh.material = idleMaterial(mesh.material as THREE.Material, this.idle, mesh.name === "Hammer" ? 0 : 1);
      this.materials.push(mesh.material);
    });
    let state = 1 + (Math.abs(Math.floor(seed * 7919)) % 2147483646);
    const rand = () => ((state = (state * 16807) % 2147483647) - 1) / 2147483646;
    // Statues side by side shouldn't breathe in step
    this.phase = rand() * 100;
    this.glance = new Glance(rand);
  }

  step(time: number, dt: number) {
    const t = time + this.phase;
    // A slow breath (about 4.6 s), its out-breath a little softer than the in
    const b = Math.sin((t / 4.6) * Math.PI * 2);
    this.idle.uBreath.value = b > 0 ? b : b * 0.8;
    this.idle.uSway.value = Math.sin((t / 9) * Math.PI * 2) * 0.8 + Math.sin((t / 3.7) * Math.PI * 2) * 0.2;
    this.glance.step(t, dt);
    this.idle.uLook.value.copy(this.glance.look);
  }

  dispose() {
    this.materials.forEach((m) => m.dispose());
  }
}

/**
 * The Warrior of Dawn, about 2.1 m tall, standing on the ground at its
 * origin and facing its local +Z, idling. Several stand about the world:
 * each gets its own copy of the (shared) model and, by its `seed`, its own
 * rhythm. Suspends while the model loads: wrap it in its own Suspense so the
 * scene doesn't wait on it.
 */
export default function WarriorStatue({ scale = 1, seed = 1, ...group }: { scale?: number; seed?: number } & Omit<React.ComponentProps<"group">, "scale">) {
  const { scene } = useGLTF(WARRIOR_URL);
  const warrior = useMemo(() => new WarriorIdle(scene, seed), [scene, seed]);
  useEffect(() => () => warrior.dispose(), [warrior]);
  useFrame(({ clock }, delta) => warrior.step(clock.elapsedTime, Math.min(delta, 0.1)));

  return (
    <group {...group}>
      <primitive object={warrior.model} scale={scale} />
    </group>
  );
}
