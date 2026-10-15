"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ThreeElements } from "@react-three/fiber";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { PERCH_HOME } from "@/components/owl-world/flightPath";
import Vegetation, { PERCH_TRUNK } from "@/components/owl-world/Vegetation";
import { makeBarkTexture, makeGroundTexture } from "@/components/owl-world/foliage";
import Mailbox from "@/components/owl-world/Mailbox";
import WarriorStatue from "@/components/owl-world/Statue";
import { HomeShadowLight } from "@/components/owl-world/shadows";
import { STONE, stoneMaterial } from "@/components/owl-world/stone";
import { CASTLE_SCALE, HOUSE_POSITION, HOUSE_YAW, houseToWorld } from "@/components/owl-world/homePlan";

/**
 * The owl's home: a little stone castle at dusk, the tree whose branch it
 * sits on, the meadow and the woods the flight passes over. All primitives.
 */

const C = {
  roof: "#b4563a",
  roofDark: "#8f3f2a",
  door: "#6e4530",
  doorway: "#2b211a",
  glass: "#ffd9a0",
  glassGlow: "#ffae4a",
  path: "#7d6f5c",
  leaves: ["#6d8b4a", "#7fa055", "#5e7d40", "#8aa85e"],
};

function useMats() {
  return useMemo(() => {
    const groundTex = makeGroundTexture();
    const barkTex = makeBarkTexture(4);
    groundTex.repeat.set(64, 64);
    const std = (color: string, roughness = 0.85, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
    return {
      // Courses follow the castle's walls, not the world's axes
      stone: stoneMaterial(STONE.light, CASTLE_FRAME),
      stoneDark: stoneMaterial(STONE.dark, CASTLE_FRAME),
      pennant: std("#9c2b2b", 0.7, { side: THREE.DoubleSide }),
      roof: std(C.roof, 0.75),
      roofDark: std(C.roofDark, 0.8),
      door: std(C.door, 0.6),
      doorway: std(C.doorway, 1, { side: THREE.DoubleSide }),
      glass: std(C.glass, 0.3, { emissive: new THREE.Color(C.glassGlow), emissiveIntensity: 3.2, side: THREE.DoubleSide }),
      bulb: std("#fff2d0", 0.3, { emissive: new THREE.Color("#ffc46b"), emissiveIntensity: 4, toneMapped: false }),
      // Blotchy greens and earth, about 8 m to a tile across the meadow
      grass: std("#727272", 1, { map: groundTex }),
      path: std(C.path, 1),
      // The same bark as the perch tree's trunk, for its roots and the branch
      bark: std("#8a7462", 1, { map: barkTex }),
      leafFall: std("#8aa85e", 0.8, { side: THREE.DoubleSide, emissive: new THREE.Color("#2c3a1c"), emissiveIntensity: 0.6 }),
      metal: std("#2f2b28", 0.5, { metalness: 0.6 }),
    };
  }, []);
}
type Mats = ReturnType<typeof useMats>;

/** A box with softened edges; the radius shrinks to suit thin boards */
function RBox({ size, radius = 0.1, ...props }: { size: [number, number, number]; radius?: number } & ThreeElements["mesh"]) {
  const [w, h, d] = size;
  const geometry = useMemo(() => new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, Math.min(w, h, d) * 0.3)), [w, h, d, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} {...props} />;
}

// ------------------------------------------------------------------ castle

const WALL_H = 2.6;
const WALL_T = 0.42;
// Merlons: the teeth along every wall top, all one shared geometry
const MERLON = { w: 0.32, h: 0.4, d: 0.46, gap: 0.55 };
const COPING_H = 0.14;

/** A lit window with a round-arched head, facing +Z */
function ArchWindow({ m, w, h, position, rotationY = 0 }: { m: Mats; w: number; h: number; position: [number, number, number]; rotationY?: number }) {
  return (
    <group position={position} rotation-y={rotationY}>
      {/* Stone surround, then the glass a hair in front */}
      <mesh material={m.stoneDark}>
        <planeGeometry args={[w + 0.12, h + 0.06]} />
      </mesh>
      <mesh material={m.stoneDark} position-y={h / 2}>
        <circleGeometry args={[w / 2 + 0.06, 20, 0, Math.PI]} />
      </mesh>
      <mesh material={m.glass} position-z={0.005}>
        <planeGeometry args={[w, h]} />
      </mesh>
      <mesh material={m.glass} position={[0, h / 2, 0.005]}>
        <circleGeometry args={[w / 2, 20, 0, Math.PI]} />
      </mesh>
    </group>
  );
}

/** A row of merlons along X, `length` long, standing on `y` */
function Crenels({ m, geo, length, y, z = 0 }: { m: Mats; geo: THREE.BufferGeometry; length: number; y: number; z?: number }) {
  // Too short a run for two gets one, centred
  const n = length < MERLON.w * 2 ? 1 : Math.max(2, Math.round(length / MERLON.gap) + 1);
  const x = (i: number) => (n === 1 ? 0 : -length / 2 + MERLON.w / 2 + (i * (length - MERLON.w)) / (n - 1));
  return (
    <group position={[0, y + MERLON.h / 2, z]}>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} geometry={geo} material={m.stone} position-x={x(i)} />
      ))}
    </group>
  );
}

/** Coping and merlons round the top of a w × d block whose top is at `y` */
function BattlementRing({ m, geo, w, d, y }: { m: Mats; geo: THREE.BufferGeometry; w: number; d: number; y: number }) {
  const inset = MERLON.d / 2;
  return (
    <group>
      <RBox size={[w + 0.12, COPING_H, d + 0.12]} radius={0.04} material={m.stoneDark} position-y={y + COPING_H / 2} />
      <Crenels m={m} geo={geo} length={w} y={y + COPING_H} z={d / 2 - inset} />
      <Crenels m={m} geo={geo} length={w} y={y + COPING_H} z={-d / 2 + inset} />
      <group rotation-y={Math.PI / 2}>
        <Crenels m={m} geo={geo} length={d - MERLON.d * 2} y={y + COPING_H} z={w / 2 - inset} />
        <Crenels m={m} geo={geo} length={d - MERLON.d * 2} y={y + COPING_H} z={-w / 2 + inset} />
      </group>
    </group>
  );
}

/** A curtain wall from `a` to `b` (in the XZ plane), crenellated along its top */
function CurtainWall({ m, geo, a, b }: { m: Mats; geo: THREE.BufferGeometry; a: [number, number]; b: [number, number] }) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return (
    <group position={[(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2]} rotation-y={-Math.atan2(b[1] - a[1], b[0] - a[0])}>
      {/* Runs on into the towers so no seam shows */}
      <RBox size={[len + 0.6, WALL_H, WALL_T]} radius={0.06} material={m.stone} position-y={WALL_H / 2} />
      <RBox size={[len + 0.6, COPING_H, WALL_T + 0.1]} radius={0.04} material={m.stoneDark} position-y={WALL_H + COPING_H / 2} />
      <Crenels m={m} geo={geo} length={len} y={WALL_H + COPING_H} />
    </group>
  );
}

/** A round corner tower: battered foot, corbelled top, tall terracotta cone */
function Tower({ m, r, h, roofH, position, windows = [] }: { m: Mats; r: number; h: number; roofH: number; position: [number, number, number]; windows?: [number, number][] }) {
  return (
    <group position={position}>
      <mesh material={m.stoneDark} position-y={0.3}>
        <cylinderGeometry args={[r * 1.04, r * 1.14, 0.6, 28]} />
      </mesh>
      <mesh material={m.stone} position-y={h / 2}>
        <cylinderGeometry args={[r, r, h, 28]} />
      </mesh>
      {/* Corbels flare out to carry the overhanging roof */}
      <mesh material={m.stoneDark} position-y={h - 0.12}>
        <cylinderGeometry args={[r * 1.12, r, 0.3, 28]} />
      </mesh>
      <mesh material={m.stone} position-y={h + 0.15}>
        <cylinderGeometry args={[r * 1.12, r * 1.12, 0.3, 28]} />
      </mesh>
      <mesh material={m.roof} position-y={h + 0.3 + roofH / 2}>
        <coneGeometry args={[r * 1.3, roofH, 28]} />
      </mesh>
      <mesh material={m.roofDark} position-y={h + 0.3 + 0.06}>
        <cylinderGeometry args={[r * 1.3, r * 1.3, 0.12, 28]} />
      </mesh>
      <mesh material={m.metal} position-y={h + 0.3 + roofH + 0.04}>
        <sphereGeometry args={[0.07, 10, 8]} />
      </mesh>
      {/* Windows: [angle round the tower (0 = +Z), height] */}
      {windows.map(([angle, y]) => (
        <ArchWindow key={`${angle}${y}`} m={m} w={0.26} h={0.42} position={[Math.sin(angle) * (r + 0.02), y, Math.cos(angle) * (r + 0.02)]} rotationY={angle} />
      ))}
    </group>
  );
}

/** A gabled hall, ridge along X */
function Hall({ m, width, depth, height, rise, position, rotationY = 0 }: { m: Mats; width: number; depth: number; height: number; rise: number; position: [number, number, number]; rotationY?: number }) {
  const overhang = 0.18;
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
  useEffect(() => () => gable.dispose(), [gable]);
  return (
    <group position={position} rotation-y={rotationY}>
      <RBox size={[width, height, depth]} radius={0.06} material={m.stone} position-y={height / 2} />
      <group position-y={height}>
        <mesh geometry={gable} material={m.stone} />
        {[1, -1].map((s) => (
          <RBox key={s} size={[width + overhang * 2, 0.12, slope + 0.08]} radius={0.04} material={m.roof} position={[0, rise / 2 + 0.05, (s * half) / 2]} rotation-x={s * angle} />
        ))}
        <mesh material={m.roofDark} position-y={rise + 0.08} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.08, 0.08, width + overhang * 2 + 0.04, 10]} />
        </mesh>
      </group>
      {[-width / 4, width / 4].map((x) => (
        <ArchWindow key={x} m={m} w={0.24} h={0.36} position={[x, height * 0.62, depth / 2 + 0.01]} />
      ))}
    </group>
  );
}

// World → the castle's frame, unscaled so stone courses keep their real size
const CASTLE_FRAME = new THREE.Matrix4()
  .compose(HOUSE_POSITION, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), HOUSE_YAW), new THREE.Vector3(1, 1, 1))
  .invert();

// Corner tower centres; the curtain walls run between them
const CX = 3.4;
const CZ = 2.9;
// The gatehouse straddles the front wall
const GATE = { w: 2.0, h: 3.4, d: 0.9 };
const GATE_FRONT = CZ + GATE.d / 2;
// Scaled up these stay under ~10.5 m, and the tallest stand away from the
// glide home, which passes over the castle's left side at about 10.5 m
const KEEP = { w: 3.2, h: 4.4, d: 2.2, z: -1.4 };
const TURRET = { s: 1.1, h: 6.6, x: 1.6, z: -2.3 };

/** A pennant on a short pole, standing on `position`, flying toward +X */
function Pennant({ m, position }: { m: Mats; position: [number, number, number] }) {
  const flag = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(0.75, -0.14);
    s.lineTo(0, -0.32);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  }, []);
  useEffect(() => () => flag.dispose(), [flag]);
  return (
    <group position={position}>
      <mesh material={m.metal} position-y={0.5}>
        <cylinderGeometry args={[0.02, 0.02, 1.0, 6]} />
      </mesh>
      <mesh geometry={flag} material={m.pennant} position={[0.02, 0.98, 0]} rotation-y={-0.3} />
    </group>
  );
}

// The garden in front of the gate, at 1:1 (not scaled with the castle)
const GARDEN_Z = 9.5;
const GARDEN_X = 7.5;
const GARDEN_WALL_H = 1.1;
const GARDEN_GAP = 1.0;
const PIER = { s: 0.6, h: 1.6 };
const LANTERN_Y = PIER.h + 0.36;
// The statue in the garden, in front of the big tower: where the home view
// has room for it (between the mailbox and the tour panel), clear of the
// bushes, facing the perch tree. The gate side is off screen from the perch
const STATUE = { x: -3.9, z: 7.2, yaw: 0.07 };

/** A low crenellated garden wall from `a` to `b` */
function GardenWall({ m, geo, a, b }: { m: Mats; geo: THREE.BufferGeometry; a: [number, number]; b: [number, number] }) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return (
    <group position={[(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2]} rotation-y={-Math.atan2(b[1] - a[1], b[0] - a[0])}>
      <RBox size={[len, GARDEN_WALL_H, WALL_T]} radius={0.05} material={m.stone} position-y={GARDEN_WALL_H / 2} />
      <RBox size={[len + 0.06, COPING_H, WALL_T + 0.1]} radius={0.04} material={m.stoneDark} position-y={GARDEN_WALL_H + COPING_H / 2} />
      <Crenels m={m} geo={geo} length={len} y={GARDEN_WALL_H + COPING_H} />
    </group>
  );
}

/** Path, gate piers (the left one carrying the lantern) and the garden wall */
function Garden({ m, merlon }: { m: Mats; merlon: THREE.BufferGeometry }) {
  const pathFrom = CASTLE_SCALE * GATE_FRONT;
  const pathTo = GARDEN_Z + 1.5;
  return (
    <group>
      <mesh material={m.path} rotation-x={-Math.PI / 2} position={[0, 0.03, (pathFrom + pathTo) / 2]}>
        <planeGeometry args={[1.5, pathTo - pathFrom]} />
      </mesh>
      {/* Front wall either side of the gate, and short returns toward the castle */}
      <GardenWall m={m} geo={merlon} a={[-GARDEN_X, GARDEN_Z]} b={[-GARDEN_GAP - PIER.s / 2, GARDEN_Z]} />
      <GardenWall m={m} geo={merlon} a={[GARDEN_GAP + PIER.s / 2, GARDEN_Z]} b={[GARDEN_X, GARDEN_Z]} />
      <GardenWall m={m} geo={merlon} a={[-GARDEN_X, GARDEN_Z]} b={[-GARDEN_X, GARDEN_Z - 5]} />
      <GardenWall m={m} geo={merlon} a={[GARDEN_X, GARDEN_Z]} b={[GARDEN_X, GARDEN_Z - 5]} />
      {[-1, 1].map((side) => (
        <group key={side} position={[side * GARDEN_GAP, 0, GARDEN_Z]}>
          <RBox size={[PIER.s, PIER.h, PIER.s]} radius={0.05} material={m.stone} position-y={PIER.h / 2} />
          <RBox size={[PIER.s + 0.14, 0.14, PIER.s + 0.14]} radius={0.04} material={m.stoneDark} position-y={PIER.h + 0.07} />
          {side > 0 && (
            <mesh material={m.stoneDark} position-y={PIER.h + 0.3}>
              <sphereGeometry args={[0.18, 14, 10]} />
            </mesh>
          )}
        </group>
      ))}
      {/* The Warrior of Dawn guards the garden */}
      <Suspense fallback={null}>
        <WarriorStatue seed={2} position={[STATUE.x, 0, STATUE.z]} rotation-y={STATUE.yaw} />
      </Suspense>
      {/* Lantern on the left pier */}
      <group position={[-GARDEN_GAP, 0, GARDEN_Z]} userData={{ noShadow: true }}>
        <mesh material={m.metal} position-y={PIER.h + 0.16}>
          <cylinderGeometry args={[0.1, 0.12, 0.06, 8]} />
        </mesh>
        <mesh material={m.bulb} position-y={LANTERN_Y}>
          <sphereGeometry args={[0.16, 12, 12]} />
        </mesh>
        <mesh material={m.metal} position-y={LANTERN_Y + 0.2}>
          <coneGeometry args={[0.24, 0.2, 6]} />
        </mesh>
        <HomeShadowLight position-y={LANTERN_Y} color="#ffbe6b" intensity={9} distance={9} decay={2} far={9} />
      </group>
    </group>
  );
}

/** Where the companions sit at home: a gatehouse merlon, and the pier lantern's cap */
export const HOME_PERCHES: [THREE.Vector3, THREE.Vector3] = [
  houseToWorld(0.42 * CASTLE_SCALE, (3.4 + COPING_H + MERLON.h) * CASTLE_SCALE, (CZ + GATE.d / 2 - MERLON.d / 2) * CASTLE_SCALE),
  houseToWorld(-GARDEN_GAP, LANTERN_Y + 0.3, GARDEN_Z),
];

function Castle({ m }: { m: Mats }) {
  const merlon = useMemo(() => new RoundedBoxGeometry(MERLON.w, MERLON.h, MERLON.d, 2, 0.04), []);
  useEffect(() => () => merlon.dispose(), [merlon]);
  return (
    <group position={HOUSE_POSITION} rotation-y={HOUSE_YAW}>
      <group scale={CASTLE_SCALE}>
        {/* Towers: the front-right one, turned to the camera, is the big one */}
        <Tower m={m} r={1.0} h={4.2} roofH={2.0} position={[CX, 0, CZ]} windows={[[0.5, 2.0], [1.4, 3.2], [-0.3, 3.3]]} />
        <Tower m={m} r={0.85} h={3.6} roofH={1.7} position={[-CX, 0, CZ]} windows={[[-0.4, 2.6], [0.6, 1.6]]} />
        <Tower m={m} r={0.8} h={4.0} roofH={1.8} position={[-CX, 0, -CZ]} windows={[[-1.2, 3.0]]} />
        <Tower m={m} r={0.85} h={3.4} roofH={1.6} position={[CX, 0, -CZ]} windows={[[1.6, 2.5]]} />

        {/* Curtain walls, tower face to tower face */}
        <CurtainWall m={m} geo={merlon} a={[-CX + 0.85, CZ]} b={[-GATE.w / 2, CZ]} />
        <CurtainWall m={m} geo={merlon} a={[GATE.w / 2, CZ]} b={[CX - 1.0, CZ]} />
        <CurtainWall m={m} geo={merlon} a={[CX, CZ - 1.0]} b={[CX, -CZ + 0.85]} />
        <CurtainWall m={m} geo={merlon} a={[-CX, -CZ + 0.8]} b={[-CX, CZ - 0.85]} />
        <CurtainWall m={m} geo={merlon} a={[-CX + 0.8, -CZ]} b={[CX - 0.85, -CZ]} />
        {/* Arrow-slit windows in the front and camera-side walls */}
        {[-1.8, 1.8].map((x) => (
          <ArchWindow key={x} m={m} w={0.18} h={0.5} position={[x, 1.5, CZ + WALL_T / 2 + 0.01]} />
        ))}
        <ArchWindow m={m} w={0.18} h={0.5} position={[CX + WALL_T / 2 + 0.01, 1.5, 0]} rotationY={Math.PI / 2} />

        {/* Gatehouse: arched oak door in a dark stone surround */}
        <group position-z={CZ}>
          <RBox size={[GATE.w, GATE.h, GATE.d]} radius={0.06} material={m.stone} position-y={GATE.h / 2} />
          <BattlementRing m={m} geo={merlon} w={GATE.w} d={GATE.d} y={GATE.h} />
          <group position-z={GATE.d / 2 + 0.01}>
            <mesh material={m.stoneDark} position-y={0.75}>
              <planeGeometry args={[1.24, 1.5]} />
            </mesh>
            <mesh material={m.stoneDark} position-y={1.5}>
              <circleGeometry args={[0.62, 24, 0, Math.PI]} />
            </mesh>
            <mesh material={m.door} position={[0, 0.7, 0.01]}>
              <planeGeometry args={[1.0, 1.4]} />
            </mesh>
            <mesh material={m.door} position={[0, 1.4, 0.01]}>
              <circleGeometry args={[0.5, 24, 0, Math.PI]} />
            </mesh>
            {/* Planks */}
            {[-0.25, 0, 0.25].map((x) => (
              <mesh key={x} material={m.doorway} position={[x, 0.85, 0.015]}>
                <planeGeometry args={[0.02, 1.7]} />
              </mesh>
            ))}
            <mesh material={m.metal} position={[0.3, 0.75, 0.04]}>
              <torusGeometry args={[0.06, 0.012, 6, 14]} />
            </mesh>
            <ArchWindow m={m} w={0.3} h={0.4} position={[0, 2.55, 0]} />
          </group>
        </group>

        {/* Keep, with a tall square turret rising off its back corner */}
        <group position-z={KEEP.z}>
          <RBox size={[KEEP.w, KEEP.h, KEEP.d]} radius={0.06} material={m.stone} position-y={KEEP.h / 2} />
          <BattlementRing m={m} geo={merlon} w={KEEP.w} d={KEEP.d} y={KEEP.h} />
          {[-1, 0, 1].flatMap((i) =>
            [2.9, 3.8].map((y) => <ArchWindow key={`${i}${y}`} m={m} w={0.28} h={0.42} position={[i * 0.95, y, KEEP.d / 2 + 0.01]} />),
          )}
          <ArchWindow m={m} w={0.28} h={0.42} position={[KEEP.w / 2 + 0.01, 3.4, 0.2]} rotationY={Math.PI / 2} />
        </group>
        <group position={[TURRET.x, 0, TURRET.z]}>
          <RBox size={[TURRET.s, TURRET.h, TURRET.s]} radius={0.06} material={m.stone} position-y={TURRET.h / 2} />
          <BattlementRing m={m} geo={merlon} w={TURRET.s} d={TURRET.s} y={TURRET.h} />
          <ArchWindow m={m} w={0.24} h={0.4} position={[0, 5.6, TURRET.s / 2 + 0.01]} />
          <ArchWindow m={m} w={0.24} h={0.4} position={[TURRET.s / 2 + 0.01, 5.0, 0]} rotationY={Math.PI / 2} />
        </group>

        {/* Gabled halls round the courtyard, roofs showing over the walls */}
        <Hall m={m} width={2.2} depth={1.5} height={2.7} rise={0.9} position={[-1.7, 0, 0.9]} />
        <Hall m={m} width={2.0} depth={1.4} height={2.9} rise={0.9} position={[2.2, 0, 0.5]} rotationY={Math.PI / 2} />

        {/* Pennants on the tallest tower and the turret */}
        <Pennant m={m} position={[CX, 4.2 + 0.3 + 2.0, CZ]} />
        <Pennant m={m} position={[TURRET.x, TURRET.h + COPING_H, TURRET.z]} />
      </group>

      <Garden m={m} merlon={merlon} />
      {/* Window light spilling onto the garden */}
      <pointLight position={[0, 2.2, CASTLE_SCALE * GATE_FRONT + 1.6]} color="#ffab55" intensity={14} distance={11} decay={2} />
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
    <>
      <mesh material={material} position={pos} quaternion={quat}>
        <cylinderGeometry args={[r1, r0, len, 12]} />
      </mesh>
      {/* Rounded end, so joints and tips aren't cut flat */}
      <mesh material={material} position={b}>
        <sphereGeometry args={[r1, 12, 6]} />
      </mesh>
    </>
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
      <Castle m={m} />
      <PerchTree m={m} />
      <BranchLantern m={m} />
      <Vegetation />
      <FallingLeaves m={m} />
      <Mailbox />
      <Hills />
    </group>
  );
}
