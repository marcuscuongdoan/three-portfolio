"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CORRIDOR_X, MUSEUM_CENTER, MUSEUM_RADIUS, PERCH_HOME } from "@/components/owl-world/flightPath";
import {
  broadleafTree,
  bushGeometry,
  coniferTree,
  foliageMaterial,
  grassTuftGeometry,
  makeBarkTexture,
  makeGrassTexture,
  makeLeafTexture,
  makeNeedleTexture,
  mulberry32,
  TreeGeometry,
} from "@/components/owl-world/foliage";
import { withWind } from "@/components/owl-world/wind";

/**
 * Trees, shrubs and grass. The perch tree is grown around the owl (nothing in
 * front of the camera, nothing in the owl's way); the woods are a handful of
 * grown variants instanced across the valley.
 */

// The perch tree's root; the static branch the owl sits on comes off this trunk
export const PERCH_TRUNK = new THREE.Vector3(-1.5, 0, -1.0);
const HOUSE = { x: 2.8, z: -11.5, hx: 4.4, hz: 4 };

function useFoliageKit() {
  const kit = useMemo(() => {
    const leafTex = makeLeafTexture(1);
    const needleTex = makeNeedleTexture(2);
    const grassTex = makeGrassTexture(3);
    const barkTex = makeBarkTexture(4);
    const bark = (sway: number) =>
      withWind(new THREE.MeshStandardMaterial({ map: barkTex, color: "#8a7462", roughness: 1 }), { sway, rustle: 0, height: 9 });
    return {
      textures: [leafTex, needleTex, grassTex, barkTex],
      perchBark: new THREE.MeshStandardMaterial({ map: barkTex, color: "#8a7462", roughness: 1 }),
      perchLeaves: withWind(foliageMaterial(leafTex, { color: "#c9d6b0" }), { sway: 0.07, rustle: 0.025, height: 7 }),
      woodsBark: bark(0.2),
      woodsLeaves: withWind(foliageMaterial(leafTex), { sway: 0.2, rustle: 0.05, height: 9 }),
      woodsNeedles: withWind(foliageMaterial(needleTex, { color: "#7f9a86" }), { sway: 0.18, rustle: 0.03, height: 10 }),
      bush: withWind(foliageMaterial(leafTex, { color: "#b6c79a" }), { sway: 0.04, rustle: 0.02, height: 1.5 }),
      grass: withWind(foliageMaterial(grassTex, { roughness: 1 }), { sway: 0.06, rustle: 0.015, height: 0.45 }),
    };
  }, []);
  useEffect(
    () => () => {
      kit.textures.forEach((t) => t.dispose());
    },
    [kit],
  );
  return kit;
}
type Kit = ReturnType<typeof useFoliageKit>;

function PerchTree({ kit }: { kit: Kit }) {
  const tree = useMemo(() => {
    // In the tree's own space: the owl, and the line from it to the camera
    const owl = new THREE.Vector3(PERCH_HOME.x, PERCH_HOME.y + 0.35, PERCH_HOME.z).sub(PERCH_TRUNK);
    return broadleafTree({
      seed: 41,
      height: 7.4,
      trunkRadius: 0.3,
      forkAt: 0.56,
      lean: new THREE.Vector3(-0.55, 0, -0.35),
      cardSize: 1.15,
      cardsPerTip: 10,
      fillCards: 60,
      exclude: (p) =>
        p.distanceTo(owl) < 1.6 ||
        p.y < 3.8 ||
        // Keep the crown inside the circle the owl flies round it
        Math.hypot(p.x, p.z) > 2.9 ||
        // ...and out of the home shot's foreground
        (p.z > 1.6 && p.x > 0),
    });
  }, []);
  useEffect(() => () => disposeTree(tree), [tree]);
  return (
    <group position={PERCH_TRUNK}>
      <mesh geometry={tree.bark} material={kit.perchBark} />
      <mesh geometry={tree.leaves} material={kit.perchLeaves} />
    </group>
  );
}

const disposeTree = (t: TreeGeometry) => {
  t.bark.dispose();
  t.leaves.dispose();
};

interface Placed {
  x: number;
  z: number;
  s: number;
  turn: number;
  tint: THREE.Color;
}

function InstancedTrees({ tree, placed, bark, leaves }: { tree: TreeGeometry; placed: Placed[]; bark: THREE.Material; leaves: THREE.Material }) {
  const barkRef = useRef<THREE.InstancedMesh>(null);
  const leafRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    placed.forEach((p, i) => {
      o.position.set(p.x, 0, p.z);
      o.rotation.set(0, p.turn, 0);
      o.scale.setScalar(p.s);
      o.updateMatrix();
      barkRef.current!.setMatrixAt(i, o.matrix);
      leafRef.current!.setMatrixAt(i, o.matrix);
      leafRef.current!.setColorAt(i, p.tint);
    });
    barkRef.current!.instanceMatrix.needsUpdate = true;
    leafRef.current!.instanceMatrix.needsUpdate = true;
    if (leafRef.current!.instanceColor) leafRef.current!.instanceColor.needsUpdate = true;
    // Instances spread far beyond the source tree's bounds
    barkRef.current!.computeBoundingSphere();
    leafRef.current!.computeBoundingSphere();
  }, [placed]);
  return (
    <>
      <instancedMesh ref={barkRef} args={[tree.bark, bark, placed.length]} />
      <instancedMesh ref={leafRef} args={[tree.leaves, leaves, placed.length]} />
    </>
  );
}

const BROADLEAF_VARIANTS = [
  { seed: 11, height: 7.5, trunkRadius: 0.24 },
  { seed: 23, height: 6.5, trunkRadius: 0.2, forkAt: 0.36 },
  { seed: 37, height: 8.5, trunkRadius: 0.28, levels: 3 },
];
const CONIFER_VARIANTS = [
  { seed: 5, height: 9, width: 2.3 },
  { seed: 9, height: 11, width: 2.7 },
];

function Woods({ kit }: { kit: Kit }) {
  const { broadleaves, conifers, placements } = useMemo(() => {
    const rand = mulberry32(7);
    const broad = BROADLEAF_VARIANTS.map((v) => broadleafTree({ ...v, cardSize: 1.5, cardsPerTip: 9, fillCards: 70 }));
    const coni = CONIFER_VARIANTS.map((v) => coniferTree(v));
    const lists: Placed[][] = [...broad, ...coni].map(() => []);
    let placedCount = 0;
    while (placedCount < 120) {
      const x = -70 + rand() * 130;
      const z = 30 - rand() * 170;
      // Keep clear of the corridor, the home clearing and the museum
      if (Math.abs(x - CORRIDOR_X) < 9 && z < 0 && z > -95) continue;
      if (Math.hypot(x - 2, z + 6) < 14) continue;
      if (Math.hypot(x - MUSEUM_CENTER.x, z - MUSEUM_CENTER.z) < 18) continue;
      const pine = rand() < 0.4;
      const variant = pine ? broad.length + Math.floor(rand() * coni.length) : Math.floor(rand() * broad.length);
      const tint = new THREE.Color().setHSL(0.24 + rand() * 0.08, 0.25 + rand() * 0.25, 0.75 + rand() * 0.25);
      lists[variant]!.push({ x, z, s: 0.75 + rand() * 0.6, turn: rand() * Math.PI * 2, tint });
      placedCount++;
    }
    return { broadleaves: broad, conifers: coni, placements: lists };
  }, []);
  useEffect(
    () => () => {
      [...broadleaves, ...conifers].forEach(disposeTree);
    },
    [broadleaves, conifers],
  );
  return (
    <group>
      {broadleaves.map((tree, i) => (
        <InstancedTrees key={`b${i}`} tree={tree} placed={placements[i]!} bark={kit.woodsBark} leaves={kit.woodsLeaves} />
      ))}
      {conifers.map((tree, i) => (
        <InstancedTrees key={`c${i}`} tree={tree} placed={placements[broadleaves.length + i]!} bark={kit.woodsBark} leaves={kit.woodsNeedles} />
      ))}
    </group>
  );
}

// Scatter helper: an instanced mesh at points chosen by `accept`
function Scatter({
  geometry,
  material,
  count,
  seed,
  area,
  accept,
  scale,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  count: number;
  seed: number;
  area: [number, number, number, number]; // minX, maxX, minZ, maxZ
  accept: (x: number, z: number) => boolean;
  scale: [number, number];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const rand = mulberry32(seed);
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    let i = 0;
    let tries = 0;
    while (i < count && tries++ < count * 40) {
      const x = area[0] + rand() * (area[1] - area[0]);
      const z = area[2] + rand() * (area[3] - area[2]);
      if (!accept(x, z)) continue;
      o.position.set(x, 0, z);
      o.rotation.set(0, rand() * Math.PI * 2, 0);
      o.scale.setScalar(scale[0] + rand() * (scale[1] - scale[0]));
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
      ref.current!.setColorAt(i, col.setHSL(0.22 + rand() * 0.07, 0.3, 0.7 + rand() * 0.3));
      i++;
    }
    ref.current!.count = i;
    ref.current!.instanceMatrix.needsUpdate = true;
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, [count, seed, area, accept, scale]);
  // Grass takes shadows but is too fine (and too many) to cast them
  return <instancedMesh ref={ref} args={[geometry, material, count]} userData={{ receiveOnly: true }} />;
}

const inHouse = (x: number, z: number) => Math.abs(x - HOUSE.x) < HOUSE.hx && Math.abs(z - HOUSE.z) < HOUSE.hz;
// The garden path from the door
const onPath = (x: number, z: number) => z > -8.6 && z < 0.5 && Math.abs(x - (HOUSE.x + 0.22 * (z - HOUSE.z) * -1) + 0.0) < 1.1;
const nearTrunk = (x: number, z: number) => Math.hypot(x - PERCH_TRUNK.x, z - PERCH_TRUNK.z) < 0.7;
const inMuseum = (x: number, z: number) => Math.hypot(x - MUSEUM_CENTER.x, z - MUSEUM_CENTER.z) < MUSEUM_RADIUS + 3.8;

const GRASS_AREAS: { area: [number, number, number, number]; count: number; accept: (x: number, z: number) => boolean }[] = [
  // Home clearing
  { area: [-12, 14, -22, 10], count: 900, accept: (x, z) => !inHouse(x, z) && !onPath(x, z) && !nearTrunk(x, z) },
  // Along the flight corridor
  { area: [CORRIDOR_X - 14, CORRIDOR_X + 14, -78, -10], count: 700, accept: () => true },
  // Round the museum
  { area: [MUSEUM_CENTER.x - 22, MUSEUM_CENTER.x + 22, MUSEUM_CENTER.z - 22, MUSEUM_CENTER.z + 18], count: 420, accept: (x, z) => !inMuseum(x, z) },
];

const BUSH_SPOTS: [number, number, number][] = [
  // [x, z, scale] — along the house front, by the fence, at the tree's foot
  [-1.2, -7.6, 1.1],
  [0.2, -7.9, 0.8],
  [5.8, -9.4, 1.2],
  [6.9, -11.6, 1.0],
  [-2.3, -3.7, 0.9],
  [-0.8, -3.2, 1.2],
  [5.6, -2.7, 1.0],
  [7.4, -3.4, 1.3],
  [-2.4, -0.2, 0.8],
  [-0.6, -1.9, 0.6],
  [9.5, -6, 1.4],
  [-6, -6.5, 1.5],
];

function Bushes({ kit }: { kit: Kit }) {
  const geometry = useMemo(() => bushGeometry(13, 0.75), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    BUSH_SPOTS.forEach(([x, z, s], i) => {
      o.position.set(x, 0, z);
      o.rotation.set(0, i * 2.3, 0);
      o.scale.set(s, s * 0.85, s);
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, []);
  return <instancedMesh ref={ref} args={[geometry, kit.bush, BUSH_SPOTS.length]} />;
}

export default function Vegetation() {
  const kit = useFoliageKit();
  const tuft = useMemo(() => grassTuftGeometry(), []);
  useEffect(() => () => tuft.dispose(), [tuft]);
  return (
    <group>
      <PerchTree kit={kit} />
      <Woods kit={kit} />
      <Bushes kit={kit} />
      {GRASS_AREAS.map((g, i) => (
        <Scatter key={i} geometry={tuft} material={kit.grass} count={g.count} seed={100 + i} area={g.area} accept={g.accept} scale={[0.6, 1.4]} />
      ))}
    </group>
  );
}
