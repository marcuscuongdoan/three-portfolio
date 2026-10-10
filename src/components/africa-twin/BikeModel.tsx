"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  AFRICA_TWIN_MODEL,
  BIKE_PARTS,
  HIDDEN_NODES,
  matchesNode,
  PartId,
} from "@/config/africaTwin";

// Opacity of the other parts while one is selected
const DIMMED_OPACITY = 0.14;

export interface PartRuntime {
  id: PartId;
  meshes: THREE.Mesh[];
  // Rest-pose bounds in bike space (before the ground lift)
  center: THREE.Vector3;
  radius: number;
  // Average explode offset, for framing the part when exploded
  explode: THREE.Vector3;
}

export interface BikeRuntime {
  parts: Map<PartId, PartRuntime>;
  // Lift that puts the tyres on y = 0
  groundOffset: number;
}

interface NodeState {
  object: THREE.Object3D;
  base: THREE.Vector3;
  explode: THREE.Vector3;
}

interface MaterialState {
  material: THREE.Material;
  opacity: number;
  transparent: boolean;
}

// Scene mutation lives outside the component: the React Compiler forbids
// mutating values returned from hooks
const setPartOpacity = (states: MaterialState[], fade: number, modeChanged: boolean) => {
  states.forEach((s) => {
    s.material.opacity = s.opacity * fade;
    if (modeChanged) {
      s.material.transparent = fade < 0.999 ? true : s.transparent;
      s.material.needsUpdate = true;
    }
  });
};

const placeNodes = (nodes: NodeState[], progress: number) =>
  nodes.forEach((n) => n.object.position.copy(n.base).addScaledVector(n.explode, progress));

/**
 * Builds the interactive bike from a fresh clone of the GLB: groups meshes into
 * parts by node name, gives every part its own material copies (materials are
 * shared across parts in the source file, and parts fade individually), and
 * records the rest position + explode offset of every node.
 */
const buildBike = (source: THREE.Object3D) => {
  const root = source.clone(true);
  root.updateMatrixWorld(true);

  const nodes: NodeState[] = [];
  const materialsByPart = new Map<PartId, MaterialState[]>();
  const parts = new Map<PartId, PartRuntime>();
  const restBox = new THREE.Box3();
  const unmatched: string[] = [];

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (matchesNode(HIDDEN_NODES, child.name)) {
      child.visible = false;
      return;
    }
    if (!mesh.isMesh) return;

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const box = new THREE.Box3().setFromObject(mesh);
    restBox.union(box);

    const part = BIKE_PARTS.find((p) => matchesNode(p.nodes, mesh.name));
    if (!part) {
      unmatched.push(mesh.name);
      return;
    }
    mesh.userData.partId = part.id;

    const override = part.explodeOverrides?.find((o) => matchesNode(o.nodes, mesh.name));
    const explode = new THREE.Vector3(...(override?.explode ?? part.explode));
    nodes.push({ object: mesh, base: mesh.position.clone(), explode });

    // Own material copies per part
    let states = materialsByPart.get(part.id);
    if (!states) {
      states = [];
      materialsByPart.set(part.id, states);
    }
    const copies = new Map<THREE.Material, THREE.Material>();
    const own = (material: THREE.Material) => {
      let copy = copies.get(material);
      if (!copy) {
        copy = material.clone();
        copies.set(material, copy);
        states!.push({ material: copy, opacity: copy.opacity, transparent: copy.transparent });
      }
      return copy;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(own) : own(mesh.material);

    let runtime = parts.get(part.id);
    if (!runtime) {
      runtime = {
        id: part.id,
        meshes: [],
        center: new THREE.Vector3(),
        radius: 0,
        explode: new THREE.Vector3(),
      };
      parts.set(part.id, runtime);
    }
    runtime.meshes.push(mesh);
    runtime.explode.add(explode);
  });

  if (unmatched.length) console.warn("Africa Twin: meshes without a part", unmatched);

  parts.forEach((runtime) => {
    const box = new THREE.Box3();
    runtime.meshes.forEach((m) => box.union(new THREE.Box3().setFromObject(m)));
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    runtime.center.copy(sphere.center);
    runtime.radius = sphere.radius;
    runtime.explode.divideScalar(runtime.meshes.length);
  });

  const bike: BikeRuntime = { parts, groundOffset: -restBox.min.y };
  return { root, nodes, materialsByPart, bike };
};

interface BikeModelProps {
  exploded: boolean;
  selected: PartId | null;
  onReady: (bike: BikeRuntime) => void;
  onHoverPart: (id: PartId | null) => void;
  // Clicked a part: the page decides whether that explodes or selects
  onClickPart: (id: PartId) => void;
}

export default function BikeModel({
  exploded,
  selected,
  onReady,
  onHoverPart,
  onClickPart,
}: BikeModelProps) {
  const { scene } = useGLTF(AFRICA_TWIN_MODEL);
  const { root, nodes, materialsByPart, bike } = useMemo(() => buildBike(scene), [scene]);

  useEffect(() => onReady(bike), [bike, onReady]);

  // Explode / assemble
  const progress = useRef(0);
  // Per-part opacity while another part is selected
  const fades = useRef(new Map<PartId, number>());

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const target = exploded ? 1 : 0;
    if (progress.current !== target) {
      const next = THREE.MathUtils.damp(progress.current, target, 4.5, delta);
      progress.current = Math.abs(next - target) < 0.001 ? target : next;
      placeNodes(nodes, progress.current);
    }

    materialsByPart.forEach((states, id) => {
      const goal = selected && selected !== id ? DIMMED_OPACITY : 1;
      const prev = fades.current.get(id) ?? 1;
      if (prev === goal) return;
      const next = THREE.MathUtils.damp(prev, goal, 6, delta);
      const fade = Math.abs(next - goal) < 0.002 ? goal : next;
      fades.current.set(id, fade);
      setPartOpacity(states, fade, prev >= 0.999 !== fade >= 0.999);
    });
  });

  const partOf = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
    (e.object.userData.partId as PartId | undefined) ?? null;

  return (
    <group position-y={bike.groundOffset}>
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
          if (id) onClickPart(id);
        }}
      />
    </group>
  );
}

useGLTF.preload(AFRICA_TWIN_MODEL);
