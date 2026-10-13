"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ThreeEvent, useFrame } from "@react-three/fiber";
import { LAB_APPS, ShowcaseApp } from "@/data/apps";
import { MUSEUM_CENTER, MUSEUM_RADIUS, MUSEUM_WALL_STEP, MUSEUM_WALLS, STOP_INDEX } from "@/components/owl-world/flightPath";
import { makeFrameArt, makeSign } from "@/components/owl-world/cardTexture";
import { useOwlWorld } from "@/components/owl-world/owlStore";
import { roundedRectGeometry, usePointerCursor } from "@/components/owl-world/Corridor";

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
// A museum hang: a moulded gold frame, a cream mat with a thin gold fillet
// round the picture, and a soft shadow on the wall behind
const FRAME = 1.42;
const FRAME_INNER = 1.2;
const MAT = 1.21;
const ART = 0.98;
const FILLET = 0.035;
const GLOW = 1.6;
const PICTURE_LIGHT = new THREE.Color("#ffe2b8");
// On hover the picture rises this far in front of its mat (m), standing
// proud of the frame as a raised block — it doesn't grow past the frame
const POP_LIFT = 0.16;
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

// Rounded corners, getting tighter from the frame inward so every layer
// sits evenly inside the one round it
const RADIUS = { glow: 0.24, frame: 0.17, frameInner: 0.11, back: 0.13, mat: 0.1, fillet: 0.075, art: 0.06 };

/** A rounded square outline (centred), as a Shape or as a hole Path */
function roundedSquare<T extends THREE.Path>(path: T, size: number, r: number) {
  const h = size / 2;
  path.moveTo(-h + r, -h);
  path.lineTo(h - r, -h);
  path.quadraticCurveTo(h, -h, h, -h + r);
  path.lineTo(h, h - r);
  path.quadraticCurveTo(h, h, h - r, h);
  path.lineTo(-h + r, h);
  path.quadraticCurveTo(-h, h, -h, h - r);
  path.lineTo(-h, -h + r);
  path.quadraticCurveTo(-h, -h, -h + r, -h);
  return path;
}

/** A rounded square ring between two sizes */
function roundedRing(outer: number, rOuter: number, inner: number, rInner: number) {
  const shape = roundedSquare(new THREE.Shape(), outer, rOuter);
  shape.holes.push(roundedSquare(new THREE.Path(), inner, rInner));
  return shape;
}

// Frame pieces, shared by every artwork
let frameParts: {
  moulding: THREE.ExtrudeGeometry;
  back: THREE.BufferGeometry;
  mat: THREE.BufferGeometry;
  fillet: THREE.ShapeGeometry;
  art: THREE.BufferGeometry;
  sides: THREE.ExtrudeGeometry;
  shadow: THREE.CanvasTexture;
} | null = null;
function getFrameParts() {
  if (frameParts) return frameParts;
  // Rounded moulding: a bevelled extrusion of the frame's ring
  const moulding = new THREE.ExtrudeGeometry(roundedRing(FRAME - 0.04, RADIUS.frame, FRAME_INNER + 0.04, RADIUS.frameInner), {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 3,
    curveSegments: 10,
  });
  // A soft shadow the frame casts on the wall
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.filter = "blur(10px)";
  g.fillStyle = "rgba(0,0,0,0.75)";
  g.beginPath();
  g.roundRect(22, 26, 84, 84, 14);
  g.fill();
  frameParts = {
    moulding,
    back: roundedRectGeometry(FRAME - 0.02, FRAME - 0.02, RADIUS.back),
    mat: roundedRectGeometry(MAT, MAT, RADIUS.mat),
    fillet: new THREE.ShapeGeometry(roundedRing(ART + FILLET, RADIUS.fillet, ART, RADIUS.art), 10),
    art: roundedRectGeometry(ART, ART, RADIUS.art),
    // Unit-deep rounded block, stretched to the lift on hover
    sides: new THREE.ExtrudeGeometry(roundedSquare(new THREE.Shape(), ART + FILLET, RADIUS.fillet), { depth: 1, bevelEnabled: false, curveSegments: 10 }),
    shadow: new THREE.CanvasTexture(c),
  };
  return frameParts;
}

function ringGeometry(outer: number, inner: number) {
  return new THREE.ShapeGeometry(roundedRing(outer, RADIUS.glow, inner, RADIUS.frame), 10);
}

function Artwork({ app, position, interactive, light }: { app: ShowcaseApp; position: [number, number, number]; interactive: boolean; light: React.RefObject<THREE.PointLight | null> }) {
  const texture = useMemo(() => makeFrameArt(app), [app]);
  useEffect(() => () => texture.dispose(), [texture]);
  const glowGeo = useMemo(() => ringGeometry(GLOW, FRAME - 0.02), []);
  const parts = getFrameParts();
  const accent = useMemo(() => new THREE.Color(app.accent), [app.accent]);
  const hovered = useOwlWorld((s) => s.hoveredApp === app.id) && interactive;
  const setHoveredApp = useOwlWorld((s) => s.setHoveredApp);
  const setPendingApp = useOwlWorld((s) => s.setPendingApp);
  const art = useRef<THREE.Group>(null);
  const pop = useRef<THREE.Group>(null);
  const popShadow = useRef<THREE.MeshBasicMaterial>(null);
  const popSides = useRef<THREE.Mesh>(null);
  const popShadowMesh = useRef<THREE.Mesh>(null);
  const popSideMats = useMemo(
    () => [new THREE.MeshBasicMaterial({ visible: false }), new THREE.MeshStandardMaterial({ color: "#d9cdb6", roughness: 0.8 })],
    [],
  );
  useEffect(() => () => popSideMats.forEach((m) => m.dispose()), [popSideMats]);
  // The picture rests in greyscale and comes into colour on hover
  const artMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6, emissive: "#ffffff", emissiveMap: texture, emissiveIntensity: 0.22 });
    const colour = { value: 0 };
    m.userData.colour = colour;
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uColour = colour;
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "void main() {",
          "uniform float uColour;\nvec3 greyish(vec3 c) { return mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, uColour); }\nvoid main() {",
        )
        .replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb = greyish(diffuseColor.rgb);")
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance = greyish(totalEmissiveRadiance);");
    };
    return m;
  }, [texture]);
  useEffect(() => () => artMat.dispose(), [artMat]);
  const artMesh = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const level = useRef(0);
  usePointerCursor(hovered);

  useFrame((_, dt) => {
    level.current = THREE.MathUtils.damp(level.current, hovered ? 1 : 0, 9, dt);
    const l = level.current;
    const mat = artMesh.current?.material as THREE.MeshStandardMaterial | undefined;
    if (mat) (mat.userData.colour as { value: number }).value = l;
    if (glow.current) {
      glow.current.color.copy(accent).multiplyScalar(0.4 + l * 4.2);
      glow.current.opacity = 0.15 + l * 0.85;
    }
    if (art.current) art.current.position.z = WALL_T / 2 + l * 0.12;
    // The picture itself lifts clear of its mat and frame, and grows a touch
    if (pop.current) pop.current.position.z = l * POP_LIFT;
    // The block's sides grow with the lift, from the mat up to the picture
    if (popSides.current) {
      // Only while lifted, and always ending a little behind the picture so
      // nothing ever shares its depth
      popSides.current.visible = l > 0.02;
      popSides.current.scale.z = Math.max(0.001, l * POP_LIFT);
    }
    if (popShadow.current) {
      popShadow.current.opacity = l * 0.6;
      popShadowMesh.current?.position.set(l * 0.03, -0.03 - l * 0.05, 0.041);
    }
    // The one picture light follows whichever frame is lit
    if (hovered && light.current) {
      // Just in front of the art, in the light's own (museum) space
      art.current!.localToWorld(light.current.position.set(0, 0.2, 0.9));
      light.current.parent?.worldToLocal(light.current.position);
      // Mostly warm white with a hint of the app's colour: a picture light,
      // not a coloured spot (the cream mat would turn pink)
      light.current.color.set(PICTURE_LIGHT).lerp(accent, 0.25);
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
      {/* Soft shadow on the wall, a little below the frame */}
      <mesh position={[0, -0.05, WALL_T / 2 + 0.004]} userData={{ noShadow: true }}>
        <planeGeometry args={[FRAME * 1.45, FRAME * 1.45]} />
        <meshBasicMaterial map={parts.shadow} transparent depthWrite={false} opacity={0.65} />
      </mesh>
      {/* The whole frame is the target, not just the picture */}
      <group
        ref={art}
        position-z={WALL_T / 2}
        onPointerOver={over}
        onPointerOut={out}
        onClick={(e) => {
          if (!interactive) return;
          e.stopPropagation();
          setPendingApp(app);
        }}
      >
        <mesh geometry={parts.moulding} position-z={0.02}>
          <meshStandardMaterial color={COLORS.gold} metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Back panel inside the moulding, then the mat */}
        <mesh geometry={parts.back} position-z={0.03}>
          <meshStandardMaterial color="#2a2018" roughness={0.9} />
        </mesh>
        <mesh geometry={parts.mat} position-z={0.04}>
          <meshStandardMaterial color="#efe6d4" roughness={0.95} />
        </mesh>
        {/* The shadow the lifted picture throws on its mat */}
        <mesh ref={popShadowMesh} position={[0, -0.03, 0.041]} userData={{ noShadow: true }}>
          <planeGeometry args={[ART * 1.5, ART * 1.5]} />
          <meshBasicMaterial ref={popShadow} map={parts.shadow} transparent depthWrite={false} opacity={0} />
        </mesh>
        {/* The raised block's sides */}
        {/* Extrusion groups: 0 = the end caps (skipped), 1 = the sides */}
        <mesh ref={popSides} geometry={parts.sides} position-z={0.041} scale-z={0.001} visible={false} material={popSideMats} />
        <group ref={pop}>
          <mesh geometry={parts.fillet} position-z={0.043}>
            <meshStandardMaterial color="#b8924e" metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh ref={artMesh} geometry={parts.art} position-z={0.045} material={artMat} />
        </group>
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
    if (light.current) light.current.intensity = lightLevel.current * 3.5;
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
