"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ThreeEvent, useFrame } from "@react-three/fiber";
import { LAST_STOP, STOP_INDEX } from "@/components/owl-world/flightPath";
import { useOwlWorld } from "@/components/owl-world/owlStore";
import { useQuality } from "@/components/owl-world/quality";
import { usePointerCursor } from "@/components/owl-world/Corridor";
import { makeSign } from "@/components/owl-world/cardTexture";
import { CV_FILENAME, CV_URL } from "@/config/site";
import { STONE, stoneMaterial } from "@/components/owl-world/stone";

/**
 * A wrought-iron mailbox on a stone pillar by the path at home, with a
 * quest-marker arrow bobbing over it and a ring pulsing at its foot. Hover it
 * and the flag goes up, the door drops open and a letter peeks out (the arrow
 * gives way to a tooltip); click it to download the CV.
 */

// The tooltip is ordinary DOM in the page overlay (MailboxTooltip below);
// the scene moves it to sit over the mailbox each frame
export const MAILBOX_TIP_ID = "owl-mailbox-tip";

// By the garden path, low in the middle of the home shot, angled to the camera
const POSITION = new THREE.Vector3(0.45, 0, -2.6);
const YAW = Math.atan2(0.9 - POSITION.x, 2.6 - POSITION.z) + 0.35;

const POST_H = 1.02;
const BODY_W = 0.27;
const BODY_L = 0.48;
const BODY_R = BODY_W / 2;
const ARROW_Y = POST_H + 0.78;
const MARKER = new THREE.Color("#ffc95c").multiplyScalar(2.2);

const _tip = new THREE.Vector3();

export function downloadCv() {
  const a = document.createElement("a");
  a.href = CV_URL;
  a.download = CV_FILENAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function Mailbox() {
  const { accentLights } = useQuality();
  const atHome = useOwlWorld((s) => s.activeStop === STOP_INDEX.home || s.activeStop === LAST_STOP);
  const [hovered, setHovered] = useState(false);
  const hot = hovered && atHome;
  usePointerCursor(hot);

  const flag = useRef<THREE.Group>(null);
  const door = useRef<THREE.Group>(null);
  const letter = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.PointLight>(null);
  const flagMat = useRef<THREE.MeshStandardMaterial>(null);
  const open = useRef(0);
  const shown = useRef(0);
  const arrow = useRef<THREE.Group>(null);
  const arrowMat = useRef<THREE.MeshBasicMaterial>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const anchor = useRef<THREE.Object3D>(null);

  // Lightly weathered: in its own frame the pillar's middle is y = 0, so full moss would climb half way up
  const stone = useMemo(() => stoneMaterial(STONE.light, undefined, { weather: 0.4 }), []);
  useEffect(() => () => stone.dispose(), [stone]);
  const plate = useMemo(() => makeSign("Marcus", "Mail · CV", { bg: "#efe5d3", fg: "#2c2420", accent: "#a8834a" }), []);
  useEffect(() => () => plate.dispose(), [plate]);

  useFrame(({ clock, camera, size }, dt) => {
    open.current = THREE.MathUtils.damp(open.current, hot ? 1 : 0, 7, dt);
    shown.current = THREE.MathUtils.damp(shown.current, atHome ? 1 : 0, 4, dt);
    const o = open.current;
    const t = clock.elapsedTime;

    // Quest marker: bobs and turns while there's mail waiting, shrinks away
    // once the mailbox has your attention
    const marker = shown.current * (1 - o);
    if (arrow.current) {
      arrow.current.position.y = ARROW_Y + Math.abs(Math.sin(t * 2.6)) * 0.12;
      arrow.current.rotation.y = t * 1.4;
      arrow.current.scale.setScalar(Math.max(0.001, marker));
    }
    if (arrowMat.current) arrowMat.current.opacity = marker * (0.85 + Math.sin(t * 5.2) * 0.15);
    const pulse = (t * 0.7) % 1;
    if (ring.current) ring.current.scale.setScalar(0.6 + pulse * 1.1);
    if (ringMat.current) ringMat.current.opacity = shown.current * (1 - pulse) * 0.8;

    // Place the DOM tooltip over the mailbox
    const tip = document.getElementById(MAILBOX_TIP_ID);
    if (tip && anchor.current) {
      anchor.current.getWorldPosition(_tip).project(camera);
      const x = (_tip.x * 0.5 + 0.5) * size.width;
      const y = (-_tip.y * 0.5 + 0.5) * size.height;
      tip.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${(y + (1 - o) * 10).toFixed(1)}px)`;
      tip.style.opacity = o.toFixed(3);
    }
    // Flag: down along the side at rest, up when there's mail to take
    if (flag.current) flag.current.rotation.x = THREE.MathUtils.lerp(Math.PI / 2, 0, o) + Math.sin(clock.elapsedTime * 9) * 0.04 * o;
    if (door.current) door.current.rotation.x = o * 1.15;
    if (letter.current) letter.current.position.z = BODY_L / 2 - 0.14 + o * 0.17;
    if (glow.current) glow.current.intensity = 0.4 + o * 3.5;
    if (flagMat.current) flagMat.current.emissiveIntensity = 0.25 + o * 1.6;
  });

  const over = (e: ThreeEvent<PointerEvent>) => {
    if (!atHome) return;
    e.stopPropagation();
    setHovered(true);
  };

  return (
    <group position={POSITION} rotation-y={YAW}>
      {/* A plain stone pillar like the castle's, with a cap slab */}
      <mesh material={stone} position-y={POST_H / 2}>
        <boxGeometry args={[0.3, POST_H, 0.3]} />
      </mesh>
      <mesh position={[0, POST_H - 0.03, 0]}>
        <boxGeometry args={[0.36, 0.06, 0.54]} />
        <meshStandardMaterial color={STONE.dark} roughness={0.95} />
      </mesh>

      {/* Quest marker: a glowing arrow over the box, a ring at its foot */}
      <group ref={arrow} position-y={ARROW_Y} userData={{ noShadow: true }}>
        <mesh position-y={-0.08} rotation-x={Math.PI}>
          <coneGeometry args={[0.11, 0.18, 4]} />
          <meshBasicMaterial ref={arrowMat} color={MARKER} toneMapped={false} transparent depthWrite={false} />
        </mesh>
        <mesh position-y={0.08}>
          <boxGeometry args={[0.07, 0.17, 0.07]} />
          <meshBasicMaterial color={MARKER} toneMapped={false} transparent opacity={0.9} depthWrite={false} />
        </mesh>
      </group>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.03} userData={{ noShadow: true }}>
        <ringGeometry args={[0.32, 0.38, 40]} />
        <meshBasicMaterial ref={ringMat} color={MARKER} toneMapped={false} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      <group
        position-y={POST_H + 0.02}
        onPointerOver={over}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => {
          if (!atHome) return;
          e.stopPropagation();
          useOwlWorld.getState().setCvPrompt(true);
        }}
      >
        {/* Body: a box with a rounded top, open at the front */}
        <mesh position-y={BODY_R * 0.5}>
          <boxGeometry args={[BODY_W, BODY_R, BODY_L]} />
          <meshStandardMaterial color="#33312e" metalness={0.7} roughness={0.45} />
        </mesh>
        <mesh position-y={BODY_R} rotation-x={-Math.PI / 2}>
          <cylinderGeometry args={[BODY_R, BODY_R, BODY_L, 20, 1, false, -Math.PI / 2, Math.PI]} />
          <meshStandardMaterial color="#33312e" metalness={0.7} roughness={0.45} side={THREE.DoubleSide} />
        </mesh>
        {/* Back cap */}
        <mesh position={[0, BODY_R * 0.75, -BODY_L / 2 + 0.005]}>
          <boxGeometry args={[BODY_W - 0.01, BODY_R * 1.5, 0.01]} />
          <meshStandardMaterial color="#26241f" metalness={0.7} roughness={0.5} />
        </mesh>
        {/* The letter inside, sliding out when the door opens */}
        <mesh ref={letter} position={[0, BODY_R * 0.8, BODY_L / 2 - 0.14]} rotation-x={-0.1}>
          <boxGeometry args={[BODY_W * 0.7, BODY_R * 0.9, 0.2]} />
          <meshStandardMaterial color="#f6eedf" roughness={0.8} emissive="#fff2d6" emissiveIntensity={0.25} />
        </mesh>
        {/* Door, hinged along its bottom edge */}
        <group ref={door} position={[0, 0, BODY_L / 2]}>
          <mesh position={[0, BODY_R * 0.8, 0.008]}>
            <boxGeometry args={[BODY_W + 0.012, BODY_R * 1.6 + 0.01, 0.016]} />
            <meshStandardMaterial color="#2b2925" metalness={0.7} roughness={0.42} />
          </mesh>
          <mesh position={[0, BODY_R * 1.25, 0.022]}>
            <boxGeometry args={[0.06, 0.02, 0.02]} />
            <meshStandardMaterial color="#c9a45c" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
        {/* Flag on the right side, pivoting at its root */}
        <group ref={flag} position={[BODY_W / 2 + 0.018, BODY_R * 0.7, -BODY_L * 0.15]}>
          <mesh position-y={0.11}>
            <boxGeometry args={[0.014, 0.22, 0.014]} />
            <meshStandardMaterial color="#3a3a3a" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.19, 0.045]}>
            <boxGeometry args={[0.012, 0.075, 0.08]} />
            <meshStandardMaterial ref={flagMat} color="#d8352f" emissive="#ff3b2f" emissiveIntensity={0.25} roughness={0.5} />
          </mesh>
        </group>
        {/* Name plate on the left side */}
        <mesh position={[-BODY_W / 2 - 0.003, BODY_R * 0.75, 0]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[0.3, 0.094]} />
          <meshStandardMaterial map={plate} roughness={0.7} />
        </mesh>
        {/* Generous invisible hit box: the mailbox is small on screen */}
        <mesh position-y={BODY_R * 0.6} userData={{ noShadow: true }}>
          <boxGeometry args={[BODY_W * 2.2, BODY_R * 3.4, BODY_L * 1.4]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
        {accentLights && <pointLight ref={glow} position={[0, 0.25, BODY_L / 2 + 0.25]} color="#ffcf8a" intensity={0.4} distance={2.2} decay={1.6} />}

        <object3D ref={anchor} position={[0, BODY_R * 2 + 0.12, 0]} />
      </group>
    </group>
  );
}

/** The mailbox's tooltip; Mailbox positions and fades it every frame */
export function MailboxTooltip() {
  return (
    <div
      id={MAILBOX_TIP_ID}
      role="tooltip"
      aria-hidden
      className="owl-glass pointer-events-none fixed left-0 top-0 z-20 whitespace-nowrap rounded-2xl px-4 py-2.5 text-center"
      style={{ opacity: 0 }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-lantern">You&apos;ve got mail</p>
      <p className="text-sm font-semibold text-moon-50">Download CV here ↓</p>
    </div>
  );
}
