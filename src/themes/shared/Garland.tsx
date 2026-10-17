"use client";

import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { mulberry32 } from "@/themes/shared/random";

/**
 * A string slung between two points: a sagging rope, optionally a run of
 * little bulbs along it, and things hung from it that sway in the breeze.
 */

/** A point on the sagging string, t from 0 (`from`) to 1 (`to`) */
export function garlandPoint(from: THREE.Vector3, to: THREE.Vector3, sag: number, t: number, target = new THREE.Vector3()) {
  target.lerpVectors(from, to, t);
  target.y -= sag * 4 * t * (1 - t);
  return target;
}

export interface GarlandProps {
  from: THREE.Vector3;
  to: THREE.Vector3;
  sag: number;
  ropeColor?: string;
  bulbs?: { count: number; colors: string[]; blink?: boolean };
  /** Things hung at evenly spaced points along it (not at the ends) */
  hangs?: number;
  /** One hanging thing, drawn hanging down from its point (local origin) */
  children?: (i: number) => ReactNode;
}

export default function Garland({ from, to, sag, ropeColor = "#2a2420", bulbs, hangs = 0, children }: GarlandProps) {
  const { rope, ropeMat, bulbGeo, bulbMat, bulbData, hangAt } = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 17 }, (_, i) => garlandPoint(from, to, sag, i / 16)));
    const rand = mulberry32(41);
    const n = bulbs?.count ?? 0;
    return {
      rope: new THREE.TubeGeometry(curve, 48, 0.01, 4),
      ropeMat: new THREE.MeshStandardMaterial({ color: ropeColor, roughness: 0.85 }),
      bulbGeo: new THREE.SphereGeometry(0.035, 8, 6),
      bulbMat: new THREE.MeshBasicMaterial({ toneMapped: false }),
      bulbData: Array.from({ length: n }, (_, i) => ({
        // Hanging a hair under the rope
        pos: garlandPoint(from, to, sag, (i + 0.5) / n).add(new THREE.Vector3(0, -0.035, 0)),
        color: new THREE.Color(bulbs!.colors[i % bulbs!.colors.length]!).multiplyScalar(2.2),
        phase: rand() * Math.PI * 2,
        rate: 1.5 + rand() * 2,
      })),
      hangAt: Array.from({ length: hangs }, (_, i) => garlandPoint(from, to, sag, (i + 1) / (hangs + 1))),
    };
    // Fixed for a theme's life
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      rope.dispose();
      ropeMat.dispose();
      bulbGeo.dispose();
      bulbMat.dispose();
    },
    [rope, ropeMat, bulbGeo, bulbMat],
  );

  const lights = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = lights.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    bulbData.forEach((b, i) => {
      mesh.setMatrixAt(i, m.makeTranslation(b.pos));
      mesh.setColorAt(i, b.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [bulbData]);

  const swings = useRef<(THREE.Group | null)[]>([]);
  const _c = useMemo(() => new THREE.Color(), []);
  const blink = !!bulbs?.blink;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    swings.current.forEach((g, i) => {
      if (!g) return;
      g.rotation.z = Math.sin(t * 1.1 + i * 1.7) * 0.08;
      g.rotation.x = Math.sin(t * 0.8 + i * 2.3) * 0.05;
    });
    const mesh = lights.current;
    if (blink && mesh) {
      // Each bulb on its own beat, never quite out
      bulbData.forEach((b, i) => {
        const on = Math.sin(t * b.rate + b.phase) > -0.2 ? 1 : 0.25;
        mesh.setColorAt(i, _c.copy(b.color).multiplyScalar(on));
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      <mesh geometry={rope} material={ropeMat} />
      {bulbData.length > 0 && <instancedMesh ref={lights} args={[bulbGeo, bulbMat, bulbData.length]} userData={{ noShadow: true }} />}
      {children &&
        hangAt.map((p, i) => (
          <group key={i} position={p} ref={(g) => void (swings.current[i] = g)}>
            {children(i)}
          </group>
        ))}
    </group>
  );
}
