"use client";

import { createContext, useContext, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Sparkles, Stars } from "@react-three/drei";
import { TimeOfDay, TRIAL_CAMERA, TRIAL_CAMPFIRE_POSITION } from "@/config/trial";

// Deterministic pseudo-random so every load builds the same camp
const rand = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

/* ------------------------------ Day / night ------------------------------ */

const c = (hex: string) => new THREE.Color(hex);

// [night, day] pairs; fog and the sky's horizon share a colour so the
// treeline melts into the sky
const PALETTE = {
  skyTop: [c("#0d0a26"), c("#3d8bf0")],
  skyMid: [c("#3a2468"), c("#7cc4ff")],
  skyGlow: [c("#d9708a"), c("#fff1c9")],
  fog: [c("#4a3566"), c("#bfe0f0")],
  grass: [c("#2c4a4a"), c("#5d9a4f")],
  dirt: [c("#5b4636"), c("#a07a55")],
  hemiSky: [c("#8f7dff"), c("#dff1ff")],
  hemiGround: [c("#2a1d3a"), c("#6b8f4e")],
  keyLight: [c("#b9c4ff"), c("#fff2dc")],
  mist: [c("#d8c6ff"), c("#ffffff")],
} as const;

type PaletteKey = keyof typeof PALETTE;
const mixColor = (target: THREE.Color, key: PaletteKey, t: number) =>
  target.lerpColors(PALETTE[key][0], PALETTE[key][1], t);
const mix = (night: number, day: number, t: number) => night + (day - night) * t;

const KEY_LIGHT_NIGHT = new THREE.Vector3(-8, 14, -6);
const KEY_LIGHT_DAY = new THREE.Vector3(7, 15, 8);

// 0 = night, 1 = day; eased toward the toggle every frame
const DaylightContext = createContext<{ current: number }>({ current: 0 });
const useDaylight = () => useContext(DaylightContext);

/* ---------------------------------- Sky ---------------------------------- */

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const skyFragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uGlow;
  uniform vec3 uHorizon;
  varying vec3 vDir;
  void main() {
    float h = vDir.y;
    vec3 col = mix(uHorizon, uGlow, smoothstep(-0.02, 0.06, h));
    col = mix(col, uMid, smoothstep(0.06, 0.3, h));
    col = mix(col, uTop, smoothstep(0.3, 0.85, h));
    gl_FragColor = vec4(col, 1.0);
  }
`;

function Sky() {
  const daylight = useDaylight();
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color() },
      uMid: { value: new THREE.Color() },
      uGlow: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
    }),
    [],
  );
  useFrame(() => {
    const u = material.current?.uniforms;
    if (!u) return;
    const t = daylight.current;
    mixColor(u.uTop!.value, "skyTop", t);
    mixColor(u.uMid!.value, "skyMid", t);
    mixColor(u.uGlow!.value, "skyGlow", t);
    mixColor(u.uHorizon!.value, "fog", t);
  });
  return (
    <mesh renderOrder={-1}>
      <sphereGeometry args={[80, 32, 16]} />
      <shaderMaterial
        ref={material}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
        uniforms={uniforms}
        vertexShader={skyVertex}
        fragmentShader={skyFragment}
      />
    </mesh>
  );
}

// A glowing disc with two soft halos; fades in when `visibleAt` matches
function CelestialBody({
  position,
  color,
  halo,
  radius,
  daytime,
}: {
  position: [number, number, number];
  color: string;
  halo: string;
  radius: number;
  daytime: boolean;
}) {
  const daylight = useDaylight();
  const group = useRef<THREE.Group>(null);
  const materials = useRef<THREE.MeshBasicMaterial[]>([]);
  const baseOpacity = [1, 0.14, 0.06];
  useFrame(() => {
    const t = daytime ? daylight.current : 1 - daylight.current;
    if (group.current) group.current.visible = t > 0.01;
    materials.current.forEach((m, i) => {
      if (m) m.opacity = baseOpacity[i]! * t;
    });
  });
  return (
    <group ref={group} position={position}>
      {[radius, radius * 1.7, radius * 2.7].map((r, i) => (
        <mesh key={r}>
          <sphereGeometry args={[r, 32, 16]} />
          <meshBasicMaterial
            ref={(m) => {
              if (m) materials.current[i] = m;
            }}
            color={i === 0 ? color : halo}
            transparent
            depthWrite={false}
            fog={false}
            toneMapped={i !== 0}
            blending={i === 0 ? THREE.NormalBlending : THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

// Puffy daytime clouds drifting across the sky
function Clouds() {
  const daylight = useDaylight();
  const group = useRef<THREE.Group>(null);
  const materials = useRef<THREE.MeshLambertMaterial[]>([]);
  const clouds = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => {
        const a = -Math.PI * 0.85 + (i / 9) * Math.PI * 0.7 + rand(i + 5000) * 0.2;
        const r = 42 + rand(i + 5100) * 10;
        return {
          position: [Math.cos(a) * r, 13 + rand(i + 5200) * 8, Math.sin(a) * r] as [
            number,
            number,
            number,
          ],
          scale: 2.2 + rand(i + 5300) * 1.8,
          puffs: Array.from({ length: 5 }, (_, j) => ({
            offset: [(j - 2) * 1.1, rand(i * 10 + j) * 0.6, rand(i * 10 + j + 1) * 0.6] as [
              number,
              number,
              number,
            ],
            r: 0.8 + rand(i * 10 + j + 2) * 0.7 - Math.abs(j - 2) * 0.15,
          })),
        };
      }),
    [],
  );
  useFrame(({ clock }) => {
    const t = daylight.current;
    if (group.current) {
      group.current.visible = t > 0.01;
      group.current.rotation.y = clock.elapsedTime * 0.004;
    }
    materials.current.forEach((m) => {
      if (m) m.opacity = 0.95 * t;
    });
  });
  return (
    <group ref={group}>
      {clouds.map((cloud, i) => (
        <group key={i} position={cloud.position} scale={cloud.scale}>
          {cloud.puffs.map((p, j) => (
            <mesh key={j} position={p.offset}>
              <sphereGeometry args={[p.r, 14, 10]} />
              <meshLambertMaterial
                ref={(m) => {
                  if (m) materials.current[i * cloud.puffs.length + j] = m;
                }}
                color="#ffffff"
                emissive="#cfe2ff"
                emissiveIntensity={0.55}
                transparent
                fog={false}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/* --------------------------------- Ground -------------------------------- */

function Ground() {
  const daylight = useDaylight();
  const grass = useRef<THREE.MeshStandardMaterial>(null);
  const dirt = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const t = daylight.current;
    if (grass.current) mixColor(grass.current.color, "grass", t);
    if (dirt.current) mixColor(dirt.current.color, "dirt", t);
  });
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[60, 64]} />
        <meshStandardMaterial ref={grass} roughness={1} />
      </mesh>
      {/* Trampled dirt clearing around the fire */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 0.3]} receiveShadow>
        <circleGeometry args={[5, 48]} />
        <meshStandardMaterial ref={dirt} roughness={1} />
      </mesh>
    </group>
  );
}

/* ------------------------------- Campfire -------------------------------- */

function Flame({
  color,
  radius,
  height,
  offset,
}: {
  color: string;
  radius: number;
  height: number;
  offset: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 9 + offset;
    if (!ref.current) return;
    const s = 1 + Math.sin(t) * 0.12 + Math.sin(t * 2.3) * 0.06;
    ref.current.scale.set(1 - (s - 1) * 0.5, s, 1 - (s - 1) * 0.5);
    ref.current.rotation.y = t * 0.15;
  });
  return (
    <mesh ref={ref} position-y={height / 2 + 0.05}>
      <coneGeometry args={[radius, height, 7]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.85}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}

function Campfire() {
  const daylight = useDaylight();
  const lightRef = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (lightRef.current) {
      const flicker = 9 + Math.sin(t * 11) * 1.2 + Math.sin(t * 23.7) * 0.8;
      // Sunlight drowns the fire out, so it only matters at night
      lightRef.current.intensity = flicker * mix(1, 0.35, daylight.current);
      // At night the fire is the key light, so its shadows lead
      lightRef.current.shadow.intensity = mix(1, 0, daylight.current);
    }
  });

  const stones = useMemo(
    () =>
      Array.from({ length: 11 }, (_, i) => {
        const a = (i / 11) * Math.PI * 2;
        return {
          position: [Math.cos(a) * 0.62, 0.08, Math.sin(a) * 0.62] as const,
          scale: 0.13 + rand(i + 40) * 0.06,
          rotation: rand(i + 60) * Math.PI,
        };
      }),
    [],
  );

  return (
    <group position={TRIAL_CAMPFIRE_POSITION}>
      {stones.map((s, i) => (
        <mesh
          key={i}
          position={s.position}
          rotation={[s.rotation, s.rotation, 0]}
          scale={s.scale}
          castShadow
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#6b6f80" roughness={0.9} flatShading />
        </mesh>
      ))}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position-y={0.12} rotation={[0, (i / 3) * Math.PI, Math.PI / 2 - 0.25]}>
          <cylinderGeometry args={[0.07, 0.08, 0.95, 6]} />
          <meshStandardMaterial color="#4a2e1c" roughness={1} />
        </mesh>
      ))}
      <Flame color="#ff5a1f" radius={0.32} height={0.85} offset={0} />
      <Flame color="#ff9a2e" radius={0.22} height={0.7} offset={1.7} />
      <Flame color="#ffe27a" radius={0.12} height={0.48} offset={3.1} />
      {/* Casts the night shadows, radiating out from the fire */}
      <pointLight
        ref={lightRef}
        position-y={0.7}
        color="#ff8a3d"
        distance={11}
        decay={1.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.1}
        shadow-camera-far={12}
        shadow-bias={-0.002}
        shadow-radius={4}
      />
      <Sparkles
        count={36}
        position-y={1.1}
        scale={[0.9, 1.8, 0.9]}
        size={3}
        speed={1.4}
        color="#ffb347"
        noise={2}
      />
    </group>
  );
}

/* ---------------------------------- Camp --------------------------------- */

function Tent({
  position,
  rotation,
  color,
  trim,
}: {
  position: [number, number, number];
  rotation: number;
  color: string;
  trim: string;
}) {
  return (
    <group position={position} rotation-y={rotation}>
      <mesh position-y={0.55} castShadow receiveShadow>
        <cylinderGeometry args={[1.85, 1.85, 1.1, 6]} />
        <meshStandardMaterial color={color} roughness={0.9} flatShading />
      </mesh>
      <mesh position-y={1.6} castShadow>
        <coneGeometry args={[2.1, 1.2, 6]} />
        <meshStandardMaterial color={trim} roughness={0.8} flatShading />
      </mesh>
      {/* Doorway with warm light spilling out */}
      <mesh position={[0, 0.5, 1.62]}>
        <planeGeometry args={[0.8, 1]} />
        <meshBasicMaterial color="#ffb86b" toneMapped={false} />
      </mesh>
      <pointLight position={[0, 0.6, 2.1]} color="#ffb86b" intensity={2.5} distance={4} />
      <mesh position-y={2.45}>
        <cylinderGeometry args={[0.03, 0.03, 0.6, 6]} />
        <meshStandardMaterial color="#c8aa6e" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position-y={2.8}>
        <octahedronGeometry args={[0.14, 0]} />
        <meshStandardMaterial color="#ffd36b" emissive="#ffb000" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

// Pinned along the top edge, swinging more toward the bottom
const waveFlag = (geometry: THREE.BufferGeometry, base: Float32Array, t: number) => {
  const pos = geometry.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3]!;
    const y = base[i * 3 + 1]!;
    pos.setZ(i, Math.sin(t + x * 3 + y * 2) * (0.65 - y) * 0.12);
  }
  pos.needsUpdate = true;
};

function Banner({ position, color }: { position: [number, number, number]; color: string }) {
  const geometry = useMemo(() => new THREE.PlaneGeometry(0.7, 1.3, 8, 8), []);
  const base = useMemo(
    () => Float32Array.from(geometry.getAttribute("position").array),
    [geometry],
  );
  useFrame(({ clock }) => waveFlag(geometry, base, clock.elapsedTime * 2.2));
  return (
    <group position={position}>
      <mesh position-y={1.4} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 2.8, 6]} />
        <meshStandardMaterial color="#3b2a1e" />
      </mesh>
      <mesh position-y={2.85}>
        <coneGeometry args={[0.08, 0.25, 6]} />
        <meshStandardMaterial color="#ffd36b" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 2.05, 0.06]} geometry={geometry}>
        <meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={0.8} />
      </mesh>
    </group>
  );
}

const BULB_COLORS = ["#ff6fb5", "#ffd36b", "#6ff2ff", "#b3ff6f", "#c69bff"];

function StringLights({
  from,
  to,
  sag,
  count,
}: {
  from: [number, number, number];
  to: [number, number, number];
  sag: number;
  count: number;
}) {
  const daylight = useDaylight();
  const { curve, bulbs } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const mid = a.clone().lerp(b, 0.5);
    mid.y -= sag;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const bulbs = Array.from({ length: count }, (_, i) => curve.getPoint((i + 0.5) / count));
    return { curve, bulbs };
  }, [from, to, sag, count]);

  const materials = useRef<THREE.MeshStandardMaterial[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const strength = mix(1, 0.45, daylight.current);
    materials.current.forEach((m, i) => {
      if (m) m.emissiveIntensity = (1.6 + Math.sin(t * 2 + i * 1.3) * 0.9) * strength;
    });
  });

  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 32, 0.012, 4, false]} />
        <meshStandardMaterial color="#1a1a22" />
      </mesh>
      {bulbs.map((p, i) => {
        const color = BULB_COLORS[i % BULB_COLORS.length]!;
        return (
          <mesh key={i} position={p}>
            <sphereGeometry args={[0.05, 10, 8]} />
            <meshStandardMaterial
              ref={(m) => {
                if (m) materials.current[i] = m;
              }}
              color={color}
              emissive={color}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function Barrel({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position-y={0.4} castShadow receiveShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.8, 12]} />
        <meshStandardMaterial color="#7a4a2a" roughness={0.9} />
      </mesh>
      {[0.15, 0.65].map((y) => (
        <mesh key={y} position-y={y}>
          <torusGeometry args={[0.305, 0.02, 4, 16]} />
          <meshStandardMaterial color="#3b3f4a" metalness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function Chest({
  position,
  rotation = 0,
}: {
  position: [number, number, number];
  rotation?: number;
}) {
  return (
    <group position={position} rotation-y={rotation}>
      <mesh position-y={0.25} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.5, 0.55]} />
        <meshStandardMaterial color="#6b3f22" roughness={0.9} />
      </mesh>
      <mesh position-y={0.55} rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.275, 0.275, 0.9, 12, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#7d4a28" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.48, 0.28]}>
        <boxGeometry args={[0.14, 0.18, 0.04]} />
        <meshStandardMaterial color="#ffd36b" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

function GlowMushrooms() {
  const items = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const a = rand(i + 700) * Math.PI * 2;
        const r = 5.2 + rand(i + 800) * 3;
        return {
          position: [Math.cos(a) * r, 0, Math.sin(a) * r - 1] as [number, number, number],
          scale: 0.6 + rand(i + 900) * 0.8,
          color: rand(i + 950) > 0.5 ? "#6ff2ff" : "#ff7ad9",
        };
      }).filter((m) => m.position[2] < 3),
    [],
  );
  return (
    <group>
      {items.map((m, i) => (
        <group key={i} position={m.position} scale={m.scale}>
          <mesh position-y={0.1}>
            <cylinderGeometry args={[0.03, 0.04, 0.2, 6]} />
            <meshStandardMaterial color="#e8e0d0" />
          </mesh>
          <mesh position-y={0.22}>
            <sphereGeometry args={[0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial
              color={m.color}
              emissive={m.color}
              emissiveIntensity={1.5}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* --------------------------------- Forest -------------------------------- */

const TREE_GREENS = ["#1f4d4a", "#26584f", "#1c3f4f", "#2d5e46"];

function Forest() {
  const trees = useMemo(() => {
    const list: { position: [number, number, number]; scale: number; color: string }[] = [];
    for (let i = 0; i < 70; i++) {
      const a = rand(i) * Math.PI * 2;
      const r = 8 + rand(i + 1000) * 16;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r - 2;
      // Keep the camera's line of sight open
      if (z > 2 && Math.abs(x) < 9) continue;
      list.push({
        position: [x, 0, z],
        scale: 0.8 + rand(i + 2000) * 1.1,
        color: TREE_GREENS[i % TREE_GREENS.length]!,
      });
    }
    return list;
  }, []);

  // Shared geometry + materials across every tree
  const geo = useMemo(
    () => ({
      trunk: new THREE.CylinderGeometry(0.12, 0.18, 1, 6),
      cone: new THREE.ConeGeometry(1, 1, 7),
    }),
    [],
  );
  const mats = useMemo(
    () => ({
      trunk: new THREE.MeshStandardMaterial({ color: "#3b2a1e", roughness: 1 }),
      snow: new THREE.MeshStandardMaterial({ color: "#e9ecff", roughness: 1 }),
      greens: Object.fromEntries(
        TREE_GREENS.map((color) => [
          color,
          new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }),
        ]),
      ),
    }),
    [],
  );

  return (
    <group>
      {trees.map((t, i) => (
        <group key={i} position={t.position} scale={t.scale}>
          <mesh geometry={geo.trunk} material={mats.trunk} position-y={0.5} />
          {[0, 1, 2].map((tier) => (
            <mesh
              key={tier}
              geometry={geo.cone}
              material={mats.greens[t.color]}
              position-y={1.3 + tier * 0.8}
              scale={[1.3 - tier * 0.32, 1.4, 1.3 - tier * 0.32]}
              castShadow={i % 3 === 0}
            />
          ))}
          <mesh geometry={geo.cone} material={mats.snow} position-y={3.25} scale={[0.28, 0.4, 0.28]} />
        </group>
      ))}
    </group>
  );
}

/* ---------------------------------- Mist --------------------------------- */

function useMistTexture() {
  return useMemo(() => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.4, "rgba(255,255,255,0.45)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
}

// Low drifting mist banks behind and beside the camp
function Mist() {
  const daylight = useDaylight();
  const texture = useMistTexture();
  const banks = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => {
        const side = i % 2 === 0 ? -1 : 1;
        return {
          x: side * (2 + rand(i + 3000) * 10),
          y: 0.4 + rand(i + 3100) * 0.6,
          z: -3 - rand(i + 3200) * 9,
          w: 6 + rand(i + 3300) * 6,
          h: 1.6 + rand(i + 3400) * 1.2,
          speed: 0.08 + rand(i + 3500) * 0.12,
          phase: rand(i + 3600) * Math.PI * 2,
          opacity: 0.12 + rand(i + 3700) * 0.12,
        };
      }),
    [],
  );
  const refs = useRef<(THREE.Sprite | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    banks.forEach((b, i) => {
      const s = refs.current[i];
      if (!s) return;
      s.position.x = b.x + Math.sin(t * b.speed + b.phase) * 1.5;
      mixColor(s.material.color, "mist", daylight.current);
    });
  });
  return (
    <group>
      {banks.map((b, i) => (
        <sprite
          key={i}
          ref={(s) => {
            refs.current[i] = s;
          }}
          position={[b.x, b.y, b.z]}
          scale={[b.w, b.h, 1]}
        >
          <spriteMaterial map={texture} transparent opacity={b.opacity} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}

/* --------------------------------- Scene --------------------------------- */

// Fog, lights and night-only extras that follow the daylight value
function Atmosphere() {
  const daylight = useDaylight();
  const fog = useRef<THREE.Fog>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const ambient = useRef<THREE.AmbientLight>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const nightOnly = useRef<THREE.Group>(null);

  useFrame(({ camera }) => {
    const t = daylight.current;
    if (fog.current) {
      mixColor(fog.current.color, "fog", t);
      // Fog is tuned for the landscape overview; push it back when the camera
      // sits further out (portrait overview, mobile focus) so legends stay clear
      const pushBack = Math.max(0, camera.position.z - TRIAL_CAMERA.position[2]);
      fog.current.near = mix(9, 12, t) + pushBack;
      fog.current.far = mix(32, 46, t) + pushBack;
    }
    if (hemi.current) {
      mixColor(hemi.current.color, "hemiSky", t);
      mixColor(hemi.current.groundColor, "hemiGround", t);
      hemi.current.intensity = mix(0.7, 1.1, t);
    }
    if (ambient.current) ambient.current.intensity = mix(0.25, 0.45, t);
    if (key.current) {
      mixColor(key.current.color, "keyLight", t);
      key.current.intensity = mix(1.1, 2.4, t);
      key.current.position.lerpVectors(KEY_LIGHT_NIGHT, KEY_LIGHT_DAY, t);
      // Moon shadows stay faint so they don't fight the campfire's
      key.current.shadow.intensity = mix(0.25, 1, t);
    }
    if (nightOnly.current) nightOnly.current.visible = t < 0.5;
  });

  return (
    <>
      <fog ref={fog} attach="fog" args={["#4a3566", 9, 32]} />
      <hemisphereLight ref={hemi} />
      <ambientLight ref={ambient} />
      {/* Moonlight at night, sunlight by day; the campfire supplies the warm key */}
      <directionalLight
        ref={key}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={1}
        shadow-camera-far={50}
        shadow-bias={-0.0005}
      />
      {/* Soft front fill so faces don't sink into the dark */}
      <directionalLight position={[0, 4, 10]} color="#ffd9c2" intensity={0.6} />

      <group ref={nightOnly}>
        <Stars radius={60} depth={15} count={1800} factor={3} saturation={0.4} fade speed={0.6} />
        {/* Fireflies drifting over the clearing */}
        <Sparkles
          count={90}
          position={[0, 1.8, -3]}
          scale={[22, 3.5, 14]}
          size={4}
          speed={0.3}
          color="#c6ff7a"
          noise={1}
        />
      </group>
    </>
  );
}

export default function CampEnvironment({ timeOfDay }: { timeOfDay: TimeOfDay }) {
  // Starts at the requested time so the first frame doesn't fade in from night
  const daylight = useRef(timeOfDay === "day" ? 1 : 0);
  useFrame((_, delta) => {
    const target = timeOfDay === "day" ? 1 : 0;
    const next = THREE.MathUtils.damp(daylight.current, target, 1.6, Math.min(delta, 0.1));
    daylight.current = Math.abs(next - target) < 0.001 ? target : next;
  });

  return (
    <DaylightContext.Provider value={daylight}>
      <Atmosphere />

      <Sky />
      <CelestialBody position={[-18, 20, -50]} color="#fff4d6" halo="#ffd9f0" radius={3} daytime={false} />
      <CelestialBody position={[22, 26, -48]} color="#fffbe6" halo="#ffe8a3" radius={3.6} daytime />
      <Clouds />

      <Ground />
      <Forest />
      <Campfire />

      <Tent position={[-5.4, 0, -2.6]} rotation={0.55} color="#e8dcc4" trim="#7c3aed" />
      <Tent position={[5.4, 0, -2.9]} rotation={-0.55} color="#e8dcc4" trim="#0e9f9a" />
      <Banner position={[-3.3, 0, -2.1]} color="#7c3aed" />
      <Banner position={[3.4, 0, -2.3]} color="#dc2626" />
      <StringLights from={[-3.3, 2.7, -2.1]} to={[3.4, 2.7, -2.3]} sag={0.7} count={22} />

      <Chest position={[0, 0, -2.6]} />
      <Chest position={[0.15, 0.5, -2.65]} rotation={0.2} />
      <Barrel position={[3.6, 0, 1.6]} />
      <Barrel position={[4.1, 0, 1.1]} />
      <Barrel position={[-4, 0, 0.4]} />
      <GlowMushrooms />

      <Mist />
    </DaylightContext.Provider>
  );
}
