"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { introEase, TimeOfDay, TRIAL_CAMERA, TRIAL_INTRO } from "@/config/trial";

// Deterministic pseudo-random so the cloud bank is the same every load
const rand = (seed: number) => {
  const x = Math.sin(seed * 7919 + 104729) * 233280;
  return x - Math.floor(x);
};

const CLOUD_COUNT = 26;

const makeCloudTexture = () => {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  // A few overlapping soft blobs read as a puffy cloud rather than a disc
  for (let i = 0; i < 7; i++) {
    const x = size * (0.3 + rand(i) * 0.4);
    const y = size * (0.35 + rand(i + 10) * 0.3);
    const r = size * (0.18 + rand(i + 20) * 0.16);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.5, "rgba(255,255,255,0.45)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

/**
 * The cloud bank the intro camera dives through. Sprites are scattered around
 * the straight line from the intro start to the overview, so the camera passes
 * right through them; they fade out as the camera leaves them behind and the
 * whole bank hides once the intro is over.
 */
export default function IntroClouds({
  introStartRef,
  portrait,
  timeOfDay,
}: {
  // performance.now() when the intro began; null while still loading
  introStartRef: React.RefObject<number | null>;
  portrait: boolean;
  timeOfDay: TimeOfDay;
}) {
  const texture = useMemo(() => makeCloudTexture(), []);
  const clouds = useMemo(() => {
    const from = new THREE.Vector3(
      ...(portrait ? TRIAL_INTRO.portraitStartPosition : TRIAL_INTRO.startPosition),
    );
    const to = new THREE.Vector3(
      ...(portrait ? TRIAL_CAMERA.portraitPosition : TRIAL_CAMERA.position),
    );
    return Array.from({ length: CLOUD_COUNT }, (_, i) => {
      // Mid-flight: the dive starts with a clear view of the camp from above,
      // punches through the bank, and comes out over the treetops
      const along = 0.24 + rand(i + 100) * 0.38;
      const center = from.clone().lerp(to, along);
      const angle = rand(i + 200) * Math.PI * 2;
      const radius = 1.2 + rand(i + 300) * 5;
      center.x += Math.cos(angle) * radius * 1.6;
      center.y += Math.sin(angle) * radius * 0.8;
      return {
        position: center.toArray() as [number, number, number],
        size: 7 + rand(i + 400) * 9,
        along,
        opacity: 0.4 + rand(i + 500) * 0.4,
        spin: rand(i + 600) * Math.PI * 2,
      };
    });
  }, [portrait]);

  const group = useRef<THREE.Group>(null);
  const materials = useRef<THREE.SpriteMaterial[]>([]);
  const color = timeOfDay === "day" ? "#ffffff" : "#d9c9f5";

  useFrame(() => {
    if (!group.current) return;
    const introStart = introStartRef.current;
    if (introStart === null) {
      group.current.visible = true;
      return;
    }
    const t = (performance.now() - introStart) / TRIAL_INTRO.durationMs;
    group.current.visible = t < 1;
    if (t >= 1) return;
    const flown = introEase(t);
    clouds.forEach((cloud, i) => {
      const m = materials.current[i];
      if (!m) return;
      // Fade each puff out as the camera flies through it
      const passed = THREE.MathUtils.clamp((flown - cloud.along + 0.04) / 0.1, 0, 1);
      m.opacity = cloud.opacity * (1 - passed);
    });
  });

  return (
    <group ref={group}>
      {clouds.map((cloud, i) => (
        <sprite key={i} position={cloud.position} scale={[cloud.size, cloud.size * 0.6, 1]}>
          <spriteMaterial
            ref={(m) => {
              if (m) materials.current[i] = m;
            }}
            map={texture}
            color={color}
            rotation={cloud.spin}
            transparent
            opacity={cloud.opacity}
            depthWrite={false}
            fog={false}
          />
        </sprite>
      ))}
    </group>
  );
}
