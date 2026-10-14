"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CORRIDOR_X, MUSEUM_CENTER, MUSEUM_RADIUS, PERCH_HOME } from "@/components/owl-world/flightPath";
import {
  broadleafTree,
  bushGeometry,
  coniferTree,
  crownMaterial,
  foliageMaterial,
  grassTuftGeometry,
  makeBarkTexture,
  makeGrassTexture,
  makeLeafTexture,
  makeNeedleTexture,
  mulberry32,
  TreeGeometry,
} from "@/components/owl-world/foliage";
import { windShadow, withWind, WindOptions } from "@/components/owl-world/wind";
import { worldToHouse } from "@/components/owl-world/homePlan";

/**
 * Trees, shrubs and grass. The perch tree is grown around the owl (nothing in
 * front of the camera, nothing in the owl's way); the woods are a handful of
 * grown variants instanced across the valley.
 */

// The perch tree's root; the static branch the owl sits on comes off this trunk
export const PERCH_TRUNK = new THREE.Vector3(-1.5, 0, -1.0);

/** Sway a material in the wind, keeping shadow-pass stand-ins that sway with it */
function windy<T extends THREE.Material>(material: T, options: WindOptions, map?: THREE.Texture): T {
  material.userData.windShadow = windShadow(options, map);
  return withWind(material, options);
}
/** Props for a mesh of a `windy` material, so its shadow moves as it does */
const shadowOf = (material: THREE.Material): ReturnType<typeof windShadow> | undefined => material.userData.windShadow;

function useFoliageKit() {
  const kit = useMemo(() => {
    const leafTex = makeLeafTexture(1);
    const needleTex = makeNeedleTexture(2);
    const grassTex = makeGrassTexture(3);
    const barkTex = makeBarkTexture(4);
    const bark = (sway: number) =>
      windy(new THREE.MeshStandardMaterial({ map: barkTex, color: "#8a7462", roughness: 1 }), { sway, rustle: 0, height: 9 });
    return {
      textures: [leafTex, needleTex, grassTex, barkTex],
      perchBark: new THREE.MeshStandardMaterial({ map: barkTex, color: "#8a7462", roughness: 1 }),
      perchLeaves: windy(foliageMaterial(leafTex, { color: "#c9d6b0", vertexColors: true }), { sway: 0.07, rustle: 0.025, height: 7 }, leafTex),
      woodsBark: bark(0.2),
      // Solid crowns under the leaf fringe
      perchCrown: windy(crownMaterial("#5f7d45"), { sway: 0.07, rustle: 0.01, height: 7 }),
      woodsCrown: windy(crownMaterial("#55753c"), { sway: 0.2, rustle: 0.02, height: 9 }),
      pineCrown: windy(crownMaterial("#3d5a44"), { sway: 0.18, rustle: 0.015, height: 10 }),
      bushCrown: windy(crownMaterial("#5a7a42"), { sway: 0.04, rustle: 0.01, height: 1.5 }),
      woodsLeaves: windy(foliageMaterial(leafTex, { vertexColors: true }), { sway: 0.2, rustle: 0.05, height: 9 }, leafTex),
      woodsNeedles: windy(foliageMaterial(needleTex, { color: "#7f9a86", vertexColors: true }), { sway: 0.18, rustle: 0.03, height: 10 }, needleTex),
      bush: windy(foliageMaterial(leafTex, { color: "#b6c79a", vertexColors: true }), { sway: 0.04, rustle: 0.02, height: 1.5 }, leafTex),
      grass: withWind(foliageMaterial(grassTex, { roughness: 1 }), { sway: 0.1, rustle: 0.02, height: 0.45 }),
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
      trunkRadius: 0.34,
      forkAt: 0.56,
      levels: 4,
      lean: new THREE.Vector3(-0.55, 0, -0.35),
      cardSize: 0.95,
      fringe: 7,
      innerBlobs: 3,
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
      {/* Out of the lamps' shadows like the woods: the branch lantern hangs right
          under the crown, so all it would shadow is the crown itself, swaying */}
      <mesh geometry={tree.crown} material={kit.perchCrown} userData={{ lampShadowFree: true }} {...shadowOf(kit.perchCrown)} />
      <mesh geometry={tree.leaves} material={kit.perchLeaves} userData={{ lampShadowFree: true }} {...shadowOf(kit.perchLeaves)} />
    </group>
  );
}

const disposeTree = (t: TreeGeometry) => {
  t.bark.dispose();
  t.leaves.dispose();
  t.crown.dispose();
};

interface Placed {
  x: number;
  z: number;
  s: number;
  turn: number;
  tint: THREE.Color;
}

function InstancedTrees({ tree, placed, bark, leaves, crown }: { tree: TreeGeometry; placed: Placed[]; bark: THREE.Material; leaves: THREE.Material; crown: THREE.Material }) {
  const barkRef = useRef<THREE.InstancedMesh>(null);
  const leafRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);
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
      crownRef.current!.setMatrixAt(i, o.matrix);
      crownRef.current!.setColorAt(i, p.tint);
    });
    crownRef.current!.instanceMatrix.needsUpdate = true;
    if (crownRef.current!.instanceColor) crownRef.current!.instanceColor.needsUpdate = true;
    crownRef.current!.computeBoundingSphere();
    barkRef.current!.instanceMatrix.needsUpdate = true;
    leafRef.current!.instanceMatrix.needsUpdate = true;
    if (leafRef.current!.instanceColor) leafRef.current!.instanceColor.needsUpdate = true;
    // Instances spread far beyond the source tree's bounds
    barkRef.current!.computeBoundingSphere();
    leafRef.current!.computeBoundingSphere();
  }, [placed]);
  return (
    <>
      {/* The woods span the valley: kept out of the lanterns' shadows (see shadows.tsx) */}
      <instancedMesh ref={barkRef} args={[tree.bark, bark, placed.length]} userData={{ lampShadowFree: true }} {...shadowOf(bark)} />
      <instancedMesh ref={crownRef} args={[tree.crown, crown, placed.length]} userData={{ lampShadowFree: true }} {...shadowOf(crown)} />
      <instancedMesh ref={leafRef} args={[tree.leaves, leaves, placed.length]} userData={{ lampShadowFree: true }} {...shadowOf(leaves)} />
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
    const broad = BROADLEAF_VARIANTS.map((v) => broadleafTree({ ...v, cardSize: 1.5, fringe: 6, innerBlobs: 2, crownDetail: 1 }));
    const coni = CONIFER_VARIANTS.map((v) => coniferTree(v));
    const lists: Placed[][] = [...broad, ...coni].map(() => []);
    let placedCount = 0;
    while (placedCount < 120) {
      const x = -70 + rand() * 130;
      const z = 30 - rand() * 170;
      // Keep clear of the corridor, the home clearing and the museum
      if (Math.abs(x - CORRIDOR_X) < 9 && z < 0 && z > -95) continue;
      if (Math.hypot(x - 2, z + 6) < 14) continue;
      // ...and the castle and its garden
      const h = worldToHouse(x, z);
      if (Math.abs(h.x) < 12 && h.z > -11 && h.z < 14) continue;
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
        <InstancedTrees key={`b${i}`} tree={tree} placed={placements[i]!} bark={kit.woodsBark} leaves={kit.woodsLeaves} crown={kit.woodsCrown} />
      ))}
      {conifers.map((tree, i) => (
        <InstancedTrees key={`c${i}`} tree={tree} placed={placements[broadleaves.length + i]!} bark={kit.woodsBark} leaves={kit.woodsNeedles} crown={kit.pineCrown} />
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
      // Each tuft leans its own way and is its own height, so the meadow isn't a grid of clones
      o.rotation.set((rand() - 0.5) * 0.16, rand() * Math.PI * 2, (rand() - 0.5) * 0.16);
      const s = scale[0] + rand() * (scale[1] - scale[0]);
      o.scale.set(s * (0.8 + rand() * 0.4), s * (0.7 + rand() * 0.6), s * (0.8 + rand() * 0.4));
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
      ref.current!.setColorAt(i, col.setHSL(0.22 + rand() * 0.07, 0.26, 0.38 + rand() * 0.18));
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

// The castle's footprint, and the path from its gate through the garden (in its frame)
const inHouse = (x: number, z: number) => {
  const p = worldToHouse(x, z);
  return Math.abs(p.x) < 7 && p.z > -6.4 && p.z < 5.2;
};
const onPath = (x: number, z: number) => {
  const p = worldToHouse(x, z);
  return Math.abs(p.x) < 1.1 && p.z > 4.5 && p.z < 11.2;
};
const nearTrunk = (x: number, z: number) => Math.hypot(x - PERCH_TRUNK.x, z - PERCH_TRUNK.z) < 0.7;
const inMuseum = (x: number, z: number) => Math.hypot(x - MUSEUM_CENTER.x, z - MUSEUM_CENTER.z) < MUSEUM_RADIUS + 3.8;

const GRASS_AREAS: { area: [number, number, number, number]; count: number; accept: (x: number, z: number) => boolean }[] = [
  // Home clearing
  { area: [-12, 14, -22, 10], count: 650, accept: (x, z) => !inHouse(x, z) && !onPath(x, z) && !nearTrunk(x, z) },
  // Along the flight corridor
  { area: [CORRIDOR_X - 14, CORRIDOR_X + 14, -78, -10], count: 420, accept: () => true },
  // Round the museum
  { area: [MUSEUM_CENTER.x - 22, MUSEUM_CENTER.x + 22, MUSEUM_CENTER.z - 22, MUSEUM_CENTER.z + 18], count: 260, accept: (x, z) => !inMuseum(x, z) },
];

const BUSH_SPOTS: [number, number, number][] = [
  // [x, z, scale] — along the house front, by the fence, at the tree's foot
  [-1.2, -7.6, 1.1],
  [0.2, -7.9, 0.8],
  [3.6, -7.4, 1.2],
  [9.2, -8.2, 1.0],
  [-2.3, -3.7, 0.9],
  [-0.8, -3.2, 1.2],
  [5.6, -2.7, 1.0],
  [7.6, -2.0, 1.3],
  [-2.4, -0.2, 0.8],
  [-0.6, -1.9, 0.6],
  [9.5, -6, 1.4],
  [-6, -6.5, 1.5],
];

function Bushes({ kit }: { kit: Kit }) {
  const bush = useMemo(() => bushGeometry(13, 0.75), []);
  useEffect(
    () => () => {
      bush.crown.dispose();
      bush.leaves.dispose();
    },
    [bush],
  );
  const crownRef = useRef<THREE.InstancedMesh>(null);
  const leafRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    BUSH_SPOTS.forEach(([x, z, s], i) => {
      o.position.set(x, 0, z);
      o.rotation.set(0, i * 2.3, 0);
      o.scale.set(s, s * 0.85, s);
      o.updateMatrix();
      crownRef.current!.setMatrixAt(i, o.matrix);
      leafRef.current!.setMatrixAt(i, o.matrix);
    });
    for (const m of [crownRef.current!, leafRef.current!]) {
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, []);
  return (
    <>
      <instancedMesh ref={crownRef} args={[bush.crown, kit.bushCrown, BUSH_SPOTS.length]} {...shadowOf(kit.bushCrown)} />
      <instancedMesh ref={leafRef} args={[bush.leaves, kit.bush, BUSH_SPOTS.length]} {...shadowOf(kit.bush)} />
    </>
  );
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
