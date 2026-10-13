"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ThreeEvent, useFrame } from "@react-three/fiber";
import { LAB_APPS, ShowcaseApp, WEB_APPS } from "@/data/apps";
import { CORRIDOR_X, CORRIDOR_Y } from "@/components/owl-world/flightPath";
import { makeFlightCard, makeSign } from "@/components/owl-world/cardTexture";
import { useOwlWorld } from "@/components/owl-world/owlStore";

/**
 * The apps line the straight stretch of the flight, angled toward the owl as
 * it comes: web products first, then the 3D lab, each behind a gate sign.
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
/** The top edge of the i-th web products card, and its bob (the companions sit on it) */
export function webCardTop(i: number) {
  const [x, y, z] = cardPosition(WEB_START, i);
  return { pos: new THREE.Vector3(x, y + CARD_H / 2 + 0.045, z), seed: cardSeed(WEB_START, i) };
}
const FACE_ANGLE = 0.95;

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

function FlightCard({ app, position, rotationY, seed }: { app: ShowcaseApp; position: [number, number, number]; rotationY: number; seed: number }) {
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
    g.position.y = position[1] + cardBob(seed, clock.elapsedTime);
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
  const signY = CORRIDOR_Y + 1.95;
  const sign = useMemo(() => roundedRectGeometry(3.1, 0.97, 0.1), []);
  return (
    <group position={[CORRIDOR_X, 0, z]}>
      {[-1.75, 1.75].map((x) => (
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

function Row({ apps, startZ }: { apps: ShowcaseApp[]; startZ: number }) {
  return (
    <>
      {apps.map((app, i) => {
        const side = i % 2 === 0 ? -1 : 1;
        return (
          <FlightCard
            key={app.id}
            app={app}
            seed={cardSeed(startZ, i)}
            position={cardPosition(startZ, i)}
            rotationY={-side * FACE_ANGLE}
          />
        );
      })}
    </>
  );
}

export default function Corridor() {
  return (
    <group>
      <Gate z={WEB_START + GATE_LEAD} title="Web products" kicker={`${WEB_APPS.length} shipped`} accent="#e0b46c" />
      <Row apps={WEB_APPS} startZ={WEB_START} />
      <Gate z={LAB_START + GATE_LEAD} title="3D Lab" kicker={`${LAB_APPS.length} experiments`} accent="#7fd1c7" />
      <Row apps={LAB_APPS} startZ={LAB_START} />
    </group>
  );
}
