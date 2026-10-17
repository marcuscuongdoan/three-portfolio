"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { mulberry32 } from "@/themes/shared/random";

/**
 * Fireworks over the valley. One point cloud: each burst is a rocket that
 * climbs, then a shell of sparks that spreads, droops and fades, over and
 * over at a new spot and colour each time. All of it in the vertex shader.
 */

const vertex = /* glsl */ `
  attribute vec3 aDir;
  attribute float aBurst;
  attribute float aSeed;
  attribute float aLead;
  uniform float uTime;
  uniform float uPeriod;
  uniform float uRise;
  uniform float uLife;
  uniform float uRadius;
  uniform float uSize;
  uniform float uScale;
  uniform vec3 uCenter;
  uniform vec3 uExtent;
  uniform vec3 uC0;
  uniform vec3 uC1;
  uniform vec3 uC2;
  uniform vec3 uC3;
  varying vec3 vColor;
  varying float vAlpha;
  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  void main() {
    // Bursts staggered so they don't all go at once
    float tt = uTime + aBurst * uPeriod * 0.618 + aBurst * 0.37;
    float cycle = floor(tt / uPeriod);
    float local = tt - cycle * uPeriod;
    float h = aBurst * 17.13 + cycle * 3.71;
    vec3 origin = uCenter + (vec3(hash(h), hash(h + 1.3), hash(h + 2.7)) * 2.0 - 1.0) * uExtent;
    float k = hash(h + 4.1);
    vec3 col = k < 0.25 ? uC0 : k < 0.5 ? uC1 : k < 0.75 ? uC2 : uC3;
    float radius = uRadius * (0.7 + 0.6 * hash(h + 5.9));
    vec3 p;
    float size;
    if (local < uRise) {
      // Only one spark per burst plays the rocket
      float r = local / uRise;
      p = origin - vec3(0.0, (1.0 - r) * (1.0 - r) * 9.0, 0.0);
      vAlpha = aLead * 0.9;
      vColor = vec3(1.0, 0.85, 0.6);
      size = 0.18;
    } else {
      float e = local - uRise;
      float life = clamp(e / uLife, 0.0, 1.0);
      p = origin + aDir * radius * (1.0 - exp(-3.2 * e)) + vec3(0.0, -0.6 * e * e, 0.0);
      float twinkle = 0.75 + 0.25 * sin(uTime * 30.0 + aSeed * 60.0);
      vAlpha = e < uLife ? pow(1.0 - life, 1.6) * twinkle : 0.0;
      vColor = mix(vec3(1.0, 0.95, 0.85), col, smoothstep(0.0, 0.25, e));
      size = mix(0.2, 0.08, life);
    }
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = vAlpha > 0.0 ? max(1.5, size * uSize * uScale / -mv.z) : 0.0;
  }
`;
const fragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
    gl_FragColor = vec4(vColor * 3.0, a * vAlpha);
  }
`;

export interface FireworksProps {
  /** Where bursts go off: a box around `center`, ± `extent` */
  center: [number, number, number];
  extent: [number, number, number];
  bursts?: number;
  sparks?: number;
  /** Four colours, one picked per burst */
  colors: [string, string, string, string];
  /** Seconds between one burst's goes, and its shell's size (m) */
  period?: number;
  radius?: number;
  seed?: number;
}

export default function Fireworks({ center, extent, bursts = 5, sparks = 220, colors, period = 4.6, radius = 4, seed = 3 }: FireworksProps) {
  const { geometry, material } = useMemo(() => {
    const rand = mulberry32(seed);
    const dir: number[] = [];
    const burst: number[] = [];
    const seeds: number[] = [];
    const lead: number[] = [];
    const v = new THREE.Vector3();
    for (let b = 0; b < bursts; b++) {
      for (let i = 0; i < sparks; i++) {
        v.randomDirection().multiplyScalar(0.85 + rand() * 0.15);
        dir.push(v.x, v.y, v.z);
        burst.push(b);
        seeds.push(rand());
        lead.push(i === 0 ? 1 : 0);
      }
    }
    const g = new THREE.BufferGeometry();
    // Positions come from the shader; three still wants the attribute
    g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(dir.length), 3));
    g.setAttribute("aDir", new THREE.Float32BufferAttribute(dir, 3));
    g.setAttribute("aBurst", new THREE.Float32BufferAttribute(burst, 1));
    g.setAttribute("aSeed", new THREE.Float32BufferAttribute(seeds, 1));
    g.setAttribute("aLead", new THREE.Float32BufferAttribute(lead, 1));
    const [c0, c1, c2, c3] = colors.map((c) => new THREE.Color(c));
    const m = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        uTime: { value: 0 },
        uPeriod: { value: period },
        uRise: { value: 1.0 },
        uLife: { value: 2.4 },
        uRadius: { value: radius },
        uSize: { value: 1 },
        uScale: { value: 1 },
        uCenter: { value: new THREE.Vector3(...center) },
        uExtent: { value: new THREE.Vector3(...extent) },
        uC0: { value: c0 },
        uC1: { value: c1 },
        uC2: { value: c2 },
        uC3: { value: c3 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
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
  useFrame(({ clock, camera, size, viewport }) => {
    const u = points.current?.material.uniforms;
    if (!u) return;
    u.uTime!.value = clock.elapsedTime;
    // Pixels per metre at 1 m, so sparks keep their real size at any distance
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 45;
    u.uScale!.value = (size.height * viewport.dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)));
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} userData={{ noShadow: true }} />;
}
