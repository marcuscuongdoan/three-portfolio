"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import Falling, { type FallBox } from "@/themes/shared/Falling";
import Fireworks from "@/themes/shared/Fireworks";
import Garland from "@/themes/shared/Garland";
import { LAB, LAB_FALL } from "@/themes/shared/lab";
import { MUSEUM, MUSEUM_FALL } from "@/themes/shared/museum";
import { mulberry32 } from "@/themes/shared/random";
import { MUSEUM_SKY, VALLEY_SKY } from "@/themes/shared/sky";
import { starGeometry } from "@/themes/shared/star";

/**
 * New Year: fireworks down the valley and behind the museum, gold glitter
 * drifting over home, the 3D lab and the museum, strings of gold lights
 * hung with stars across the lab gate and the museum walls, and bunches of
 * balloons either side of the lab aisle and before the museum's outer pylons.
 */

const GLITTER: FallBox[] = [[220, 1, -5, 8, 8, 0, 7], LAB_FALL, MUSEUM_FALL];
const BALLOON_COLORS = ["#e2b13c", "#c9d2e0", "#1d2a6b", "#f4ecdc"];

function Stars({ from, to, sag, hangs = 5 }: { from: THREE.Vector3; to: THREE.Vector3; sag: number; hangs?: number }) {
  const { geometry, material } = useMemo(
    () => ({
      geometry: starGeometry(),
      material: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd166").multiplyScalar(2.5), toneMapped: false, side: THREE.DoubleSide }),
    }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  return (
    <Garland from={from} to={to} sag={sag} ropeColor="#8a6a2a" bulbs={{ count: 18, colors: ["#ffd166", "#fff1c1"], blink: true }} hangs={hangs}>
      {(i) => (
        <>
          <mesh position-y={-0.07}>
            <cylinderGeometry args={[0.004, 0.004, 0.14, 4]} />
            <meshStandardMaterial color="#d9a43a" />
          </mesh>
          <mesh geometry={geometry} material={material} position-y={-0.24} scale={i % 2 ? 0.8 : 1.1} />
        </>
      )}
    </Garland>
  );
}

/** Where a bunch is tied, and which way (±1 in x) it leans out */
type BalloonSpot = { x: number; z: number; out: number };
const LAB_BALLOONS: BalloonSpot[] = LAB.aisleSides.map(([x, z], side) => ({ x: x + (side ? 0.9 : -0.9), z: z + 0.3, out: side ? 1 : -1 }));
const MUSEUM_BALLOONS: BalloonSpot[] = MUSEUM.pylons
  .filter((p) => p.outer)
  .map((p, side) => {
    const at = p.at(0.05, 1.3);
    return { x: at.x, z: at.z, out: side ? 1 : -1 };
  });

/** A bunch of balloons tied at each spot, bobbing on their strings */
function Balloons({ spots, seed }: { spots: BalloonSpot[]; seed: number }) {
  const { body, mats, balloons } = useMemo(() => {
    const rand = mulberry32(seed);
    const balloons = spots.flatMap(({ x, z, out }) =>
      Array.from({ length: 4 }, (_, i) => {
        const anchor = new THREE.Vector3(x, 0.05, z);
        const top = anchor.clone().add(new THREE.Vector3(out * (0.1 + rand() * 0.35), 1.5 + rand() * 0.6, (rand() - 0.5) * 0.5));
        return { anchor, top, color: i % BALLOON_COLORS.length, seed: rand() * 10 };
      }),
    );
    return {
      body: new THREE.SphereGeometry(0.17, 18, 14).scale(1, 1.2, 1),
      mats: BALLOON_COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.25, metalness: 0.6 })),
      balloons,
    };
    // Fixed for a theme's life
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(
    () => () => {
      body.dispose();
      mats.forEach((m) => m.dispose());
    },
    [body, mats],
  );

  // Each balloon swings round its anchor on a taut string
  const groups = useRef<(THREE.Group | null)[]>([]);
  const strings = useRef<(THREE.Mesh | null)[]>([]);
  const heads = useRef<(THREE.Mesh | null)[]>([]);
  const _up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const _d = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    balloons.forEach((b, i) => {
      const g = groups.current[i];
      if (!g) return;
      _d.subVectors(b.top, b.anchor);
      _d.x += Math.sin(t * 0.7 + b.seed) * 0.15;
      _d.z += Math.cos(t * 0.6 + b.seed) * 0.12;
      const len = _d.length();
      g.quaternion.setFromUnitVectors(_up, _d.divideScalar(len));
      const string = strings.current[i];
      if (string) {
        string.scale.y = len;
        string.position.y = len / 2;
      }
      const head = heads.current[i];
      if (head) head.position.y = len + 0.2;
    });
  });

  return (
    <>
      {balloons.map((b, i) => (
        <group key={i} position={b.anchor} ref={(g) => void (groups.current[i] = g)}>
          {/* The string runs up the group's y, stretched to length; the balloon rides its end */}
          <mesh ref={(m) => void (strings.current[i] = m)}>
            <cylinderGeometry args={[0.004, 0.004, 1, 4]} />
            <meshStandardMaterial color="#e6e0d0" />
          </mesh>
          <mesh ref={(m) => void (heads.current[i] = m)} geometry={body} material={mats[b.color]} />
        </group>
      ))}
    </>
  );
}

export default function NewYearScene() {
  return (
    <>
      <Fireworks {...VALLEY_SKY} bursts={6} colors={["#ffd166", "#ff6f91", "#7ad7ff", "#b9ff8a"]} />
      <Falling boxes={GLITTER} colors={["#ffd166", "#fff1c1", "#ffb84d"]} size={4} speed={[0.25, 0.5]} sway={0.6} glow seed={21} />
      <Stars {...LAB.garland} />
      <Balloons spots={LAB_BALLOONS} seed={57} />
      {/* The museum */}
      <Fireworks {...MUSEUM_SKY} bursts={4} colors={["#ffd166", "#ff6f91", "#7ad7ff", "#fff1c1"]} seed={5} />
      {MUSEUM.garlands.map((g, i) => (
        <Stars key={i} {...g} hangs={3} />
      ))}
      <Balloons spots={MUSEUM_BALLOONS} seed={61} />
    </>
  );
}
