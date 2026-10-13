"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PERCH_HOME } from "@/components/owl-world/flightPath";
import Vegetation, { PERCH_TRUNK } from "@/components/owl-world/Vegetation";
import Mailbox from "@/components/owl-world/Mailbox";
import { HomeShadowLight } from "@/components/owl-world/shadows";

/**
 * The owl's home: a two-storey cottage at dusk, the tree whose branch it
 * sits on, the meadow and the woods the flight passes over. All primitives.
 */

const C = {
  wall: "#f1e6d4",
  wallUpper: "#f6eee2",
  timber: "#5d4030",
  roof: "#a44f38",
  roofDark: "#8b3f2c",
  stone: "#9a8f80",
  brick: "#9c5a44",
  shutter: "#7f9a7a",
  door: "#6e4530",
  glass: "#ffd9a0",
  glassGlow: "#ffae4a",
  grass: "#4f6040",
  path: "#7d6f5c",
  bark: "#6b4b36",
  leaves: ["#6d8b4a", "#7fa055", "#5e7d40", "#8aa85e"],
  flowers: ["#e06b6b", "#f2c14e", "#e88fb3", "#f5f0e6"],
};

function useMats() {
  return useMemo(() => {
    const std = (color: string, roughness = 0.85, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
    return {
      wall: std(C.wall),
      wallUpper: std(C.wallUpper),
      timber: std(C.timber, 0.7),
      roof: std(C.roof, 0.75),
      roofDark: std(C.roofDark, 0.8),
      stone: std(C.stone, 0.95),
      brick: std(C.brick, 0.9),
      shutter: std(C.shutter, 0.7),
      door: std(C.door, 0.6),
      glass: std(C.glass, 0.3, { emissive: new THREE.Color(C.glassGlow), emissiveIntensity: 3.2 }),
      bulb: std("#fff2d0", 0.3, { emissive: new THREE.Color("#ffc46b"), emissiveIntensity: 4, toneMapped: false }),
      grass: std(C.grass, 1),
      path: std(C.path, 1),
      bark: std("#5b4433", 1),
      leafFall: std("#8aa85e", 0.8, { side: THREE.DoubleSide, emissive: new THREE.Color("#2c3a1c"), emissiveIntensity: 0.6 }),
      flowers: C.flowers.map((c) => std(c, 0.8)),
      metal: std("#2f2b28", 0.5, { metalness: 0.6 }),
    };
  }, []);
}
type Mats = ReturnType<typeof useMats>;

function Window({ m, w, h, position, shutters = false, rotationY = 0 }: { m: Mats; w: number; h: number; position: [number, number, number]; shutters?: boolean; rotationY?: number }) {
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh material={m.timber}>
        <boxGeometry args={[w + 0.18, h + 0.18, 0.1]} />
      </mesh>
      <mesh material={m.glass} position-z={0.052}>
        <planeGeometry args={[w, h]} />
      </mesh>
      {/* Mullions */}
      <mesh material={m.timber} position-z={0.07}>
        <boxGeometry args={[0.06, h, 0.04]} />
      </mesh>
      <mesh material={m.timber} position-z={0.07}>
        <boxGeometry args={[w, 0.06, 0.04]} />
      </mesh>
      {/* Sill */}
      <mesh material={m.wall} position={[0, -h / 2 - 0.12, 0.1]}>
        <boxGeometry args={[w + 0.36, 0.08, 0.22]} />
      </mesh>
      {shutters &&
        [-1, 1].map((s) => (
          <mesh key={s} material={m.shutter} position={[s * (w / 2 + 0.36), 0, 0.04]}>
            <boxGeometry args={[0.46, h + 0.1, 0.06]} />
          </mesh>
        ))}
    </group>
  );
}

function FlowerBox({ m, width, position }: { m: Mats; width: number; position: [number, number, number] }) {
  const blooms = useMemo(
    () => Array.from({ length: Math.round(width * 6) }, (_, i) => ({ x: -width / 2 + 0.08 + (i / (width * 6)) * (width - 0.1), c: i % 4, s: 0.07 + ((i * 37) % 5) * 0.012 })),
    [width],
  );
  return (
    <group position={position}>
      <mesh material={m.timber}>
        <boxGeometry args={[width, 0.2, 0.26]} />
      </mesh>
      {blooms.map((b, i) => (
        <mesh key={i} material={m.flowers[b.c]} position={[b.x, 0.14 + (i % 2) * 0.05, (i % 3) * 0.06 - 0.06]}>
          <icosahedronGeometry args={[b.s, 0]} />
        </mesh>
      ))}
    </group>
  );
}

function Roof({ m, width, depth, rise, overhang, y }: { m: Mats; width: number; depth: number; rise: number; overhang: number; y: number }) {
  const half = depth / 2 + overhang;
  const slope = Math.hypot(half, rise);
  const angle = Math.atan2(rise, half);
  const gable = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-depth / 2, 0);
    s.lineTo(depth / 2, 0);
    s.lineTo(0, rise * (depth / 2 / half));
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false });
    g.translate(0, 0, -width / 2);
    g.rotateY(Math.PI / 2);
    return g;
  }, [width, depth, rise, half]);
  return (
    <group position-y={y}>
      <mesh geometry={gable} material={m.wallUpper} />
      {[1, -1].map((s) => (
        <mesh key={s} material={m.roof} position={[0, rise / 2 + 0.06, (s * half) / 2]} rotation-x={s * angle}>
          <boxGeometry args={[width + overhang * 2, 0.16, slope + 0.1]} />
        </mesh>
      ))}
      {/* Ridge */}
      <mesh material={m.roofDark} position-y={rise + 0.1} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.12, 0.12, width + overhang * 2 + 0.05, 8]} />
      </mesh>
    </group>
  );
}

// Where the cottage stands; its front (local +Z) faces the perch tree
export const HOUSE_POSITION = new THREE.Vector3(2.8, 0, -11.5);
export const HOUSE_YAW = -0.22;

function House({ m }: { m: Mats }) {
  const W = 7;
  const D = 6;
  const H = 4.6;
  return (
    <group position={HOUSE_POSITION} rotation-y={HOUSE_YAW}>
      {/* Plinth and body */}
      <mesh material={m.stone} position-y={0.2}>
        <boxGeometry args={[W + 0.4, 0.4, D + 0.4]} />
      </mesh>
      <mesh material={m.wall} position-y={0.4 + 1.2}>
        <boxGeometry args={[W, 2.4, D]} />
      </mesh>
      <mesh material={m.wallUpper} position-y={2.8 + 1.1}>
        <boxGeometry args={[W, 2.2, D]} />
      </mesh>
      {/* Floor band and corner posts (timber frame) */}
      <mesh material={m.timber} position-y={2.8}>
        <boxGeometry args={[W + 0.08, 0.16, D + 0.08]} />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} material={m.timber} position={[(sx * W) / 2, 0.4 + H / 2, (sz * D) / 2]}>
            <boxGeometry args={[0.18, H, 0.18]} />
          </mesh>
        )),
      )}
      {/* Upper-floor cross braces on the front */}
      {[-2.4, 0, 2.4].map((x) => (
        <mesh key={x} material={m.timber} position={[x + 1.2, 3.9, D / 2 + 0.03]} rotation-z={x === 0 ? 0.62 : -0.62}>
          <boxGeometry args={[0.1, 2.3, 0.06]} />
        </mesh>
      ))}
      <Roof m={m} width={W} depth={D} rise={2.7} overhang={0.5} y={0.4 + H} />

      {/* Chimney */}
      <group position={[2.1, 0, -1.1]}>
        <mesh material={m.brick} position-y={6.9}>
          <boxGeometry args={[0.75, 2.4, 0.75]} />
        </mesh>
        <mesh material={m.stone} position-y={8.15}>
          <boxGeometry args={[0.92, 0.16, 0.92]} />
        </mesh>
      </group>

      {/* Front: door with a little porch roof, windows with shutters */}
      <group position-z={D / 2 + 0.01}>
        <mesh material={m.timber} position={[0, 1.55, 0.02]}>
          <boxGeometry args={[1.3, 2.4, 0.08]} />
        </mesh>
        <mesh material={m.door} position={[0, 1.5, 0.07]}>
          <boxGeometry args={[1.05, 2.2, 0.06]} />
        </mesh>
        <mesh material={m.glass} position={[0, 2.25, 0.105]}>
          <circleGeometry args={[0.22, 16]} />
        </mesh>
        <mesh material={m.metal} position={[0.38, 1.45, 0.12]}>
          <sphereGeometry args={[0.05, 8, 8]} />
        </mesh>
        <mesh material={m.roof} position={[0, 3.0, 0.45]} rotation-x={0.35}>
          <boxGeometry args={[2.0, 0.1, 1.05]} />
        </mesh>
        {[-0.85, 0.85].map((x) => (
          <mesh key={x} material={m.timber} position={[x, 1.65, 0.85]}>
            <boxGeometry args={[0.1, 2.5, 0.1]} />
          </mesh>
        ))}
        {/* Steps */}
        {[0, 1].map((i) => (
          <mesh key={i} material={m.stone} position={[0, 0.1 + i * 0.15, 0.95 - i * 0.3]}>
            <boxGeometry args={[1.8 - i * 0.3, 0.2 + i * 0.1, 0.6]} />
          </mesh>
        ))}
        {[-2.3, 2.3].map((x) => (
          <group key={x}>
            <Window m={m} w={1.1} h={1.3} position={[x, 1.75, 0]} shutters />
            <FlowerBox m={m} width={1.3} position={[x, 0.92, 0.2]} />
          </group>
        ))}
        {[-2.4, 0, 2.4].map((x) => (
          <Window key={x} m={m} w={0.95} h={1.05} position={[x, 3.95, 0]} />
        ))}
      </group>

      {/* Side facing the camera: two windows and a round gable window */}
      <group position-x={W / 2 + 0.01} rotation-y={Math.PI / 2}>
        <Window m={m} w={1} h={1.2} position={[-1.3, 1.75, 0]} shutters />
        <Window m={m} w={1} h={1.2} position={[1.3, 1.75, 0]} shutters />
        <Window m={m} w={0.9} h={1} position={[0, 3.95, 0]} />
        <mesh material={m.timber} position={[0, 5.9, 0]}>
          <torusGeometry args={[0.42, 0.07, 8, 24]} />
        </mesh>
        <mesh material={m.glass} position={[0, 5.9, 0.01]}>
          <circleGeometry args={[0.4, 24]} />
        </mesh>
      </group>
      <group position-x={-W / 2 - 0.01} rotation-y={-Math.PI / 2}>
        <Window m={m} w={1} h={1.2} position={[0, 1.75, 0]} shutters />
        <Window m={m} w={0.9} h={1} position={[0, 3.95, 0]} />
      </group>

      {/* Lantern by the path */}
      <group position={[-2.6, 0, D / 2 + 2.2]} userData={{ noShadow: true }}>
        <mesh material={m.metal} position-y={1.1}>
          <cylinderGeometry args={[0.05, 0.07, 2.2, 8]} />
        </mesh>
        <mesh material={m.bulb} position-y={2.3}>
          <sphereGeometry args={[0.16, 12, 12]} />
        </mesh>
        <mesh material={m.metal} position-y={2.5}>
          <coneGeometry args={[0.24, 0.2, 6]} />
        </mesh>
        <HomeShadowLight position-y={2.3} color="#ffbe6b" intensity={9} distance={9} decay={2} far={9} />
      </group>
      {/* Garden path */}
      <mesh material={m.path} rotation-x={-Math.PI / 2} position={[0, 0.015, D / 2 + 4.5]}>
        <planeGeometry args={[1.5, 8]} />
      </mesh>
      {/* Picket fence along the front garden */}
      {/* Window light spilling onto the garden */}
      <pointLight position={[0, 2.2, D / 2 + 1.6]} color="#ffab55" intensity={14} distance={11} decay={2} />
      <Fence m={m} from={[-4.8, D / 2 + 5]} to={[-0.9, D / 2 + 5]} />
      <Fence m={m} from={[0.9, D / 2 + 5]} to={[4.8, D / 2 + 5]} />
    </group>
  );
}

function Fence({ m, from, to }: { m: Mats; from: [number, number]; to: [number, number] }) {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const n = Math.round(len / 0.32);
  return (
    <group position={[from[0], 0, from[1]]} rotation-y={-Math.atan2(to[1] - from[1], to[0] - from[0])}>
      {Array.from({ length: n + 1 }, (_, i) => (
        <mesh key={i} material={m.wall} position={[(i / n) * len, 0.42, 0]}>
          <boxGeometry args={[0.09, 0.84, 0.05]} />
        </mesh>
      ))}
      {[0.3, 0.62].map((y) => (
        <mesh key={y} material={m.wall} position={[len / 2, y, -0.04]}>
          <boxGeometry args={[len, 0.07, 0.04]} />
        </mesh>
      ))}
    </group>
  );
}

// Cylinder spanning two points
function Limb({ a, b, r0, r1, material }: { a: THREE.Vector3; b: THREE.Vector3; r0: number; r1: number; material: THREE.Material }) {
  const { pos, quat, len } = useMemo(() => {
    const dir = new THREE.Vector3().subVectors(b, a);
    return {
      pos: new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5),
      quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()),
      len: dir.length(),
    };
  }, [a, b]);
  return (
    <mesh material={material} position={pos} quaternion={quat}>
      <cylinderGeometry args={[r1, r0, len, 7]} />
    </mesh>
  );
}

// The branch passes just under the owl's feet
// The tree stands to the owl's left so the trunk frames the shot instead of
// splitting it
const TRUNK = PERCH_TRUNK;
const BRANCH_A = new THREE.Vector3(-1.5, 2.6, -1.0);
const PERCH_UNDER = new THREE.Vector3(PERCH_HOME.x, PERCH_HOME.y - 0.065, PERCH_HOME.z);
const BRANCH_DIR = PERCH_UNDER.clone().sub(BRANCH_A).normalize();
const BRANCH_B = BRANCH_A.clone().addScaledVector(BRANCH_DIR, BRANCH_A.distanceTo(PERCH_UNDER) + 0.3);
const TWIG_TIP = BRANCH_B.clone().add(new THREE.Vector3(0.16, 0.22, 0.08));

// A lantern hung from the branch beside the owl: its warm light is what the
// owl's face catches at night
const LANTERN_HOOK = BRANCH_A.clone().lerp(PERCH_UNDER, 0.62);
const LANTERN_DROP = 0.5;

function BranchLantern({ m }: { m: Mats }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.rotation.z = Math.sin(t * 1.1) * 0.06;
    ref.current.rotation.x = Math.sin(t * 0.8 + 1) * 0.04;
  });
  return (
    <group ref={ref} position={LANTERN_HOOK} userData={{ noShadow: true }}>
      <mesh material={m.metal} position-y={-LANTERN_DROP / 2}>
        <cylinderGeometry args={[0.006, 0.006, LANTERN_DROP, 4]} />
      </mesh>
      <group position-y={-LANTERN_DROP - 0.1}>
        <mesh material={m.metal} position-y={0.13}>
          <coneGeometry args={[0.1, 0.08, 6]} />
        </mesh>
        <mesh material={m.bulb}>
          <cylinderGeometry args={[0.065, 0.065, 0.17, 6]} />
        </mesh>
        <mesh material={m.metal} position-y={-0.1}>
          <cylinderGeometry args={[0.08, 0.08, 0.03, 6]} />
        </mesh>
        <HomeShadowLight color="#ffb15c" intensity={2.6} distance={4.5} decay={1.6} far={4.5} />
      </group>
    </group>
  );
}

function PerchTree({ m }: { m: Mats }) {
  return (
    <group>
      {[0, 1.3, 2.6, 3.9, 5.2].map((a) => (
        <Limb key={a} a={new THREE.Vector3(TRUNK.x + Math.cos(a) * 0.55, 0, TRUNK.z + Math.sin(a) * 0.55)} b={new THREE.Vector3(TRUNK.x, 0.7, TRUNK.z)} r0={0.12} r1={0.07} material={m.bark} />
      ))}
      <Limb a={BRANCH_A} b={BRANCH_B} r0={0.095} r1={0.05} material={m.bark} />
      <Limb a={BRANCH_B} b={TWIG_TIP} r0={0.045} r1={0.02} material={m.bark} />
    </group>
  );
}

// Deterministic scatter so the woods look the same on every visit
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Leaves let go of the perch tree now and then and tumble down
const LEAF_COUNT = 34;
const LEAF_SOURCE = new THREE.Vector3(-1.3, 5.4, -0.8);

function FallingLeaves({ m }: { m: Mats }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const leaves = useMemo(() => {
    const rand = mulberry32(17);
    return Array.from({ length: LEAF_COUNT }, () => ({
      // Each leaf loops: drops from the crown over `period` seconds
      offset: rand(),
      period: 7 + rand() * 6,
      angle: rand() * Math.PI * 2,
      radius: 0.6 + rand() * 2.1,
      top: LEAF_SOURCE.y - 0.6 + rand() * 1.2,
      swirl: 0.3 + rand() * 0.5,
      spin: 1.5 + rand() * 3,
      color: new THREE.Color(C.leaves[Math.floor(rand() * 4)]!).offsetHSL(0.02 + rand() * 0.06, 0.1, 0.05),
    }));
  }, []);

  useLayoutEffect(() => {
    leaves.forEach((l, i) => mesh.current!.setColorAt(i, l.color));
    if (mesh.current!.instanceColor) mesh.current!.instanceColor.needsUpdate = true;
  }, [leaves]);

  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const im = mesh.current;
    if (!im) return;
    const t = clock.elapsedTime;
    leaves.forEach((l, i) => {
      const k = (t / l.period + l.offset) % 1;
      const y = l.top - k * (l.top + 0.05);
      // Drift downwind and swirl as it falls; shrink away near the ground
      const a = l.angle + k * l.swirl * 6;
      o.position.set(
        LEAF_SOURCE.x + Math.cos(a) * l.radius + k * 1.6,
        y,
        LEAF_SOURCE.z + Math.sin(a) * l.radius + Math.sin(t * 0.8 + i) * 0.25,
      );
      o.rotation.set(t * l.spin + i, t * l.spin * 0.7, Math.sin(t * 2 + i) * 0.8);
      o.scale.setScalar(k > 0.92 ? (1 - k) / 0.08 : Math.min(1, k * 12));
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, m.leafFall, LEAF_COUNT]} frustumCulled={false}>
      <planeGeometry args={[0.09, 0.06]} />
    </instancedMesh>
  );
}

function Hills() {
  const hills = useMemo(() => {
    const rand = mulberry32(21);
    return Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2 + rand() * 0.2;
      const r = 150 + rand() * 50;
      return { x: Math.cos(a) * r - 4, z: Math.sin(a) * r - 50, w: 40 + rand() * 40, h: 14 + rand() * 18, c: i % 3 };
    });
  }, []);
  const colors = ["#8f9b6c", "#9aa37a", "#8a957a"];
  return (
    <group>
      {hills.map((h, i) => (
        <mesh key={i} position={[h.x, -2, h.z]} scale={[h.w, h.h, h.w * 0.7]}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={colors[h.c]} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
}

export default function HomeGrounds() {
  const m = useMats();
  return (
    <group>
      <mesh material={m.grass} rotation-x={-Math.PI / 2} position={[-4, 0, -50]} userData={{ receiveOnly: true }}>
        <circleGeometry args={[260, 48]} />
      </mesh>
      <House m={m} />
      <PerchTree m={m} />
      <BranchLantern m={m} />
      <Vegetation />
      <FallingLeaves m={m} />
      <Mailbox />
      <Hills />
    </group>
  );
}
