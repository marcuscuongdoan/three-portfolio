"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { mulberry32 } from "@/themes/shared/random";

/**
 * Things drifting down through the valley: snow, blossom, confetti. One point
 * cloud; each point falls through its box in the vertex shader and wraps
 * back to the top, swaying as it goes.
 */

// [count, centre x, centre z, half width x, half depth z, min y, max y]
export type FallBox = [number, number, number, number, number, number, number];

const vertex = /* glsl */ `
  attribute float aSeed;
  attribute vec2 aRange;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform float uSway;
  uniform vec2 uSpeed;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vAngle;
  void main() {
    float speed = mix(uSpeed.x, uSpeed.y, fract(aSeed * 13.7));
    float y = aRange.x + mod(position.y - aRange.x - uTime * speed, aRange.y);
    float t = uTime * (0.5 + fract(aSeed * 5.3)) + aSeed * 40.0;
    vec3 p = vec3(position.x + sin(t) * uSway, y, position.z + cos(t * 0.8) * uSway);
    // Fades in under the top of its box and out above the ground
    float h = (y - aRange.x) / aRange.y;
    vAlpha = smoothstep(0.0, 0.06, h) * smoothstep(1.0, 0.85, h);
    vAngle = t * 1.3;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = min(48.0, uSize * (0.6 + 0.8 * fract(aSeed * 3.1)) * uPixelRatio * (8.0 / -mv.z));
  }
`;
const fragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vAngle;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
  #ifdef PETAL
    // A tumbling oval
    float s = sin(vAngle), k = cos(vAngle);
    c = mat2(k, -s, s, k) * c;
    float a = smoothstep(0.5, 0.38, length(c * vec2(1.0, 2.0)));
  #else
    float a = smoothstep(0.5, 0.1, length(c));
  #endif
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

export interface FallingProps {
  boxes: FallBox[];
  colors: string[];
  /** Point size at 8 m, in CSS pixels */
  size: number;
  /** Fall speed range, m/s */
  speed: [number, number];
  /** How far each one swings side to side, m */
  sway?: number;
  petal?: boolean;
  /** Glowing (additive) rather than solid */
  glow?: boolean;
  seed?: number;
}

export default function Falling({ boxes, colors, size, speed, sway = 0.4, petal = false, glow = false, seed = 7 }: FallingProps) {
  const { geometry, material } = useMemo(() => {
    const rand = mulberry32(seed);
    const palette = colors.map((c) => new THREE.Color(c));
    const pos: number[] = [];
    const seeds: number[] = [];
    const range: number[] = [];
    const color: number[] = [];
    for (const [n, cx, cz, hx, hz, y0, y1] of boxes) {
      for (let i = 0; i < n; i++) {
        pos.push(cx + (rand() * 2 - 1) * hx, y0 + rand() * (y1 - y0), cz + (rand() * 2 - 1) * hz);
        seeds.push(rand());
        range.push(y0, y1 - y0);
        const c = palette[Math.floor(rand() * palette.length)]!;
        color.push(c.r, c.g, c.b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.Float32BufferAttribute(seeds, 1));
    g.setAttribute("aRange", new THREE.Float32BufferAttribute(range, 2));
    g.setAttribute("aColor", new THREE.Float32BufferAttribute(color, 3));
    const m = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      defines: petal ? { PETAL: "" } : {},
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: 1 },
        uSize: { value: size },
        uSway: { value: sway },
        uSpeed: { value: new THREE.Vector2(...speed) },
      },
      transparent: true,
      depthWrite: false,
      blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
      toneMapped: !glow,
    });
    return { geometry: g, material: m };
    // The props are fixed for a theme's life
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  const points = useRef<THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>>(null);
  useFrame(({ clock, viewport }) => {
    const u = points.current?.material.uniforms;
    if (!u) return;
    u.uTime!.value = clock.elapsedTime;
    u.uPixelRatio!.value = viewport.dpr;
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} userData={{ noShadow: true }} />;
}
