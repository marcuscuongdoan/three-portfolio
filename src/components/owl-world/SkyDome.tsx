"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CONTACT_POINT } from "@/components/owl-world/flightPath";

export const FOG_COLOR = "#1a2046";
// Where the moon hangs: low ahead of the flight, so it rises behind the house
// at home and sits beside the owl at the contact stop
export const MOON_DIR = new THREE.Vector3(-0.3, 0.24, -1).normalize();

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * p;
    gl_Position.z = gl_Position.w; // always at the far plane
  }
`;
const skyFragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec3 uMoonColor;
  uniform vec3 uMoonDir;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.2, h));
    col = mix(col, uTop, smoothstep(0.18, 0.8, h));
    col = mix(col, uHorizon, smoothstep(0.0, -0.08, h));
    float m = max(dot(d, uMoonDir), 0.0);
    // Wide halo, tighter glow, then the disc itself (over 1 so it blooms)
    col += uMoonColor * (pow(m, 12.0) * 0.18 + pow(m, 160.0) * 0.5);
    float disc = smoothstep(0.99955, 0.99975, m);
    // A little shading across the disc so it doesn't read as a flat dot
    vec3 side = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
    float shade = 0.82 + 0.18 * dot(normalize(d - uMoonDir * m + 1e-6), side);
    col = mix(col, uMoonColor * 2.4 * shade, disc);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const starVertex = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  varying float vTwinkle;
  void main() {
    vTwinkle = 0.55 + 0.45 * sin(uTime * (0.8 + aPhase * 1.7) + aPhase * 40.0);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * p;
    gl_Position.z = gl_Position.w * 0.99999;
    gl_PointSize = aSize;
  }
`;
const starFragment = /* glsl */ `
  varying float vTwinkle;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, r);
    gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * 1.6, a * vTwinkle);
  }
`;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Sky() {
  const ref = useRef<THREE.Group>(null);
  const skyMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: new THREE.Color("#04061a") },
          uMid: { value: new THREE.Color("#0e1540") },
          uHorizon: { value: new THREE.Color(FOG_COLOR) },
          uMoonColor: { value: new THREE.Color("#dfe6ff") },
          uMoonDir: { value: MOON_DIR },
        },
      }),
    [],
  );

  const stars = useMemo(() => {
    const rand = mulberry32(11);
    const n = 1400;
    const pos = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const phase = new Float32Array(n);
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      // Spread over the upper sky, none hiding behind the moon
      do v.set(rand() * 2 - 1, rand(), rand() * 2 - 1);
      while (v.lengthSq() > 1 || v.lengthSq() < 0.01 || v.y < 0.06 * v.length() || v.dot(MOON_DIR) > 0.99 * v.length());
      v.normalize().multiplyScalar(440);
      pos.set([v.x, v.y, v.z], i * 3);
      size[i] = 1 + Math.pow(rand(), 6) * 3.2;
      phase[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: starVertex,
      fragmentShader: starFragment,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      toneMapped: false,
    });
    return { g, m };
  }, []);

  const starPoints = useRef<THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>>(null);
  // The dome follows the camera so it never gets closer
  useFrame(({ camera, clock }) => {
    ref.current?.position.copy(camera.position);
    if (starPoints.current) starPoints.current.material.uniforms.uTime!.value = clock.elapsedTime;
  });
  return (
    <group ref={ref}>
      <mesh material={skyMat} renderOrder={-2} frustumCulled={false}>
        <sphereGeometry args={[500, 32, 16]} />
      </mesh>
      <points ref={starPoints} geometry={stars.g} material={stars.m} renderOrder={-1} frustumCulled={false} />
    </group>
  );
}

// Soft clouds: every puff is a pair of camera-facing sprites painted with a
// blurry blob — a darker, wider one underneath and a moonlit one on top — so
// the clouds read as soft volumes with no hard edges. Every puff breathes,
// and the valley clouds drift downwind and wrap round
const DRIFT_MIN_X = -130;
const DRIFT_MAX_X = 110;

/** A soft, lumpy blob that fades to nothing at its edge */
function makePuffTexture() {
  const S = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry32(19);
  // Overlapping soft circles give it a cauliflower edge rather than a disc
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * S * 0.16;
    const x = S / 2 + Math.cos(a) * d;
    const y = S / 2 + Math.sin(a) * d * 0.8;
    const r = S * (0.2 + rand() * 0.16);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.42)");
    g.addColorStop(0.55, "rgba(255,255,255,0.2)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

type Cloud = {
  pos: [number, number, number];
  scale: number;
  // Metres per second downwind; 0 for the clouds that frame the contact stop
  speed: number;
  puffs: { p: [number, number, number]; r: number; phase: number }[];
};

// Sprite size per unit of puff radius, and how far the dark layer sits below
const PUFF_SIZE = 3.1;
const UNDER_DROP = 0.35;

function Clouds() {
  const group = useRef<THREE.Group>(null);
  const clouds = useMemo(() => {
    const rand = mulberry32(3);
    const list: Cloud[] = [];
    const add = (x: number, y: number, z: number, scale: number, speed: number) => {
      const n = 4 + Math.floor(rand() * 4);
      const puffs = Array.from({ length: n }, (_, i) => {
        // Bigger puffs in the middle, smaller ones trailing off the ends
        const middle = 1 - Math.abs(i - (n - 1) / 2) / n;
        return {
          p: [(i - (n - 1) / 2) * 1.05 + rand() * 0.5, rand() * 0.5 + middle * 0.5, rand() * 1.2 - 0.6] as [number, number, number],
          r: 0.75 + middle * 0.7 + rand() * 0.4,
          phase: rand() * Math.PI * 2,
        };
      });
      list.push({ pos: [x, y, z], scale, speed, puffs });
    };
    // Around the contact point (the owl's sky stop) and behind it
    const c = CONTACT_POINT;
    add(c.x - 8, c.y - 4.5, c.z - 11, 1.3, 0);
    add(c.x + 9, c.y + 1.5, c.z - 14, 1.6, 0);
    add(c.x - 13, c.y + 3, c.z - 18, 1.8, 0);
    add(c.x + 7, c.y - 7, c.z - 10, 1.2, 0);
    add(c.x + 16, c.y - 3, c.z - 7, 1.4, 0);
    add(c.x - 3, c.y + 5, c.z - 26, 2.2, 0);
    // Drifting high over the whole valley
    for (let i = 0; i < 34; i++) {
      add(DRIFT_MIN_X + rand() * (DRIFT_MAX_X - DRIFT_MIN_X), 20 + rand() * 20, 40 - rand() * 220, 1.6 + rand() * 2.6, 0.6 + rand() * 1.1);
    }
    return list;
  }, []);

  const mats = useMemo(() => {
    const map = makePuffTexture();
    const common = { map, transparent: true, depthWrite: false, fog: true };
    return {
      map,
      under: new THREE.SpriteMaterial({ ...common, color: "#262b4d", opacity: 0.7 }),
      top: new THREE.SpriteMaterial({ ...common, color: "#a9b3e2", opacity: 0.62 }),
    };
  }, []);
  useEffect(
    () => () => {
      mats.map.dispose();
      mats.under.dispose();
      mats.top.dispose();
    },
    [mats],
  );

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    g.children.forEach((child, i) => {
      const cl = clouds[i]!;
      if (cl.speed > 0) {
        const span = DRIFT_MAX_X - DRIFT_MIN_X;
        child.position.x = DRIFT_MIN_X + ((((cl.pos[0] - DRIFT_MIN_X + t * cl.speed) % span) + span) % span);
      } else {
        // The contact clouds only sway, so the shot stays framed
        child.position.x = cl.pos[0] + Math.sin(t * 0.06 + i * 1.7) * 2.5;
      }
      child.position.y = cl.pos[1] + Math.sin(t * 0.2 + i) * 0.35;
      // Every puff swells and settles on its own beat (two sprites a puff)
      child.children.forEach((sprite, k) => {
        const p = cl.puffs[k >> 1]!;
        const breathe = 1 + Math.sin(t * 0.45 + p.phase) * 0.08;
        const size = p.r * PUFF_SIZE * (k % 2 === 0 ? 1.15 : 1);
        sprite.scale.set(size * breathe, size * 0.72 * (2 - breathe), 1);
      });
    });
  });

  return (
    <group ref={group}>
      {clouds.map((cl, i) => (
        <group key={i} position={cl.pos} scale={cl.scale}>
          {cl.puffs.flatMap(({ p, r }, j) => [
            <sprite key={`u${j}`} material={mats.under} position={[p[0], p[1] - UNDER_DROP * r, p[2] - 0.05]} scale={[r * PUFF_SIZE * 1.15, r * PUFF_SIZE * 0.8, 1]} />,
            <sprite key={`t${j}`} material={mats.top} position={[p[0], p[1] + 0.1 * r, p[2]]} scale={[r * PUFF_SIZE, r * PUFF_SIZE * 0.72, 1]} />,
          ])}
        </group>
      ))}
    </group>
  );
}

export default function SkyDome() {
  return (
    <group userData={{ noShadow: true }}>
      <Sky />
      <Clouds />
    </group>
  );
}
