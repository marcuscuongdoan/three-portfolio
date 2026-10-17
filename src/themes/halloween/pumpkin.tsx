"use client";

import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

/** Jack-o'-lanterns: the shared geometry and face, and one pumpkin */

/** A squat, ribbed unit pumpkin, dimpled at the stem; its front (u = 0.25) faces +Z */
function pumpkinGeometry() {
  const g = new THREE.SphereGeometry(1, 40, 24);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // Ten lobes, with a lobe (not a groove) at the front for the face
    const rib = 0.9 + 0.1 * Math.sqrt(Math.abs(Math.sin(Math.atan2(v.z, v.x) * 5)));
    const y = v.y * 0.72 * (1 - 0.25 * Math.pow(Math.abs(v.y), 8));
    p.setXYZ(i, v.x * rib, y, v.z * rib);
  }
  g.computeVertexNormals();
  return g;
}

/** The carved face as an emissive map, centred where the sphere faces +Z */
function faceTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#fff";
  ctx.shadowColor = "#ffcf80";
  ctx.shadowBlur = 6;
  const tri = (a: [number, number], b: [number, number], d: [number, number]) => {
    ctx.beginPath();
    ctx.moveTo(...a);
    ctx.lineTo(...b);
    ctx.lineTo(...d);
    ctx.closePath();
    ctx.fill();
  };
  // Eyes and nose
  tri([76, 116], [114, 116], [97, 80]);
  tri([142, 116], [180, 116], [159, 80]);
  tri([120, 134], [136, 134], [128, 121]);
  // A crescent grin, two teeth left standing in it
  ctx.beginPath();
  ctx.moveTo(70, 142);
  ctx.quadraticCurveTo(128, 210, 186, 142);
  ctx.quadraticCurveTo(128, 170, 70, 142);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#000";
  ctx.fillRect(98, 150, 13, 12);
  ctx.fillRect(146, 150, 13, 12);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeKit() {
  return {
    body: pumpkinGeometry(),
    stem: new THREE.CylinderGeometry(0.06, 0.1, 0.3, 6).translate(0, 0.15, 0),
    stemMat: new THREE.MeshStandardMaterial({ color: "#4f5a27", roughness: 0.9 }),
    skin: new THREE.MeshStandardMaterial({ color: "#e0701c", roughness: 0.62 }),
    face: faceTexture(),
  };
}
const Kit = createContext<ReturnType<typeof makeKit> | null>(null);

/** Makes the shared pieces once for every pumpkin inside it */
export function PumpkinKit({ children }: { children: ReactNode }) {
  const kit = useMemo(() => makeKit(), []);
  useEffect(() => () => Object.values(kit).forEach((x) => x.dispose()), [kit]);
  return <Kit.Provider value={kit}>{children}</Kit.Provider>;
}

/** A candle's unsteady glow, about 1 */
export const flicker = (t: number, seed: number) =>
  0.82 + 0.1 * Math.sin(t * 11 + seed) + 0.06 * Math.sin(t * 27.3 + seed * 3.1) + 0.04 * Math.sin(t * 53 + seed * 7);

export interface PumpkinProps {
  /** Its centre; a pumpkin on the ground sits at y = size * 0.52 */
  position: [number, number, number];
  size: number;
  /** Which way the face looks (0 = +Z) */
  yaw?: number;
  lit?: boolean;
  seed?: number;
  /** Floating: how far it bobs (m) */
  bob?: number;
}

export function Pumpkin({ position, size, yaw = 0, lit = true, seed = 0, bob = 0 }: PumpkinProps) {
  const kit = useContext(Kit)!;
  // Each lit one flickers on its own
  const material = useMemo(
    () =>
      lit
        ? new THREE.MeshStandardMaterial({
            color: "#e0701c",
            roughness: 0.62,
            emissive: new THREE.Color("#ffa53a"),
            emissiveMap: kit.face,
            emissiveIntensity: 2.6,
          })
        : kit.skin,
    [lit, kit],
  );
  useEffect(() => () => void (lit && material.dispose()), [lit, material]);

  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (lit && body.current) (body.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.6 * flicker(t, seed);
    if (bob && group.current) {
      group.current.position.y = position[1] + Math.sin(t * 0.9 + seed) * bob;
      group.current.rotation.y = yaw + Math.sin(t * 0.5 + seed) * 0.25;
    }
  });

  return (
    <group ref={group} position={position} rotation-y={yaw} scale={size}>
      <mesh ref={body} geometry={kit.body} material={material} />
      <mesh geometry={kit.stem} material={kit.stemMat} position-y={0.5} rotation={[0.25, seed, 0.15]} />
    </group>
  );
}
