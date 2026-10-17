"use client";

import { useMemo, useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CORRIDOR_X, MUSEUM_CENTER } from "@/components/owl-world/flightPath";
import { houseToWorld } from "@/components/owl-world/homePlan";
import { useQuality } from "@/components/owl-world/quality";
import Garland from "@/themes/shared/Garland";
import { LAB } from "@/themes/shared/lab";
import { facingRoad, ROAD_POSTS, WEB } from "@/themes/shared/web";
import { MUSEUM } from "@/themes/shared/museum";
import { HOME_EYE, mulberry32 } from "@/themes/shared/random";
import { flicker, Pumpkin, PumpkinKit } from "@/themes/halloween/pumpkin";

/**
 * Halloween: jack-o'-lanterns round the mailbox and along the garden wall,
 * strung across the web products and 3D lab gates, at the foot of every
 * lamp along the road and floating down the lab's aisle, strung
 * over the museum walls with cobwebs in their corners, and bats circling
 * over all three. All primitives, like the rest of the scene.
 */

// [x, z, size (m), lit]: world space round the mailbox...
const HOME_PUMPKINS: [number, number, number, boolean][] = [
  [1.05, -2.35, 0.26, true],
  [0.0, -2.95, 0.18, true],
  [1.5, -2.8, 0.14, false],
  [-1.0, -2.7, 0.22, true],
  [-0.9, -3.5, 0.15, false],
  [1.15, -3.25, 0.2, true],
];
// ...and in the castle's frame, along the foot of the garden wall and by the gate
const WALL_PUMPKINS: [number, number, number, boolean][] = [
  [-3.0, 10.1, 0.24, true],
  [-2.35, 10.25, 0.15, false],
  [-5.2, 10.1, 0.2, true],
  [-1.0, 8.4, 0.24, true],
  [1.0, 8.6, 0.2, true],
];

// Warm glows over the mailbox cluster and at the lab gate (accent lights only)
const GLOWS: [number, number, number][] = [
  [0.4, 0.45, -2.9],
  [LAB.gate.x, 1.2, LAB.gate.z + 1],
  [WEB.gate.x, 1.2, WEB.gate.z + 1],
];

function HomePumpkins() {
  const specs = useMemo(() => {
    const rand = mulberry32(31);
    const all = [
      ...HOME_PUMPKINS.map(([x, z, size, lit]) => ({ pos: new THREE.Vector3(x, 0, z), size, lit })),
      ...WALL_PUMPKINS.map(([x, z, size, lit]) => ({ pos: houseToWorld(x, 0, z), size, lit })),
    ];
    return all.map(({ pos, size, lit }, i) => ({
      // Sunk a little into the grass
      position: [pos.x, size * 0.52, pos.z] as [number, number, number],
      size,
      // Lit ones grin at the home camera, give or take; the rest any way
      yaw: lit ? Math.atan2(HOME_EYE.x - pos.x, HOME_EYE.z - pos.z) + (rand() - 0.5) * 0.5 : rand() * Math.PI * 2,
      lit,
      seed: i * 1.7 + rand() * 10,
    }));
  }, []);
  return (
    <>
      {specs.map((s, i) => (
        <Pumpkin key={i} {...s} />
      ))}
    </>
  );
}

const BULBS = { count: 14, colors: ["#ff8a2a", "#a45cff"], blink: true };

/** A little lit pumpkin hanging off a garland on a cord */
function hangingPumpkin(i: number, size = 0.13) {
  return (
    <>
      <mesh position-y={-0.08}>
        <cylinderGeometry args={[0.005, 0.005, 0.16, 4]} />
        <meshStandardMaterial color="#2a2420" />
      </mesh>
      <Pumpkin position={[0, -0.25, 0]} size={size} seed={i * 3.3} />
    </>
  );
}

/** The lab gate: a string of orange and violet bulbs with lanterns hung off it, pumpkins either side of the aisle, more floating overhead */
function LabPumpkins() {
  return (
    <>
      <Garland {...LAB.garland} bulbs={BULBS} hangs={3}>
        {(i) => hangingPumpkin(i, i === 1 ? 0.17 : 0.13)}
      </Garland>
      {LAB.aisleSides.map(([x, z], side) => (
        <group key={side}>
          <Pumpkin position={[x + (side ? 0.45 : -0.45), 0.3 * 0.52, z + 0.3]} size={0.3} yaw={(side ? -1 : 1) * 0.3} seed={side * 5} />
          <Pumpkin position={[x + (side ? -0.35 : 0.35), 0.17 * 0.52, z + 0.45]} size={0.17} yaw={(side ? 1 : -1) * 0.4} seed={side * 5 + 2} />
        </group>
      ))}
      {LAB.overhead.map((p, i) => (
        <Pumpkin key={i} position={p} size={0.26} bob={0.18} seed={i * 2.1 + 1} />
      ))}
    </>
  );
}

/** The web products gate: the same string of bulbs and pumpkins, a pumpkin pile by each post */
function WebPumpkins() {
  return (
    <>
      <Garland {...WEB.garland} bulbs={BULBS} hangs={3}>
        {(i) => hangingPumpkin(i + 7, i === 1 ? 0.17 : 0.13)}
      </Garland>
      {WEB.gateSides.map(([x, z], side) => (
        <group key={side}>
          <Pumpkin position={[x, 0.3 * 0.52, z]} size={0.3} yaw={(side ? -1 : 1) * 0.25} seed={side * 5 + 11} />
          <Pumpkin position={[x + (side ? 0.4 : -0.4), 0.18 * 0.52, z - 0.25]} size={0.18} yaw={(side ? -1 : 1) * 0.5} seed={side * 5 + 13} lit={false} />
        </group>
      ))}
    </>
  );
}

/** A lit pumpkin at the foot of every lamp along the road, grinning at the road */
function RoadPumpkins() {
  return (
    <>
      {ROAD_POSTS.map(({ pos, away }, i) => (
        <Pumpkin
          key={i}
          position={[pos.x + away.x * 0.3, 0.2 * 0.52, pos.z + away.z * 0.3]}
          size={0.2}
          yaw={facingRoad(away)}
          seed={i * 2.7 + 21}
        />
      ))}
    </>
  );
}

/** A cobweb fanned into the corner under a wall's frieze; `side` -1 for the left corner */
function cobwebGeometry(side: number) {
  const pts: number[] = [];
  const R = 0.75;
  const spokes = 7;
  const rings = 5;
  // Angles from straight down round to along the wall, toward its middle
  const dir = (k: number) => {
    const a = -Math.PI / 2 + (side < 0 ? 1 : -1) * (k / (spokes - 1)) * (Math.PI / 2);
    return [Math.cos(a), Math.sin(a)] as const;
  };
  for (let k = 0; k < spokes; k++) {
    const [x, y] = dir(k);
    pts.push(0, 0, 0, x * R, y * R, 0);
  }
  for (let r = 1; r <= rings; r++) {
    const rad = (r / rings) * R * 0.95;
    for (let k = 0; k < spokes - 1; k++) {
      const [x0, y0] = dir(k);
      const [x1, y1] = dir(k + 1);
      // Each thread sags a little toward the corner between spokes
      const mx = ((x0 + x1) / 2) * rad * 0.9;
      const my = ((y0 + y1) / 2) * rad * 0.9;
      pts.push(x0 * rad, y0 * rad, 0, mx, my, 0, mx, my, 0, x1 * rad, y1 * rad, 0);
    }
  }
  return new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
}

function MuseumHalloween() {
  const { webs, webMat } = useMemo(
    () => ({
      webs: [cobwebGeometry(-1), cobwebGeometry(1)],
      webMat: new THREE.LineBasicMaterial({ color: "#d8d4e8", transparent: true, opacity: 0.45 }),
    }),
    [],
  );
  useEffect(
    () => () => {
      webs.forEach((g) => g.dispose());
      webMat.dispose();
    },
    [webs, webMat],
  );
  return (
    <>
      {MUSEUM.garlands.map((g, w) => (
        <Garland key={w} {...g} bulbs={BULBS} hangs={3}>
          {(i) => hangingPumpkin(i + w * 3)}
        </Garland>
      ))}
      {MUSEUM.walls.map((w, i) =>
        [-1, 1].map((side) => (
          <lineSegments key={`${i}${side}`} geometry={webs[side < 0 ? 0 : 1]} material={webMat} position={w.at(side * w.halfWidth, 4.79, 0.27)} rotation-y={w.yaw} />
        )),
      )}
      {/* A big one before each pylon, grinning at the pedestal */}
      {MUSEUM.pylons.map((p, i) => {
        const at = p.at(0, 1.25);
        return <Pumpkin key={i} position={[at.x, 0.32 * 0.52 + 0.02, at.z]} size={0.32} yaw={p.yaw} seed={i * 4.4 + 9} />;
      })}
    </>
  );
}

function Glows() {
  const { accentLights } = useQuality();
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  useFrame(({ clock }) => {
    lights.current.forEach((l, i) => {
      if (l) l.intensity = 3 * flicker(clock.elapsedTime, i * 5.3);
    });
  });
  if (!accentLights) return null;
  return (
    <>
      {GLOWS.map((p, i) => (
        <pointLight key={i} ref={(l) => void (lights.current[i] = l)} position={p} color="#ff8a2a" intensity={3} distance={3.5} decay={1.8} />
      ))}
    </>
  );
}

// ------------------------------------------------------------------ bats

interface BatFlock {
  count: number;
  center: [number, number, number];
  radius: [number, number];
  height: [number, number];
}

// A flock across the home view, one round the castle's towers, one each over the web products and the 3D lab, one over the museum
const FLOCKS: BatFlock[] = [
  { count: 9, center: [2.0, 0, -8.5], radius: [2.5, 5.5], height: [2.7, 4.6] },
  { count: 6, center: [7.2, 0, -13.5], radius: [3, 6], height: [6, 9] },
  { count: 5, center: [CORRIDOR_X, 0, -25], radius: [2.5, 5], height: [6.2, 8.5] },
  { count: 7, center: [CORRIDOR_X, 0, -53], radius: [2.5, 5], height: [6.2, 8.5] },
  { count: 8, center: [MUSEUM_CENTER.x, 0, MUSEUM_CENTER.z - 4], radius: [3.5, 7], height: [6.2, 9] },
];

/** One wing, reaching out along +X, its leading edge toward +Z */
function wingGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.05);
  s.lineTo(0.12, 0.09);
  s.lineTo(0.32, 0.03);
  s.quadraticCurveTo(0.25, 0, 0.22, -0.08);
  s.quadraticCurveTo(0.16, -0.03, 0.11, -0.09);
  s.quadraticCurveTo(0.06, -0.04, 0, -0.06);
  s.closePath();
  return new THREE.ShapeGeometry(s).rotateX(Math.PI / 2);
}

interface Bat {
  center: THREE.Vector3;
  radius: number;
  height: number;
  // rad/s round the loop (signed), and where it starts
  rate: number;
  phase: number;
  scale: number;
  flap: number;
}

const _pos = new THREE.Vector3();
const _vel = new THREE.Vector3();

function Bats() {
  const { wing, body, material, bats } = useMemo(() => {
    const rand = mulberry32(13);
    const lerp = ([a, b]: [number, number]) => a + rand() * (b - a);
    const bats: Bat[] = FLOCKS.flatMap((f) =>
      Array.from({ length: f.count }, () => ({
        center: new THREE.Vector3(...f.center),
        radius: lerp(f.radius),
        height: lerp(f.height),
        rate: (0.35 + rand() * 0.35) * (rand() < 0.5 ? -1 : 1),
        phase: rand() * Math.PI * 2,
        scale: 0.8 + rand() * 0.5,
        flap: 14 + rand() * 8,
      })),
    );
    return {
      wing: wingGeometry(),
      body: new THREE.SphereGeometry(0.05, 10, 8).scale(0.8, 0.7, 1.6),
      material: new THREE.MeshBasicMaterial({ color: "#0c0a14", side: THREE.DoubleSide }),
      bats,
    };
  }, []);

  useEffect(
    () => () => {
      wing.dispose();
      body.dispose();
      material.dispose();
    },
    [wing, body, material],
  );

  const groups = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    bats.forEach((b, i) => {
      const g = groups.current[i];
      if (!g) return;
      // A wobbly ellipse, dipping and rising as it goes
      const a = b.phase + b.rate * t;
      _pos.set(Math.cos(a) * b.radius, b.height + Math.sin(a * 2.3) * 0.4, Math.sin(a) * b.radius * 0.6).add(b.center);
      _vel.set(-Math.sin(a) * b.radius, Math.cos(a * 2.3) * 0.92, Math.cos(a) * b.radius * 0.6).multiplyScalar(b.rate);
      g.position.copy(_pos);
      g.lookAt(_pos.add(_vel));
      // Banked into the turn
      g.rotateZ(Math.sign(b.rate) * 0.35);
      const flap = Math.sin(t * b.flap + b.phase) * 0.9;
      const [, right, left] = g.children;
      right!.rotation.z = flap;
      left!.rotation.z = -flap;
    });
  });

  return (
    <group userData={{ noShadow: true }}>
      {bats.map((b, i) => (
        <group key={i} ref={(g) => void (groups.current[i] = g)} scale={b.scale}>
          <mesh geometry={body} material={material} />
          <mesh geometry={wing} material={material} />
          <mesh geometry={wing} material={material} scale-x={-1} />
        </group>
      ))}
    </group>
  );
}

export default function HalloweenScene() {
  return (
    <>
      <PumpkinKit>
        <HomePumpkins />
        <WebPumpkins />
        <LabPumpkins />
        <RoadPumpkins />
        <MuseumHalloween />
      </PumpkinKit>
      <Glows />
      <Bats />
    </>
  );
}
