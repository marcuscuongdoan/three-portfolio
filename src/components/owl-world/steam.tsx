"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

/**
 * The owls are clockwork: now and then (and whenever one is clicked) they
 * vent steam from behind the shoulders, and throw a few sparks. One system for every owl: puffs and sparks live
 * in world space so they drift away behind an owl that moves on.
 */

export interface VentBurst {
  // 1 for a click, smaller for the idle puffs
  strength?: number;
  // Seconds from now
  delay?: number;
  sparks?: boolean;
}

// Vents in the owl's own space (it faces -Z): behind each shoulder
const VENTS = [new THREE.Vector3(0.14, 0.14, 0.15), new THREE.Vector3(-0.14, 0.14, 0.15)];
const BACK = new THREE.Vector3(0, 0.35, 1);

interface Pending extends Required<VentBurst> {
  origin: THREE.Object3D;
  at: number;
}
const queue: Pending[] = [];
let clockNow = 0;

/** Vent steam (and sparks) from `origin`, an owl's root object */
export function ventSteam(origin: THREE.Object3D, { strength = 1, delay = 0, sparks = true }: VentBurst = {}) {
  queue.push({ origin, strength, delay, sparks, at: clockNow + delay });
}

const SMOKE = 120;
const SPARKS = 160;

const smokeVertex = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aSeed;
  uniform float uScale;
  varying float vAlpha;
  varying float vSeed;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uScale / -mv.z;
    vAlpha = aAlpha;
    vSeed = aSeed;
  }
`;
const smokeFragment = /* glsl */ `
  varying float vAlpha;
  varying float vSeed;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv);
    // A lumpy puff, not a disc
    float n = noise(uv * 4.0 + vSeed * 17.0) * 0.6 + noise(uv * 9.0 - vSeed * 9.0) * 0.4;
    float a = smoothstep(0.5, 0.05, r + (n - 0.5) * 0.25);
    if (a < 0.01) discard;
    // Lit a little warmer from below by the lanterns
    vec3 col = mix(vec3(0.62, 0.66, 0.78), vec3(0.86, 0.86, 0.9), n);
    gl_FragColor = vec4(col, a * vAlpha * 0.55);
  }
`;
const sparkVertex = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  uniform float uScale;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = max(1.5, aSize * uScale / -mv.z);
    vAlpha = aAlpha;
  }
`;
const sparkFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, r);
    if (a < 0.01) discard;
    // White hot, cooling to orange
    vec3 col = mix(vec3(1.0, 0.35, 0.08), vec3(1.0, 0.9, 0.6), vAlpha);
    gl_FragColor = vec4(col * (1.0 + 3.0 * vAlpha), a * vAlpha);
  }
`;

class Pool {
  readonly pos: Float32Array;
  readonly vel: Float32Array;
  readonly size: Float32Array;
  readonly alpha: Float32Array;
  readonly life: Float32Array;
  readonly span: Float32Array;
  readonly grow: Float32Array;
  readonly geometry = new THREE.BufferGeometry();
  private next = 0;

  constructor(readonly count: number) {
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.size = new Float32Array(count);
    this.alpha = new Float32Array(count);
    this.life = new Float32Array(count).fill(1);
    this.span = new Float32Array(count).fill(1);
    this.grow = new Float32Array(count);
    const seed = new Float32Array(count).map(() => Math.random());
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  }

  spawn(p: THREE.Vector3, v: THREE.Vector3, span: number, size: number, grow: number) {
    const i = this.next;
    this.next = (this.next + 1) % this.count;
    this.pos.set([p.x, p.y, p.z], i * 3);
    this.vel.set([v.x, v.y, v.z], i * 3);
    this.life[i] = 0;
    this.span[i] = span;
    this.size[i] = size;
    this.grow[i] = grow;
  }

  /** Moves every live particle; `shape` gives its alpha for 0..1 of its life */
  step(dt: number, drag: number, gravity: number, shape: (k: number) => number) {
    const keep = Math.exp(-drag * dt);
    let live = false;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i]! >= 1) {
        this.alpha[i] = 0;
        continue;
      }
      live = true;
      this.life[i] = Math.min(1, this.life[i]! + dt / this.span[i]!);
      const j = i * 3;
      this.vel[j]! *= keep;
      this.vel[j + 1] = this.vel[j + 1]! * keep - gravity * dt;
      this.vel[j + 2]! *= keep;
      this.pos[j]! += this.vel[j]! * dt;
      this.pos[j + 1]! += this.vel[j + 1]! * dt;
      this.pos[j + 2]! += this.vel[j + 2]! * dt;
      this.size[i]! += this.grow[i]! * dt;
      this.alpha[i] = shape(this.life[i]!);
    }
    for (const name of ["position", "aSize", "aAlpha"]) this.geometry.getAttribute(name).needsUpdate = true;
    return live;
  }
}

const _p = new THREE.Vector3();
const _v = new THREE.Vector3();
const _back = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

export default function Steam() {
  const smoke = useMemo(() => new Pool(SMOKE), []);
  const sparks = useMemo(() => new Pool(SPARKS), []);
  const materials = useMemo(() => {
    const smokeMat = new THREE.ShaderMaterial({
      vertexShader: smokeVertex,
      fragmentShader: smokeFragment,
      uniforms: { uScale: { value: 1 } },
      transparent: true,
      depthWrite: false,
    });
    const sparkMat = new THREE.ShaderMaterial({
      vertexShader: sparkVertex,
      fragmentShader: sparkFragment,
      uniforms: { uScale: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    return { smokeMat, sparkMat };
  }, []);
  useEffect(
    () => () => {
      smoke.geometry.dispose();
      sparks.geometry.dispose();
      materials.smokeMat.dispose();
      materials.sparkMat.dispose();
    },
    [smoke, sparks, materials],
  );

  const smokePoints = useRef<THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>>(null);
  const sparkPoints = useRef<THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>>(null);

  useFrame(({ camera, size, viewport }, delta) => {
    const dt = Math.min(delta, 0.1);
    clockNow += dt;
    // World size → pixels at unit distance
    const scale = size.height * viewport.dpr * 0.5 * camera.projectionMatrix.elements[5]!;
    for (const p of [smokePoints.current, sparkPoints.current]) if (p) p.material.uniforms.uScale!.value = scale;

    for (let i = queue.length - 1; i >= 0; i--) {
      const b = queue[i]!;
      if (b.at > clockNow) continue;
      queue.splice(i, 1);
      if (!b.origin.visible) continue;
      b.origin.updateWorldMatrix(true, false);
      b.origin.matrixWorld.decompose(_p, _q, _s);
      const k = _s.x;
      _back.copy(BACK).applyQuaternion(_q).normalize();
      for (const vent of VENTS) {
        // A jet of steam out of the back, then rising
        const puffs = Math.round(3 + 6 * b.strength);
        for (let n = 0; n < puffs; n++) {
          _v.copy(vent).multiplyScalar(k).applyQuaternion(_q).add(_p);
          const side = Math.sign(vent.x);
          const out = new THREE.Vector3(side * 0.5, 0, 0).applyQuaternion(_q);
          const speed = (0.5 + Math.random() * 0.9) * (0.6 + b.strength * 0.6) * k;
          const vel = _back
            .clone()
            .multiplyScalar(speed)
            .addScaledVector(out, speed * 0.6)
            .add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.25 + Math.random() * 0.3, (Math.random() - 0.5) * 0.3).multiplyScalar(k));
          smoke.spawn(_v, vel, 1.4 + Math.random() * 1.3, (0.08 + Math.random() * 0.06) * k, (0.32 + Math.random() * 0.2) * k);
        }
        if (b.sparks) {
          const count = Math.round(4 + 16 * b.strength);
          for (let n = 0; n < count; n++) {
            _v.copy(vent).multiplyScalar(k).applyQuaternion(_q).add(_p);
            const vel = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.4, Math.random() - 0.5)
              .normalize()
              .multiplyScalar((1.2 + Math.random() * 2) * k)
              .addScaledVector(_back, 0.8 * k);
            sparks.spawn(_v, vel, 0.35 + Math.random() * 0.5, (0.018 + Math.random() * 0.02) * k, -0.02 * k);
          }
        }
      }
    }

    // Steam slows, spreads and rises; it's thickest just after it leaves
    smoke.step(dt, 1.6, -0.18, (t) => Math.min(1, t * 8) * (1 - t) * (1 - t));
    sparks.step(dt, 0.6, 4.5, (t) => 1 - t * t);
  });

  return (
    <group userData={{ noShadow: true }}>
      <points ref={smokePoints} geometry={smoke.geometry} material={materials.smokeMat} frustumCulled={false} renderOrder={2} />
      <points ref={sparkPoints} geometry={sparks.geometry} material={materials.sparkMat} frustumCulled={false} renderOrder={3} />
    </group>
  );
}

/** Seconds until an idle owl next vents, at random */
export const nextIdleVent = () => 7 + Math.random() * 9;
