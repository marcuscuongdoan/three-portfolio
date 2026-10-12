"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import type { PlantDefinition } from "@/config/gasTurbine";
import type { PlantSim } from "@/components/plant-showroom/plantSim";

// Opacity of the other parts while one is open
const DIMMED_OPACITY = 0.12;

export interface PlantPartRuntime {
  id: string;
  meshes: THREE.Mesh[];
  // Bounds in model space (before the ground lift)
  box: THREE.Box3;
}

export interface PlantRuntime {
  parts: Map<string, PlantPartRuntime>;
  // Lift that puts the bottom of the pad on y = 0
  groundOffset: number;
  // Clips every material: the intro's scan reveals the real unit behind it
  introPlane: THREE.Plane;
  root: THREE.Object3D;
  // The whole unit, model space
  box: THREE.Box3;
}

interface MaterialState {
  material: THREE.Material;
  opacity: number;
  transparent: boolean;
}

// Scene mutation lives outside the component: the React Compiler forbids
// mutating values returned from hooks
const setOpacity = (states: MaterialState[], fade: number, modeChanged: boolean) =>
  states.forEach((s) => {
    s.material.opacity = s.opacity * fade;
    if (modeChanged) {
      s.material.transparent = fade < 0.999 ? true : s.transparent;
      // Faded parts mustn't hide the open one behind them
      s.material.depthWrite = fade >= 0.999;
      s.material.needsUpdate = true;
    }
  });

/**
 * The source materials are steel textures at full metalness, which only
 * mirror the night around them and read as black. Plant steel is painted:
 * keep the textures' grain, drop most of the metal, and give each paint its
 * shade (light enclosures, darker gratings and rails)
 */
const PAINT: Record<string, { color: string; metalness: number; roughness: number }> = {
  metal_white: { color: "#d9dde2", metalness: 0.25, roughness: 0.55 },
  paint_gray: { color: "#b4bac2", metalness: 0.2, roughness: 0.6 },
  paint_dark_gray: { color: "#6d747d", metalness: 0.2, roughness: 0.7 },
};
const paint = (material: THREE.Material) => {
  const m = material as THREE.MeshStandardMaterial;
  const finish = PAINT[m.name];
  if (!finish || !m.isMeshStandardMaterial) return;
  m.color.set(finish.color);
  m.metalnessMap = null;
  m.metalness = finish.metalness;
  m.roughness = finish.roughness;
};

const shake = (meshes: THREE.Mesh[], amount: number, t: number) =>
  meshes.forEach((m, i) => {
    m.position.set(
      Math.sin(t * 91 + i) * amount,
      Math.sin(t * 77 + i * 1.7) * amount * 0.6,
      Math.sin(t * 83 + i * 2.3) * amount,
    );
  });

/**
 * Builds the interactive unit from a clone of the GLB: meshes grouped into
 * parts by node name, own material copies per part (they fade one by one),
 * every material clipped by the intro plane. The pad belongs to no part.
 */
const buildPlant = (source: THREE.Object3D, def: PlantDefinition) => {
  const root = source.clone(true);
  root.updateMatrixWorld(true);
  const introPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), -100);
  const parts = new Map<string, PlantPartRuntime>();
  const materials = new Map<string, MaterialState[]>();
  const box = new THREE.Box3();

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const meshBox = new THREE.Box3().setFromObject(mesh);
    box.union(meshBox);

    const part = def.parts.find((p) => p.nodes.some((n) => mesh.name.startsWith(n)));
    const id = part?.id ?? "pad";
    mesh.userData.partId = part?.id;

    let states = materials.get(id);
    if (!states) {
      states = [];
      materials.set(id, states);
    }
    const own = (material: THREE.Material) => {
      const copy = material.clone();
      paint(copy);
      copy.clippingPlanes = [introPlane];
      copy.clipShadows = true;
      states!.push({ material: copy, opacity: copy.opacity, transparent: copy.transparent });
      return copy;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(own) : own(mesh.material);

    if (!part) return;
    let runtime = parts.get(part.id);
    if (!runtime) {
      runtime = { id: part.id, meshes: [], box: new THREE.Box3() };
      parts.set(part.id, runtime);
    }
    runtime.meshes.push(mesh);
    runtime.box.union(meshBox);
  });

  const plant: PlantRuntime = { parts, groundOffset: -box.min.y, introPlane, root, box };
  return { root, materials, plant };
};

interface PlantModelProps {
  def: PlantDefinition;
  sim: PlantSim;
  selected: string | null;
  onReady: (plant: PlantRuntime) => void;
  onHoverPart: (id: string | null) => void;
  onClickPart: (id: string) => void;
  onClickEmpty: () => void;
}

export default function PlantModel({
  def,
  sim,
  selected,
  onReady,
  onHoverPart,
  onClickPart,
  onClickEmpty,
}: PlantModelProps) {
  const { scene } = useGLTF(def.model);
  const { root, materials, plant } = useMemo(() => buildPlant(scene, def), [scene, def]);

  useEffect(() => onReady(plant), [plant, onReady]);

  const fades = useRef(new Map<string, number>());
  const shaking = useRef(false);

  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);

    // The running turbine hums: a sub-millimetre buzz on the package, with
    // the shaft speed
    const turbine = plant.parts.get("turbine");
    const amount = sim.state.flame ? 0.0012 * sim.state.speed : sim.state.speed * 0.0006;
    if (turbine && (amount > 0 || shaking.current)) {
      shake(turbine.meshes, amount, clock.elapsedTime);
      shaking.current = amount > 0;
    }

    materials.forEach((states, id) => {
      const goal = selected && selected !== id ? DIMMED_OPACITY : 1;
      const prev = fades.current.get(id) ?? 1;
      if (prev === goal) return;
      const next = THREE.MathUtils.damp(prev, goal, 6, delta);
      const fade = Math.abs(next - goal) < 0.002 ? goal : next;
      fades.current.set(id, fade);
      setOpacity(states, fade, prev >= 0.999 !== fade >= 0.999);
    });
  });

  const partOf = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
    (e.object.userData.partId as string | undefined) ?? null;

  return (
    <group position-y={plant.groundOffset}>
      <primitive
        object={root}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onHoverPart(partOf(e));
        }}
        onPointerOut={() => onHoverPart(null)}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          const id = partOf(e);
          // The pad counts as empty space (the canvas' pointer-missed never
          // fires once a mesh with handlers is hit)
          if (id) onClickPart(id);
          else onClickEmpty();
        }}
      />
    </group>
  );
}
