"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ThreeEvent, useFrame } from "@react-three/fiber";
import { LAB_APPS, ShowcaseApp, WEB_APPS } from "@/data/apps";
import { CORRIDOR_X, CORRIDOR_Y } from "@/components/owl-world/flightPath";
import { makeFlightCard, makeSign } from "@/components/owl-world/cardTexture";
import { useOwlWorld } from "@/components/owl-world/owlStore";
import { cobbleMaterial, STONE, stoneMaterial } from "@/components/owl-world/stone";

/**
 * The apps line the straight stretch of the flight, angled toward the owl as
 * it comes: web products first, then the 3D lab, each behind a gate sign.
 * A lantern-lit cobbled road runs beneath them from the home clearing to the
 * museum. The web products stand on posts beside it; the lab's cards float.
 */

const CARD_W = 2.6;
const CARD_H = CARD_W * 0.75;
const SIDE_OFFSET = 2.95;
const SPACING = 3.5;
// The gate stands this far before a row's first card
const GATE_LEAD = 2.5;
const WEB_START = -18;
const LAB_START = -49;
// Cards bob gently on the air
export const cardBob = (seed: number, t: number) => Math.sin(t * 0.8 + seed) * 0.08;
const cardPosition = (startZ: number, i: number): [number, number, number] => [
  CORRIDOR_X + (i % 2 === 0 ? -1 : 1) * SIDE_OFFSET,
  CORRIDOR_Y + 0.35,
  startZ - i * SPACING,
];
const cardSeed = (startZ: number, i: number) => i * 1.9 + startZ;
/**
 * The top edge of a card in the web or the 3D lab row, for an owl to sit on,
 * and its bob seed (lab cards only: the web cards stand still on posts)
 */
export function cardTop(row: "web" | "lab", i: number) {
  const start = row === "web" ? WEB_START : LAB_START;
  const [x, y, z] = cardPosition(start, i);
  return { pos: new THREE.Vector3(x, y + CARD_H / 2 + 0.045, z), seed: row === "lab" ? cardSeed(start, i) : undefined };
}
const FACE_ANGLE = 0.95;

// The gate: two posts carrying the sign, which hangs at SIGN_Y
export const GATE_POST_X = 1.75;
export const GATE_SIGN_Y = CORRIDOR_Y + 1.95;
export const GATE_SIGN = { w: 3.1, h: 0.97 };
/** The foot of the 3D lab gate, between its posts (seasonal decorations hang off it) */
export const LAB_GATE = new THREE.Vector3(CORRIDOR_X, 0, LAB_START + GATE_LEAD);

export function roundedRectGeometry(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ShapeGeometry(s, 6);
  // UVs from the bounding box so a texture spans the whole card
  const pos = g.attributes.position!;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - x) / w;
    uv[i * 2 + 1] = (pos.getY(i) - y) / h;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}

export function usePointerCursor(active: boolean) {
  useEffect(() => {
    if (!active) return;
    document.body.style.cursor = "pointer";
    return () => {
      document.body.style.cursor = "";
    };
  }, [active]);
}

function FlightCard({ app, position, rotationY, seed }: { app: ShowcaseApp; position: [number, number, number]; rotationY: number; seed?: number }) {
  const texture = useMemo(() => makeFlightCard(app), [app]);
  useEffect(() => () => texture.dispose(), [texture]);
  const face = useMemo(() => roundedRectGeometry(CARD_W, CARD_H, 0.1), []);
  const edge = useMemo(() => roundedRectGeometry(CARD_W + 0.09, CARD_H + 0.09, 0.14), []);
  const accent = useMemo(() => new THREE.Color(app.accent), [app.accent]);
  const group = useRef<THREE.Group>(null);
  const edgeMat = useRef<THREE.MeshBasicMaterial>(null);
  const [hovered, setHovered] = useState(false);
  const setPendingApp = useOwlWorld((s) => s.setPendingApp);
  usePointerCursor(hovered);

  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    g.position.y = position[1] + (seed === undefined ? 0 : cardBob(seed, clock.elapsedTime));
    const s = THREE.MathUtils.damp(g.scale.x, hovered ? 1.07 : 1, 10, dt);
    g.scale.setScalar(s);
    edgeMat.current?.color.copy(accent).multiplyScalar(hovered ? 3.2 : 0.85);
  });

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
  };

  return (
    <group ref={group} position={position} rotation-y={rotationY}>
      <mesh geometry={edge} position-z={-0.015}>
        <meshBasicMaterial ref={edgeMat} toneMapped={false} />
      </mesh>
      <mesh
        geometry={face}
        onPointerOver={over}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => {
          e.stopPropagation();
          setPendingApp(app);
        }}
      >
        <meshStandardMaterial map={texture} roughness={0.55} emissive="#ffffff" emissiveMap={texture} emissiveIntensity={0.28} />
      </mesh>
      {/* Back */}
      <mesh geometry={edge} rotation-y={Math.PI} position-z={-0.02}>
        <meshStandardMaterial color="#3a302a" roughness={0.8} />
      </mesh>
    </group>
  );
}

function Gate({ z, title, kicker, accent }: { z: number; title: string; kicker: string; accent: string }) {
  const texture = useMemo(() => makeSign(title, kicker, { accent }), [title, kicker, accent]);
  useEffect(() => () => texture.dispose(), [texture]);
  const signY = GATE_SIGN_Y;
  const sign = useMemo(() => roundedRectGeometry(GATE_SIGN.w, GATE_SIGN.h, 0.1), []);
  return (
    <group position={[CORRIDOR_X, 0, z]}>
      {[-GATE_POST_X, GATE_POST_X].map((x) => (
        <group key={x} position-x={x}>
          <mesh position-y={signY / 2}>
            <cylinderGeometry args={[0.09, 0.13, signY, 8]} />
            <meshStandardMaterial color="#4a3a30" roughness={0.7} />
          </mesh>
          <mesh position-y={signY + 0.75}>
            <sphereGeometry args={[0.13, 12, 12]} />
            <meshBasicMaterial color={accent} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <mesh geometry={sign} position-y={signY}>
        <meshStandardMaterial map={texture} roughness={0.6} emissive="#ffffff" emissiveMap={texture} emissiveIntensity={0.35} />
      </mesh>
      <mesh geometry={sign} position-y={signY} rotation-y={Math.PI} position-z={-0.01}>
        <meshStandardMaterial color="#2c2420" roughness={0.8} />
      </mesh>
    </group>
  );
}

function Row({ apps, startZ, mounted = false }: { apps: ShowcaseApp[]; startZ: number; mounted?: boolean }) {
  const post = useMemo(() => new THREE.CylinderGeometry(0.07, 0.09, CARD_POST_H, 8), []);
  const postMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#4a3a30", roughness: 0.7 }), []);
  useEffect(
    () => () => {
      post.dispose();
      postMat.dispose();
    },
    [post, postMat],
  );
  return (
    <>
      {apps.map((app, i) => {
        const side = i % 2 === 0 ? -1 : 1;
        const [x, y, z] = cardPosition(startZ, i);
        return (
          <group key={app.id}>
            <FlightCard app={app} seed={mounted ? undefined : cardSeed(startZ, i)} position={[x, y, z]} rotationY={-side * FACE_ANGLE} />
            {/* Two posts behind the card, up to its middle */}
            {mounted && (
              <group position={[x, 0, z]} rotation-y={-side * FACE_ANGLE}>
                {[-1, 1].map((s) => (
                  <mesh key={s} geometry={post} material={postMat} position={[s * (CARD_W / 2 - 0.35), CARD_POST_H / 2, -0.09]} />
                ))}
              </group>
            )}
          </group>
        );
      })}
    </>
  );
}

// ------------------------------------------------------------------ road

const CARD_POST_H = CORRIDOR_Y + 0.35;
const ROAD_W = 2.4;
const CURB_W = 0.22;
const CURB_H = 0.1;
// The road's own surface, a hair above the meadow
const ROAD_Y = 0.035;
// Metres over which each end of the road fades into the grass
const ROAD_FADE = 3;
const LANTERN_STEP = 5.5;
const LANTERN_H = 1.6;

// From the home clearing, round the bushes, straight through the web
// products gate, down the 3D lab's aisle and onto the museum's cobbled floor
// (its far end fades out just over the floor's edge)
const ROAD = new THREE.CatmullRomCurve3(
  [
    [-2.4, -6.8],
    [-3.6, -10.2],
    [-4.5, -14],
    [-4.5, -20],
    [-4.5, -33],
    [-4.2, -39],
    [-4.5, -44],
    [-4.5, -48],
    [-4.5, -60],
    [-4.5, -70],
    [-4.5, -77],
  ].map(([x, z]) => new THREE.Vector3(x!, 0, z!)),
  false,
  "centripetal",
);
const ROAD_LEN = ROAD.getLength();
const ROAD_SAMPLES = ROAD.getSpacedPoints(160);

/** Whether (x, z) is on the road or its curbs, give or take `margin` (the grass keeps off it) */
export function onRoad(x: number, z: number, margin = 0.25) {
  const r = ROAD_W / 2 + CURB_W + margin;
  return ROAD_SAMPLES.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < r * r);
}

const _t = new THREE.Vector3();
/**
 * A strip along the road between two cross-sections, `a` and `b`, each a
 * [sideways offset, height]. UV v runs along the road, for the end fade
 */
function roadStrip(sections: number, a: [number, number], b: [number, number]) {
  const pos: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= sections; i++) {
    const u = i / sections;
    const p = ROAD.getPointAt(u);
    ROAD.getTangentAt(u, _t);
    // Sideways, to the road's right
    const nx = -_t.z;
    const nz = _t.x;
    for (const [off, y] of [a, b]) pos.push(p.x + nx * off, y, p.z + nz * off);
    uv.push(0, u, 1, u);
    if (i < sections) {
      const k = i * 2;
      index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

// Opaque along the road, fading out over ROAD_FADE at either end (v = 0..1)
function makeFadeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const f = ROAD_FADE / ROAD_LEN;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#000");
  grad.addColorStop(f, "#fff");
  grad.addColorStop(1 - f, "#fff");
  grad.addColorStop(1, "#000");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);
  return new THREE.CanvasTexture(canvas);
}

// A soft warm pool, for the light each lantern throws on the road
function makeGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,190,110,0.55)");
  grad.addColorStop(0.45, "rgba(255,170,90,0.18)");
  grad.addColorStop(1, "rgba(255,160,80,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Along the road, alternating sides, clear of the two gates and the faded ends
const GATE_ZS = [WEB_START + GATE_LEAD, LAB_START + GATE_LEAD];
const LANTERNS = (() => {
  const out: { pos: THREE.Vector3; glow: THREE.Vector3; away: THREE.Vector3 }[] = [];
  let side = 1;
  for (let s = ROAD_FADE + 1; s < ROAD_LEN - ROAD_FADE - 1; s += LANTERN_STEP) {
    const u = s / ROAD_LEN;
    const p = ROAD.getPointAt(u);
    if (GATE_ZS.some((z) => Math.abs(p.z - z) < 1.5)) continue;
    ROAD.getTangentAt(u, _t);
    const off = side * (ROAD_W / 2 + CURB_W + 0.35);
    out.push({
      pos: new THREE.Vector3(p.x - _t.z * off, 0, p.z + _t.x * off),
      // The pool lies across the road, nearer the lantern's side
      glow: new THREE.Vector3(p.x - _t.z * off * 0.55, ROAD_Y + 0.01, p.z + _t.x * off * 0.55),
      away: new THREE.Vector3(-_t.z * side, 0, _t.x * side),
    });
    side = -side;
  }
  return out;
})();

/**
 * The lamp posts along the road, for seasonal themes to dress: each foot on
 * the ground, `away` the level unit vector from the road out to the post.
 * The post is `height` tall, the lamp head above it reaching 0.4 higher
 */
export const ROAD_LAMPS = LANTERNS.map(({ pos, away }) => ({ pos, away, height: LANTERN_H }));
/** The foot of the web products gate, between its posts */
export const WEB_GATE = new THREE.Vector3(CORRIDOR_X, 0, WEB_START + GATE_LEAD);

type Section = [number, number];

function Road() {
  const res = useMemo(() => {
    const fade = makeFadeTexture();
    const glowTex = makeGlowTexture();
    const faded = (m: THREE.MeshStandardMaterial) => {
      m.alphaMap = fade;
      m.transparent = true;
      m.depthWrite = false;
      return m;
    };
    const sections = Math.ceil(ROAD_LEN * 2);
    const half = ROAD_W / 2;
    const out = half + CURB_W;
    // Each curb: inner face, top, outer face, wound to face out of the curb
    const curbs = [-1, 1].flatMap((s) => {
      const i = s * half;
      const o = s * out;
      const faces: [Section, Section][] = [
        [
          [i, ROAD_Y],
          [i, CURB_H],
        ],
        [
          [i, CURB_H],
          [o, CURB_H],
        ],
        [
          [o, CURB_H],
          [o, 0],
        ],
      ];
      return faces.map(([a, b]) => (s > 0 ? roadStrip(sections, a, b) : roadStrip(sections, b, a)));
    });
    return {
      fade,
      glowTex,
      surface: roadStrip(sections, [-half, ROAD_Y], [half, ROAD_Y]),
      curbs,
      road: faded(cobbleMaterial()),
      curb: faded(stoneMaterial(STONE.dark, undefined, { tile: 1.6, weather: 0.8 })),
      lanternPost: new THREE.CylinderGeometry(0.045, 0.06, LANTERN_H, 8),
      lanternHead: new THREE.BoxGeometry(0.2, 0.26, 0.2),
      lanternCap: new THREE.ConeGeometry(0.17, 0.14, 4),
      glowGeo: new THREE.PlaneGeometry(3, 3),
      metal: new THREE.MeshStandardMaterial({ color: "#2f2b28", roughness: 0.5, metalness: 0.6 }),
      // Bright enough to bloom
      flame: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffc46b").multiplyScalar(2.6), toneMapped: false }),
      glow: new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    };
  }, []);
  useEffect(
    () => () => {
      res.fade.dispose();
      res.glowTex.dispose();
      [res.surface, ...res.curbs, res.lanternPost, res.lanternHead, res.lanternCap, res.glowGeo].forEach((g) => g.dispose());
      [res.road, res.curb, res.metal, res.flame, res.glow].forEach((m) => m.dispose());
    },
    [res],
  );

  return (
    <group>
      <mesh geometry={res.surface} material={res.road} receiveShadow />
      {res.curbs.map((g, i) => (
        <mesh key={i} geometry={g} material={res.curb} receiveShadow />
      ))}
      {LANTERNS.map(({ pos, glow }, i) => (
        <group key={i}>
          <group position={pos}>
            <mesh geometry={res.lanternPost} material={res.metal} position-y={LANTERN_H / 2} />
            <mesh geometry={res.lanternHead} material={res.flame} position-y={LANTERN_H + 0.13} />
            <mesh geometry={res.lanternCap} material={res.metal} position-y={LANTERN_H + 0.33} rotation-y={Math.PI / 4} />
          </group>
          <mesh geometry={res.glowGeo} material={res.glow} position={glow} rotation-x={-Math.PI / 2} />
        </group>
      ))}
    </group>
  );
}

export default function Corridor() {
  return (
    <group>
      <Road />
      <Gate z={WEB_START + GATE_LEAD} title="Web products" kicker={`${WEB_APPS.length} shipped`} accent="#e0b46c" />
      <Row apps={WEB_APPS} startZ={WEB_START} mounted />
      <Gate z={LAB_START + GATE_LEAD} title="3D Lab" kicker={`${LAB_APPS.length} experiments`} accent="#7fd1c7" />
      <Row apps={LAB_APPS} startZ={LAB_START} />
    </group>
  );
}
