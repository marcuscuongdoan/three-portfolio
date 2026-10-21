"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import {
  Color,
  type DirectionalLight,
  type Fog,
  type HemisphereLight,
  type Material,
  MathUtils,
  type Mesh,
  type MeshBasicMaterial,
  type MeshStandardMaterial,
  type Object3D,
  PMREMGenerator,
  type PointLight,
  type Scene,
  type Texture,
  Vector3,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { useShowcase } from "./store";

// One in-world day, in real seconds, when the light is on Auto
export const DAY_SECONDS = 120;
const START_HOUR = 16.5;
const FIXED_HOUR = { day: 13, night: 23 } as const;
// Sun and moon sit this far from the middle of the scene (inside the camera's far plane)
const SKY_RADIUS = 420;

/** What the post effects need to know about the sky, refreshed every frame. */
export const sky = {
  hour: START_HOUR,
  // World position of whichever of the sun or moon is up
  lightPos: new Vector3(0, 300, 0),
  // 0 at noon, 1 deep at night
  night: 0,
  // Peaks while the sun is near the horizon
  golden: 0,
};

const C = {
  skyDay: new Color("#a8cdec"),
  skyNight: new Color("#060a1a"),
  skyDusk: new Color("#f2a36b"),
  hemiDay: new Color("#dbeeff"),
  hemiNight: new Color("#34446e"),
  groundDay: new Color("#6b7a52"),
  groundNight: new Color("#12151c"),
  sun: new Color("#fff3dc"),
  sunset: new Color("#ff9a52"),
  moon: new Color("#a9bcff"),
  discSun: new Color("#fff4c8"),
  discDusk: new Color("#ffad66"),
  discMoon: new Color("#dfe8ff"),
};
const tmp = new Color();

interface Glow {
  mat: MeshStandardMaterial;
  base: number;
}

// Neon, bulbs, screens and headlights: every emissive material in the scene,
// so they can glow brighter after dark
export function collectGlows(roots: Object3D[]): Glow[] {
  const seen = new Set<Material>();
  const glows: Glow[] = [];
  for (const root of roots) {
    root.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const std = m as MeshStandardMaterial;
        if (seen.has(m) || !std.emissive || std.emissive.getHex() === 0) continue;
        if (/tail|brake/i.test(m.name)) continue; // the vehicles drive these
        seen.add(m);
        glows.push({ mat: std, base: std.emissiveIntensity ?? 1 });
      }
    });
  }
  return glows;
}

// Plain helpers, so hook-owned three objects only change through them
function setEnvironment(scene: Scene, env: Texture | null) {
  scene.environment = env;
}

function applySky(scene: Scene, color: Color, envIntensity: number) {
  const bg = (scene.background as Color | null) ?? new Color();
  bg.copy(color);
  scene.background = bg;
  (scene.fog as Fog | null)?.color.copy(color);
  scene.environmentIntensity = envIntensity;
}

function applyGlows(glows: Glow[], gain: number) {
  for (const g of glows) g.mat.emissiveIntensity = g.base * gain;
}

// Moves the in-world clock: free-running on Auto, otherwise eased (always
// forwards) to the fixed hour
function advanceClock(dt: number) {
  const mode = useShowcase.getState().lightMode;
  if (mode === "auto") {
    sky.hour = (sky.hour + (dt * 24) / DAY_SECONDS) % 24;
    return;
  }
  const ahead = (FIXED_HOUR[mode] - sky.hour + 24) % 24;
  if (ahead > 0.01) sky.hour = (sky.hour + Math.min(ahead, Math.max(0.05, ahead * 1.6) * dt * 2)) % 24;
}

export default function Atmosphere({ glows, onDisc }: { glows: Glow[]; onDisc: (disc: Mesh | null) => void }) {
  const { scene, gl } = useThree();
  const hemi = useRef<HemisphereLight>(null);
  const sun = useRef<DirectionalLight>(null);
  const disc = useRef<Mesh>(null);
  const stars = useRef<Object3D>(null);
  const lamps = useRef<PointLight[]>([]);
  const lastClock = useRef("");

  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    setEnvironment(scene, env);
    return () => {
      env.dispose();
      pmrem.dispose();
      setEnvironment(scene, null);
    };
  }, [gl, scene]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    advanceClock(dt);

    // Sun rises in the east (+X) at 06:00, sets in the west at 18:00
    const theta = ((sky.hour - 6) / 12) * Math.PI;
    const sunDir = new Vector3(Math.cos(theta), Math.sin(theta) * 0.92, 0.38).normalize();
    const elevation = sunDir.y;
    const day = MathUtils.smoothstep(elevation, -0.1, 0.18);
    const golden = 1 - MathUtils.smoothstep(Math.abs(elevation), 0.02, 0.4);
    const sunUp = elevation > -0.04;
    const lightDir = sunUp ? sunDir : sunDir.clone().negate().setY(Math.abs(sunDir.y) * 0.8 + 0.35).normalize();

    sky.night = 1 - day;
    sky.golden = golden * (sunUp ? 1 : 0.3);
    sky.lightPos.copy(lightDir).multiplyScalar(SKY_RADIUS);

    tmp.copy(C.skyNight).lerp(C.skyDay, day).lerp(C.skyDusk, golden * 0.55);
    applySky(scene, tmp, MathUtils.lerp(0.14, 0.55, day));

    if (hemi.current) {
      hemi.current.intensity = MathUtils.lerp(0.32, 1.1, day);
      hemi.current.color.copy(C.hemiNight).lerp(C.hemiDay, day).lerp(C.skyDusk, golden * 0.25);
      hemi.current.groundColor.copy(C.groundNight).lerp(C.groundDay, day);
    }
    if (sun.current) {
      sun.current.position.copy(lightDir).multiplyScalar(80);
      sun.current.intensity = sunUp ? MathUtils.lerp(0.15, 2.9, MathUtils.smoothstep(elevation, -0.04, 0.3)) : 0.38;
      if (sunUp) sun.current.color.copy(C.sun).lerp(C.sunset, golden);
      else sun.current.color.copy(C.moon);
    }
    if (disc.current) {
      disc.current.position.copy(sky.lightPos);
      disc.current.scale.setScalar(sunUp ? 15 + golden * 6 : 8);
      const mat = disc.current.material as MeshBasicMaterial;
      if (sunUp) mat.color.copy(C.discSun).lerp(C.discDusk, golden);
      else mat.color.copy(C.discMoon);
    }
    if (stars.current) {
      stars.current.visible = sky.night > 0.35;
      stars.current.rotation.y += dt * 0.004;
    }
    const n = sky.night;
    for (const l of lamps.current) if (l) l.intensity = MathUtils.lerp(3, 42, n);
    applyGlows(glows, MathUtils.lerp(0.6, 1.5, n));

    const h = Math.floor(sky.hour);
    const m = Math.floor(((sky.hour - h) * 60) / 10) * 10;
    const clock = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    if (clock !== lastClock.current) {
      lastClock.current = clock;
      useShowcase.getState().setClock(clock, n > 0.5);
    }
  });

  // Canopy, forecourt, street and underground fill lights; they matter most at night
  const lampSpots: [number, number, number, string][] = [
    [5, 5.5, 1.6, "#ffe2b0"],
    [-8, 5, 0, "#ffd9a8"],
    [5, 4, 13, "#ffcf8a"],
    [-12, 5, -12, "#ffe7c2"],
    [-20, 5, 19, "#ffc98a"],
    [24, 5, 19, "#ffc98a"],
    [12.2, -0.8, -9, "#cfe6ff"],
    [12.2, -0.8, 4, "#cfe6ff"],
    [12.2, -0.8, 20, "#ffb870"],
    [1.5, -0.6, -8, "#ffd2f0"],
    [-3, -0.6, -12, "#fff0c8"],
  ];

  return (
    <>
      <fog attach="fog" args={["#a8cdec", 70, 230]} />
      <hemisphereLight ref={hemi} args={["#dbeeff", "#6b7a52", 1.1]} />
      <directionalLight
        ref={sun}
        position={[-38, 55, 30]}
        intensity={2.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
        shadow-camera-near={1}
        shadow-camera-far={180}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      {/* The sun (or moon) disc — the god-rays source and lens-flare anchor */}
      <mesh
        ref={(m) => {
          disc.current = m;
          onDisc(m);
        }}
        position={[0, 300, 0]}
      >
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial color="#fff4c8" fog={false} toneMapped={false} />
      </mesh>
      <group ref={stars}>
        <Stars radius={360} depth={60} count={2500} factor={6} saturation={0.2} fade speed={0.6} />
      </group>
      {lampSpots.map(([x, y, z, color], i) => (
        <pointLight
          key={i}
          ref={(l) => {
            if (l) lamps.current[i] = l;
          }}
          position={[x, y, z]}
          color={color}
          intensity={3}
          distance={18}
          decay={1.6}
        />
      ))}
    </>
  );
}
