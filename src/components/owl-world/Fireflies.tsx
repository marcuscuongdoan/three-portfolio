"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CORRIDOR_X, MUSEUM_CENTER } from "@/components/owl-world/flightPath";

/**
 * Fireflies drifting around the home clearing, along the flight and in the
 * museum. One point cloud; each point wanders on its own little loop in the
 * vertex shader and pulses.
 */

const vertex = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vGlow;
  void main() {
    float t = uTime * (0.25 + fract(aSeed * 7.3) * 0.35) + aSeed * 50.0;
    vec3 p = position + vec3(sin(t) * 0.6, sin(t * 1.7) * 0.35, cos(t * 0.8) * 0.6);
    vGlow = pow(0.5 + 0.5 * sin(uTime * (1.2 + fract(aSeed * 3.1)) + aSeed * 20.0), 3.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (6.0 + 10.0 * vGlow) * uPixelRatio * (8.0 / -mv.z);
  }
`;
const fragment = /* glsl */ `
  varying float vGlow;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, r);
    a *= a;
    gl_FragColor = vec4(vec3(1.0, 0.85, 0.4) * (1.2 + 2.0 * vGlow), a * (0.25 + 0.75 * vGlow));
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

// [count, centre x, centre z, half width x, half depth z, min y, max y]
const SWARMS: [number, number, number, number, number, number, number][] = [
  [70, 0.5, -4, 8, 9, 0.4, 4.5],
  [90, CORRIDOR_X, -42, 9, 34, 0.6, 6.5],
  [50, MUSEUM_CENTER.x, MUSEUM_CENTER.z, 11, 9, 0.4, 4],
];

export default function Fireflies() {
  const { geometry, material } = useMemo(() => {
    const rand = mulberry32(5);
    const pos: number[] = [];
    const seed: number[] = [];
    for (const [n, cx, cz, hx, hz, y0, y1] of SWARMS) {
      for (let i = 0; i < n; i++) {
        pos.push(cx + (rand() * 2 - 1) * hx, y0 + rand() * (y1 - y0), cz + (rand() * 2 - 1) * hz);
        seed.push(rand());
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.Float32BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    return { geometry: g, material: m };
  }, []);

  const points = useRef<THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>>(null);
  useFrame(({ clock, viewport }) => {
    const u = points.current?.material.uniforms;
    if (!u) return;
    u.uTime!.value = clock.elapsedTime;
    u.uPixelRatio!.value = viewport.dpr;
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />;
}
