"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CORRIDOR_X, MUSEUM_CENTER } from "@/components/owl-world/flightPath";
import { useQuality } from "@/components/owl-world/quality";
import Falling, { type FallBox } from "@/themes/shared/Falling";
import Garland from "@/themes/shared/Garland";
import { LAB } from "@/themes/shared/lab";
import { facingRoad, ROAD_POSTS, WEB } from "@/themes/shared/web";
import { MUSEUM } from "@/themes/shared/museum";
import { mulberry32 } from "@/themes/shared/random";
import { starGeometry } from "@/themes/shared/star";

/**
 * Christmas: snow over the whole valley, a fir decked with blinking lights
 * on the left of the home view with presents under it, at the web products
 * and 3D lab gates a string of lights hung with baubles, little firs and more
 * presents, a wreath on every lamp along the road, and in the museum the
 * same lights along the walls and wreaths on the pylons.
 */

const SNOW: FallBox[] = [
  [450, 1, -5, 10, 10, 0, 9],
  [500, CORRIDOR_X, -42, 10, 36, 0, 10],
  [250, MUSEUM_CENTER.x, MUSEUM_CENTER.z, 12, 10, 0, 9],
];

// Clear of the owl, the mailbox and the statue in the home view
const TREE: [number, number, number] = [-2.8, 0, -4.8];
// [radius, height, centre y] of each tier, bottom up
const TIERS: [number, number, number][] = [
  [0.75, 0.9, 0.75],
  [0.58, 0.75, 1.15],
  [0.4, 0.6, 1.5],
];
const BULB_COLORS = ["#ff4b4b", "#ffd166", "#5cc8ff", "#7cff8a", "#fff3d6"];
const BULBS = 40;

// [x, z, w, h, d, box colour, ribbon colour, yaw]
type Present = [number, number, number, number, number, string, string, number];
const PRESENTS: Present[] = [
  [-2.15, -4.25, 0.32, 0.26, 0.32, "#c0282d", "#ffd166", 0.3],
  [-3.4, -4.2, 0.26, 0.34, 0.26, "#1f6f4a", "#f4ecdc", -0.4],
  [-2.65, -3.95, 0.22, 0.18, 0.3, "#2d4fa8", "#ff6f61", 0.9],
  [1.05, -2.4, 0.24, 0.2, 0.24, "#c0282d", "#f4ecdc", -0.2],
];

// Under the little firs either side of the lab aisle
const LAB_PRESENTS: Present[] = LAB.aisleSides.flatMap(([x, z], side): Present[] => {
  const out = side ? 1 : -1;
  return [
    [x + out * 0.35, z + 0.55, 0.3, 0.24, 0.3, "#c0282d", "#ffd166", 0.4],
    [x - out * 0.3, z + 0.5, 0.22, 0.3, 0.22, "#1f6f4a", "#f4ecdc", -0.3],
  ];
});

// Beside the little firs at the web products gate
const WEB_PRESENTS: Present[] = WEB.gateSides.flatMap(([x, z], side): Present[] => {
  const out = side ? 1 : -1;
  return [
    [x - out * 0.45, z + 0.35, 0.28, 0.22, 0.28, "#2d4fa8", "#ffd166", -0.5],
    [x + out * 0.1, z + 0.6, 0.24, 0.3, 0.24, "#c0282d", "#f4ecdc", 0.2],
  ];
});

const BAUBLE_COLORS = ["#d4232b", "#e2b13c", "#c9d2e0"];

function Tree({ position, scale, glow = false }: { position: [number, number, number]; scale: number; glow?: boolean }) {
  const { accentLights } = useQuality();
  const { mats, star, bulb, bulbs } = useMemo(() => {
    const rand = mulberry32(25);
    // Bulbs scattered over the tiers' cones, a hair proud of the needles
    const bulbs = Array.from({ length: BULBS }, (_, i) => {
      const [r, h, y] = TIERS[i % TIERS.length]!;
      const f = 0.1 + rand() * 0.8;
      const a = rand() * Math.PI * 2;
      const rad = r * (1 - f) + 0.02;
      return {
        pos: new THREE.Vector3(Math.cos(a) * rad, y - h / 2 + f * h, Math.sin(a) * rad),
        color: new THREE.Color(BULB_COLORS[i % BULB_COLORS.length]!).multiplyScalar(2.2),
        phase: rand() * Math.PI * 2,
        rate: 1.5 + rand() * 2,
      };
    });
    return {
      mats: {
        needles: new THREE.MeshStandardMaterial({ color: "#1e4a2c", roughness: 0.9 }),
        trunk: new THREE.MeshStandardMaterial({ color: "#4a3324", roughness: 1 }),
        star: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd166").multiplyScalar(3), toneMapped: false }),
        bulb: new THREE.MeshBasicMaterial({ toneMapped: false }),
      },
      star: starGeometry(),
      bulb: new THREE.SphereGeometry(0.03, 8, 6),
      bulbs,
    };
  }, []);

  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose());
      star.dispose();
      bulb.dispose();
    },
    [mats, star, bulb],
  );

  const lights = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = lights.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    bulbs.forEach((b, i) => {
      mesh.setMatrixAt(i, m.makeTranslation(b.pos));
      mesh.setColorAt(i, b.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [bulbs]);

  const starRef = useRef<THREE.Mesh>(null);
  const _c = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const mesh = lights.current;
    if (mesh) {
      // Each bulb blinks on its own beat, never quite out
      bulbs.forEach((b, i) => {
        const on = Math.sin(t * b.rate + b.phase) > -0.2 ? 1 : 0.25;
        mesh.setColorAt(i, _c.copy(b.color).multiplyScalar(on));
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    if (starRef.current) starRef.current.rotation.y = t * 0.6;
  });

  return (
    <group position={position} scale={scale}>
      <mesh material={mats.trunk} position-y={0.18}>
        <cylinderGeometry args={[0.08, 0.1, 0.36, 8]} />
      </mesh>
      {TIERS.map(([r, h, y]) => (
        <mesh key={y} material={mats.needles} position-y={y}>
          <coneGeometry args={[r, h, 14]} />
        </mesh>
      ))}
      <instancedMesh ref={lights} args={[bulb, mats.bulb, BULBS]} userData={{ noShadow: true }} />
      <mesh ref={starRef} geometry={star} material={mats.star} position-y={1.88} userData={{ noShadow: true }} />
      {glow && accentLights && <pointLight position={[0.3, 1.0, 0.6]} color="#ffd2a0" intensity={2.2} distance={3.5} decay={1.8} />}
    </group>
  );
}

function Presents({ list }: { list: Present[] }) {
  const mats = useMemo(() => {
    const out = new Map<string, THREE.MeshStandardMaterial>();
    for (const [, , , , , box, ribbon] of list) {
      for (const c of [box, ribbon]) if (!out.has(c)) out.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 }));
    }
    return out;
    // Fixed for a theme's life
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);

  return (
    <group>
      {list.map(([x, z, w, h, d, box, ribbon, yaw]) => (
        <group key={`${x}${z}`} position={[x, h / 2, z]} rotation-y={yaw}>
          <mesh material={mats.get(box)}>
            <boxGeometry args={[w, h, d]} />
          </mesh>
          {/* Ribbons both ways round, a little proud of the box */}
          <mesh material={mats.get(ribbon)}>
            <boxGeometry args={[w + 0.01, h + 0.01, 0.04]} />
          </mesh>
          <mesh material={mats.get(ribbon)}>
            <boxGeometry args={[0.04, h + 0.01, d + 0.01]} />
          </mesh>
          <mesh material={mats.get(ribbon)} position-y={h / 2 + 0.03} rotation-z={Math.PI / 4}>
            <torusGeometry args={[0.035, 0.012, 6, 12]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Shiny baubles on a string of lights */
function Baubles({ from, to, sag, hangs = 5 }: { from: THREE.Vector3; to: THREE.Vector3; sag: number; hangs?: number }) {
  const mats = useMemo(() => BAUBLE_COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.2, metalness: 0.8 })), []);
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  return (
    <Garland from={from} to={to} sag={sag} ropeColor="#1e4a2c" bulbs={{ count: 16, colors: BULB_COLORS, blink: true }} hangs={hangs}>
      {(i) => (
        <>
          <mesh position-y={-0.06}>
            <cylinderGeometry args={[0.005, 0.005, 0.12, 4]} />
            <meshStandardMaterial color="#d9a43a" />
          </mesh>
          <mesh material={mats[i % mats.length]} position-y={-0.2}>
            <sphereGeometry args={[i % 2 ? 0.07 : 0.1, 16, 12]} />
          </mesh>
        </>
      )}
    </Garland>
  );
}

/** A holly wreath with a red bow, facing +Z */
function Wreath() {
  const { mats, berry, berries } = useMemo(() => {
    const rand = mulberry32(73);
    return {
      mats: {
        holly: new THREE.MeshStandardMaterial({ color: "#1f5a32", roughness: 0.8 }),
        red: new THREE.MeshStandardMaterial({ color: "#c0282d", roughness: 0.5 }),
      },
      berry: new THREE.SphereGeometry(0.03, 8, 6),
      berries: Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2 + rand() * 0.3;
        return [Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0.07] as [number, number, number];
      }),
    };
  }, []);
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose());
      berry.dispose();
    },
    [mats, berry],
  );
  return (
    <group>
      <mesh material={mats.holly}>
        <torusGeometry args={[0.24, 0.075, 8, 24]} />
      </mesh>
      {berries.map((p, i) => (
        <mesh key={i} geometry={berry} material={mats.red} position={p} />
      ))}
      {/* The bow at the bottom: two loops and the knot */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={mats.red} position={[s * 0.07, -0.25, 0.08]} rotation-z={s * 0.6} scale={[1, 0.6, 0.5]}>
          <sphereGeometry args={[0.06, 10, 8]} />
        </mesh>
      ))}
      <mesh material={mats.red} position={[0, -0.25, 0.1]}>
        <sphereGeometry args={[0.035, 8, 6]} />
      </mesh>
    </group>
  );
}

function MuseumChristmas() {
  return (
    <>
      {MUSEUM.garlands.map((g, i) => (
        <Baubles key={i} {...g} hangs={3} />
      ))}
      {MUSEUM.pylons.map((p, i) => (
        <group key={i} position={p.at(3.3, 0.33)} rotation-y={p.yaw}>
          <Wreath />
        </group>
      ))}
      {/* Little firs before the outer pylons */}
      {MUSEUM.pylons
        .filter((p) => p.outer)
        .map((p, i) => (
          <Tree key={i} position={p.at(0.02, 1.45).toArray()} scale={0.8} />
        ))}
    </>
  );
}

export default function ChristmasScene() {
  return (
    <>
      <Falling boxes={SNOW} colors={["#ffffff", "#e6eeff"]} size={7} speed={[0.35, 0.8]} sway={0.45} seed={11} />
      <Tree position={TREE} scale={1.2} glow />
      <Presents list={PRESENTS} />
      {/* The 3D lab gate */}
      <Baubles {...LAB.garland} />
      {LAB.aisleSides.map(([x, z], side) => (
        <Tree key={side} position={[x + (side ? 0.75 : -0.75), 0, z + 0.1]} scale={0.75} />
      ))}
      <Presents list={LAB_PRESENTS} />
      {/* The web products gate */}
      <Baubles {...WEB.garland} />
      {WEB.gateSides.map(([x, z], side) => (
        <Tree key={side} position={[x + (side ? 0.3 : -0.3), 0, z - 0.2]} scale={0.7} />
      ))}
      <Presents list={WEB_PRESENTS} />
      {/* A wreath on each lamp post along the road, on its road side */}
      {ROAD_POSTS.map(({ pos, away }, i) => (
        <group key={i} position={[pos.x - away.x * 0.08, 1.1, pos.z - away.z * 0.08]} rotation-y={facingRoad(away)} scale={0.42}>
          <Wreath />
        </group>
      ))}
      <MuseumChristmas />
    </>
  );
}
