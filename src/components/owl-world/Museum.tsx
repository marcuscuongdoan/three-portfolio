"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ThreeEvent, useFrame } from "@react-three/fiber";
import { LAB_APPS, ShowcaseApp } from "@/data/apps";
import { MUSEUM_CENTER, MUSEUM_RADIUS, MUSEUM_WALL_STEP, MUSEUM_WALLS, STOP_INDEX } from "@/components/owl-world/flightPath";
import { makeFrameArt, makeSign } from "@/components/owl-world/cardTexture";
import { useOwlWorld } from "@/components/owl-world/owlStore";
import { usePointerCursor } from "@/components/owl-world/Corridor";

/**
 * An open-air gallery of the 3D lab: three walls on an arc in front of the
 * owl's pedestal, each experiment hung as a square. Hovering lights the frame's border, clicking
 * asks before leaving for the app.
 */

const WALL_H = 5.4;
const WALL_T = 0.4;
// Top of the cornice, where the companion owls perch
export const MUSEUM_WALL_TOP = WALL_H + 0.21;
const WALL_W = 2 * MUSEUM_RADIUS * Math.sin(MUSEUM_WALL_STEP / 2);
const ART = 1.2;
const FRAME = 1.42;
const GLOW = 1.6;
const TOP_ROW = 3.55;
const BOTTOM_ROW = 1.82;
const COL = 0.86;

// Apps per wall, left to right (13 apps → 2·3·3·3·2)
const WALL_COUNTS = [2, 3, 2];
// Placards under the two-frame walls
const WALL_TITLES: [string, string][] = [
  ["3D Lab", "Interactive"],
  ["", ""],
  ["Built here", "Three.js · React"],
];

const COLORS = {
  wall: "#43596f",
  trim: "#efe5d3",
  gold: "#c9a45c",
  floor: "#a9a6b6",
  inlay: "#b9a88f",
};

function ringGeometry(outer: number, inner: number) {
  const s = new THREE.Shape();
  s.moveTo(-outer / 2, -outer / 2);
  s.lineTo(outer / 2, -outer / 2);
  s.lineTo(outer / 2, outer / 2);
  s.lineTo(-outer / 2, outer / 2);
  s.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-inner / 2, -inner / 2);
  hole.lineTo(-inner / 2, inner / 2);
  hole.lineTo(inner / 2, inner / 2);
  hole.lineTo(inner / 2, -inner / 2);
  hole.closePath();
  s.holes.push(hole);
  return new THREE.ShapeGeometry(s);
}

function Artwork({ app, position, interactive, light }: { app: ShowcaseApp; position: [number, number, number]; interactive: boolean; light: React.RefObject<THREE.PointLight | null> }) {
  const texture = useMemo(() => makeFrameArt(app), [app]);
  useEffect(() => () => texture.dispose(), [texture]);
  const glowGeo = useMemo(() => ringGeometry(GLOW, FRAME - 0.02), []);
  const accent = useMemo(() => new THREE.Color(app.accent), [app.accent]);
  const hovered = useOwlWorld((s) => s.hoveredApp === app.id) && interactive;
  const setHoveredApp = useOwlWorld((s) => s.setHoveredApp);
  const setPendingApp = useOwlWorld((s) => s.setPendingApp);
  const art = useRef<THREE.Group>(null);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const level = useRef(0);
  usePointerCursor(hovered);

  useFrame((_, dt) => {
    level.current = THREE.MathUtils.damp(level.current, hovered ? 1 : 0, 9, dt);
    const l = level.current;
    if (glow.current) {
      glow.current.color.copy(accent).multiplyScalar(0.4 + l * 4.2);
      glow.current.opacity = 0.15 + l * 0.85;
    }
    if (art.current) art.current.position.z = WALL_T / 2 + l * 0.12;
    // The one picture light follows whichever frame is lit
    if (hovered && light.current) {
      // Just in front of the art, in the light's own (museum) space
      art.current!.localToWorld(light.current.position.set(0, 0.2, 0.9));
      light.current.parent?.worldToLocal(light.current.position);
      light.current.color.copy(accent);
    }
  });

  const over = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    setHoveredApp(app.id);
  };
  const out = () => {
    if (useOwlWorld.getState().hoveredApp === app.id) setHoveredApp(null);
  };

  return (
    <group position={position}>
      <mesh geometry={glowGeo} position-z={WALL_T / 2 + 0.01} userData={{ noShadow: true }}>
        <meshBasicMaterial ref={glow} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <group ref={art} position-z={WALL_T / 2}>
        <mesh position-z={0.04}>
          <boxGeometry args={[FRAME, FRAME, 0.08]} />
          <meshStandardMaterial color={COLORS.gold} metalness={0.75} roughness={0.32} />
        </mesh>
        <mesh
          position-z={0.085}
          onPointerOver={over}
          onPointerOut={out}
          onClick={(e) => {
            if (!interactive) return;
            e.stopPropagation();
            setPendingApp(app);
          }}
        >
          <planeGeometry args={[ART, ART]} />
          <meshStandardMaterial map={texture} roughness={0.6} emissive="#ffffff" emissiveMap={texture} emissiveIntensity={0.22} />
        </mesh>
      </group>
    </group>
  );
}

function Placard({ title, kicker, position }: { title: string; kicker: string; position: [number, number, number] }) {
  const texture = useMemo(() => makeSign(title, kicker, { bg: "#efe5d3", fg: "#2c2420", accent: "#a8834a" }), [title, kicker]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position}>
      <planeGeometry args={[2.2, 0.69]} />
      <meshStandardMaterial map={texture} roughness={0.7} />
    </mesh>
  );
}

function Column({ height }: { height: number }) {
  return (
    <group>
      <mesh position-y={0.15}>
        <boxGeometry args={[0.85, 0.3, 0.85]} />
        <meshStandardMaterial color={COLORS.trim} roughness={0.7} />
      </mesh>
      <mesh position-y={height / 2}>
        <cylinderGeometry args={[0.3, 0.34, height, 16]} />
        <meshStandardMaterial color={COLORS.trim} roughness={0.6} />
      </mesh>
      <mesh position-y={height - 0.1}>
        <boxGeometry args={[0.8, 0.25, 0.8]} />
        <meshStandardMaterial color={COLORS.trim} roughness={0.7} />
      </mesh>
    </group>
  );
}

// Each wall: its angle on the arc, its apps and where they hang
const WALLS = WALL_COUNTS.map((count, i) => {
  const first = WALL_COUNTS.slice(0, i).reduce((a, b) => a + b, 0);
  const slots: [number, number][] =
    count === 3
      ? [
          [-COL, TOP_ROW],
          [COL, TOP_ROW],
          [0, BOTTOM_ROW],
        ]
      : [
          [-COL, TOP_ROW],
          [COL, TOP_ROW],
        ];
  return {
    theta: (i - (MUSEUM_WALLS - 1) / 2) * MUSEUM_WALL_STEP,
    apps: LAB_APPS.slice(first, first + count),
    slots,
    title: WALL_TITLES[i]!,
  };
});

/** World position of an app's frame on the walls and the way it faces */
export function framePose(appId: string, pos: THREE.Vector3, normal: THREE.Vector3) {
  for (const wall of WALLS) {
    const j = wall.apps.findIndex((a) => a.id === appId);
    if (j < 0) continue;
    const [x, y] = wall.slots[j]!;
    const turn = -wall.theta;
    normal.set(0, 0, 1).applyAxisAngle(_UP, turn);
    pos
      .set(x, y, WALL_T / 2 + 0.1)
      .applyAxisAngle(_UP, turn)
      .add(_wallCentre.set(MUSEUM_CENTER.x + Math.sin(wall.theta) * MUSEUM_RADIUS, 0, MUSEUM_CENTER.z - Math.cos(wall.theta) * MUSEUM_RADIUS));
    return true;
  }
  return false;
}
const _UP = new THREE.Vector3(0, 1, 0);
const _wallCentre = new THREE.Vector3();

export default function Museum() {
  const activeStop = useOwlWorld((s) => s.activeStop);
  const interactive = activeStop === STOP_INDEX.museum;
  const light = useRef<THREE.PointLight>(null);
  const hovered = useOwlWorld((s) => s.hoveredApp);
  const lightLevel = useRef(0);

  // Clear a stale hover when leaving the museum
  useEffect(() => {
    if (!interactive && useOwlWorld.getState().hoveredApp) useOwlWorld.getState().setHoveredApp(null);
  }, [interactive]);

  useFrame((_, dt) => {
    lightLevel.current = THREE.MathUtils.damp(lightLevel.current, interactive && hovered ? 1 : 0, 8, dt);
    if (light.current) light.current.intensity = lightLevel.current * 14;
  });

  const M = MUSEUM_CENTER;
  return (
    <group position={[M.x, 0, M.z]}>
      {/* Marble floor with an inlaid ring */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <circleGeometry args={[MUSEUM_RADIUS + 3.5, 64]} />
        <meshStandardMaterial color={COLORS.floor} roughness={0.85} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
        <ringGeometry args={[2.2, 2.45, 64]} />
        <meshStandardMaterial color={COLORS.inlay} roughness={0.4} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
        <ringGeometry args={[MUSEUM_RADIUS - 1.2, MUSEUM_RADIUS - 1.0, 64, 1, Math.PI / 2 - MUSEUM_WALL_STEP * (MUSEUM_WALLS / 2), MUSEUM_WALL_STEP * MUSEUM_WALLS]} />
        <meshStandardMaterial color={COLORS.gold} metalness={0.6} roughness={0.4} />
      </mesh>

      {/* The owl's pedestal; its top is the museum perch */}
      <group>
        <mesh position-y={0.12}>
          <cylinderGeometry args={[0.62, 0.7, 0.24, 24]} />
          <meshStandardMaterial color={COLORS.trim} roughness={0.6} />
        </mesh>
        <mesh position-y={M.y / 2}>
          <cylinderGeometry args={[0.32, 0.4, M.y, 24]} />
          <meshStandardMaterial color={COLORS.trim} roughness={0.55} />
        </mesh>
        <mesh position-y={M.y - 0.06}>
          <cylinderGeometry args={[0.5, 0.42, 0.12, 24]} />
          <meshStandardMaterial color={COLORS.gold} metalness={0.7} roughness={0.35} />
        </mesh>
      </group>

      {WALLS.map(({ theta, apps, slots, title }, i) => (
        <group key={i} position={[Math.sin(theta) * MUSEUM_RADIUS, 0, -Math.cos(theta) * MUSEUM_RADIUS]} rotation-y={-theta}>
          <mesh position-y={WALL_H / 2}>
            <boxGeometry args={[WALL_W, WALL_H, WALL_T]} />
            <meshStandardMaterial color={COLORS.wall} roughness={0.85} />
          </mesh>
          {/* Cornice and skirting */}
          <mesh position-y={WALL_H + 0.1}>
            <boxGeometry args={[WALL_W + 0.1, 0.22, WALL_T + 0.2]} />
            <meshStandardMaterial color={COLORS.trim} roughness={0.7} />
          </mesh>
          <mesh position-y={0.15}>
            <boxGeometry args={[WALL_W + 0.02, 0.3, WALL_T + 0.08]} />
            <meshStandardMaterial color={COLORS.trim} roughness={0.7} />
          </mesh>
          {apps.map((app, j) => (
            <Artwork key={app.id} app={app} position={[slots[j]![0], slots[j]![1], 0]} interactive={interactive} light={light} />
          ))}
          {apps.length === 2 && title[0] && <Placard title={title[0]} kicker={title[1]} position={[0, BOTTOM_ROW, WALL_T / 2 + 0.01]} />}
        </group>
      ))}

      {/* Columns at the wall joints */}
      {Array.from({ length: MUSEUM_WALLS + 1 }, (_, i) => {
        const a = (i - MUSEUM_WALLS / 2) * MUSEUM_WALL_STEP;
        const r = MUSEUM_RADIUS / Math.cos(MUSEUM_WALL_STEP / 2) - 0.05;
        return (
          <group key={i} position={[Math.sin(a) * r, 0, -Math.cos(a) * r]}>
            <Column height={WALL_H + 0.5} />
          </group>
        );
      })}

      <pointLight ref={light} intensity={0} distance={4.5} decay={1.6} />
    </group>
  );
}
