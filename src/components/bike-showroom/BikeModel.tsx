"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  type BikeDefinition,
  type ExplodeSettings,
  matchesNode,
  overviewDistance,
} from "@/config/bikeShowroom";
import { useBikeDef } from "@/components/bike-showroom/BikeContext";

type PartId = string;

// Opacity of the other parts while one is selected
const DIMMED_OPACITY = 0.14;

export interface PartRuntime {
  id: PartId;
  meshes: THREE.Mesh[];
  // Rest-pose bounds in bike space (before the ground lift)
  center: THREE.Vector3;
  radius: number;
  // Average explode offset
  explode: THREE.Vector3;
  // Bounds (bike space, before the ground lift) of the part as it sits while
  // open: every mesh at its own focus offset. Front/rear pairs (brakes,
  // lights) give a long box spanning both — the camera frames all of it
  focusBox: THREE.Box3;
}

export interface BikeRuntime {
  parts: Map<PartId, PartRuntime>;
  // Lift that puts the tyres on y = 0
  groundOffset: number;
  // Clips every bike material: the intro's scan reveals the real bike in
  // front of it (z below the plane's constant). Starts hiding everything
  introPlane: THREE.Plane;
  // The bike's root object (meshes' parent chain), for sampling its surface
  root: THREE.Object3D;
}

interface NodeState {
  object: THREE.Object3D;
  partId: PartId;
  base: THREE.Vector3;
  explode: THREE.Vector3;
}

interface MaterialState {
  material: THREE.Material;
  opacity: number;
  transparent: boolean;
}

interface GlowState {
  material: THREE.MeshStandardMaterial;
  intensity: number;
}

// Wheels and brake discs spin about their own local X axis
const spin = (spinners: THREE.Object3D[], angle: number) =>
  spinners.forEach((o) => {
    o.rotation.x = angle;
  });

const setGlow = (glows: GlowState[], level: number) =>
  glows.forEach((g) => {
    g.material.emissiveIntensity = g.intensity * level;
  });

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

const placeNodes = (nodes: NodeState[], scale: number, spread: number, boosts: Map<PartId, number>) =>
  nodes.forEach((n) =>
    n.object.position.copy(n.base).addScaledVector(n.explode, scale * spread * (boosts.get(n.partId) ?? 1)),
  );

/**
 * How far the parts spread, given the camera's distance to its target: zooming
 * in from the overview spreads them, from nothing at zoomStart to fully
 * exploded at zoomFull — then on up to 1 + zoomExtra
 */
export const zoomSpread = (distance: number, overview: number, explode: ExplodeSettings) =>
  THREE.MathUtils.smoothstep(-distance, -overview * explode.zoomStart, -overview * explode.zoomFull);

/**
 * Builds the interactive bike from a fresh clone of the GLB: groups meshes into
 * parts by node name, gives every part its own material copies (materials are
 * shared across parts in the source file, and parts fade individually), and
 * records the rest position + explode offset of every node.
 */
const buildBike = (source: THREE.Object3D, def: BikeDefinition) => {
  const { explode: EXPLODE, lights: BIKE_LIGHTS, ride: RIDE, parts: BIKE_PARTS } = def;
  const root = source.clone(true);
  root.updateMatrixWorld(true);

  const introPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), -100);
  const nodes: NodeState[] = [];
  const glows: GlowState[] = [];
  const spinners: THREE.Object3D[] = [];
  const materialsByPart = new Map<PartId, MaterialState[]>();
  const parts = new Map<PartId, PartRuntime>();
  const restBox = new THREE.Box3();
  const unmatched: string[] = [];

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (matchesNode(def.hiddenNodes, child.name)) {
      child.visible = false;
      return;
    }
    if (!mesh.isMesh) return;

    // Glass and other see-through parts shouldn't throw a solid shadow
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mesh.castShadow = !mats.every((mat) => mat.transparent && mat.opacity < 0.5);
    mesh.receiveShadow = true;
    const box = new THREE.Box3().setFromObject(mesh);
    restBox.union(box);

    const part = BIKE_PARTS.find((p) => matchesNode(p.nodes, mesh.name));
    if (!part) {
      unmatched.push(mesh.name);
      return;
    }
    mesh.userData.partId = part.id;

    // Spinning parts. Wheel nodes already sit on the axle; disc vertices are
    // baked in bike space, so re-centre their geometry on the disc (a copy —
    // geometry is shared with the cached GLB) to spin them in place
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (matchesNode(RIDE.wheelNodes, mesh.name)) spinners.push(mesh);
    else if (
      matchesNode(RIDE.discNodes, mesh.name) &&
      (!RIDE.discMaterial || RIDE.discMaterial.test(material?.name ?? ""))
    ) {
      const geometry = mesh.geometry.clone();
      geometry.computeBoundingBox();
      const center = geometry.boundingBox!.getCenter(new THREE.Vector3());
      geometry.translate(-center.x, -center.y, -center.z);
      mesh.geometry = geometry;
      mesh.position.add(center);
      spinners.push(mesh);
    }

    const override = part.explodeOverrides?.find((o) => matchesNode(o.nodes, mesh.name));
    const explode = new THREE.Vector3(...(override?.explode ?? part.explode));
    nodes.push({ object: mesh, partId: part.id, base: mesh.position.clone(), explode });

    // Own material copies per part
    let states = materialsByPart.get(part.id);
    if (!states) {
      states = [];
      materialsByPart.set(part.id, states);
    }
    // Lamps get copies of their own: the taillight shares its lens material
    // with the indicators, which must not light up
    const glow = BIKE_LIGHTS.glow.find((g) => matchesNode(g.nodes, mesh.name));
    const copies = new Map<THREE.Material, THREE.Material>();
    const own = (material: THREE.Material) => {
      let copy = glow ? undefined : copies.get(material);
      if (!copy) {
        copy = material.clone();
        copy.clippingPlanes = [introPlane];
        copy.clipShadows = true;
        copies.set(material, copy);
        states!.push({ material: copy, opacity: copy.opacity, transparent: copy.transparent });
        const lamp = copy as THREE.MeshStandardMaterial;
        if (glow && lamp.isMeshStandardMaterial && BIKE_LIGHTS.lampMaterial.test(copy.name)) {
          lamp.emissive = new THREE.Color(glow.color);
          lamp.emissiveMap = lamp.map;
          lamp.emissiveIntensity = 0;
          glows.push({ material: lamp, intensity: glow.intensity });
        }
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
        focusBox: new THREE.Box3(),
      };
      parts.set(part.id, runtime);
    }
    runtime.meshes.push(mesh);
    runtime.explode.add(explode);
    const focusOffset = explode
      .clone()
      .multiplyScalar(EXPLODE.scale * EXPLODE.focusSpread * (part.focusBoost ?? EXPLODE.selectedBoost));
    runtime.focusBox.union(box.clone().translate(focusOffset));
  });

  if (unmatched.length) console.warn(`${def.title}: meshes without a part`, unmatched);

  parts.forEach((runtime) => {
    const box = new THREE.Box3();
    runtime.meshes.forEach((m) => box.union(new THREE.Box3().setFromObject(m)));
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    runtime.center.copy(sphere.center);
    runtime.radius = sphere.radius;
    runtime.explode.divideScalar(runtime.meshes.length);
  });

  const bike: BikeRuntime = { parts, groundOffset: -restBox.min.y, introPlane, root };
  return { root, nodes, glows, spinners, materialsByPart, bike };
};

interface BikeModelProps {
  exploded: boolean;
  // 0 = lights off, 1 = on (eased by the scene)
  lightsLevel: React.RefObject<number>;
  // 0..1 ride speed (eased by the scene)
  rideLevel: React.RefObject<number>;
  selected: PartId | null;
  // Zooming in has spread the parts far enough to count as exploded
  onZoomExplode: (zoomExploded: boolean) => void;
  onReady: (bike: BikeRuntime) => void;
  onHoverPart: (id: PartId | null) => void;
  // Clicked a part: the page decides whether that explodes or selects
  onClickPart: (id: PartId) => void;
}

export default function BikeModel({
  exploded,
  lightsLevel,
  rideLevel,
  selected,
  onZoomExplode,
  onReady,
  onHoverPart,
  onClickPart,
}: BikeModelProps) {
  const def = useBikeDef();
  const { explode: EXPLODE } = def;
  const overview = overviewDistance(def.camera);
  const { scene } = useGLTF(def.model);
  const { root, nodes, glows, spinners, materialsByPart, bike } = useMemo(
    () => buildBike(scene, def),
    [scene, def],
  );

  useEffect(() => onReady(bike), [bike, onReady]);

  // Spread of the parts (see EXPLODE) and the selected part's extra push
  const spread = useRef(0);
  const boosts = useRef(new Map<PartId, number>());
  // Per-part opacity while another part is selected
  const fades = useRef(new Map<PartId, number>());
  const zoomExploded = useRef(false);
  const glowLevel = useRef(0);
  const wheelAngle = useRef(0);
  const body = useRef<THREE.Group>(null);

  useFrame(({ controls, camera }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);

    // A part being open pins the spread, so the part stays where the camera
    // is aimed; otherwise the zoom level drives it
    const distance =
      (controls as unknown as { distance?: number } | null)?.distance ??
      camera.position.length();
    const zoom = zoomSpread(distance, overview, EXPLODE);
    const target = selected
      ? EXPLODE.focusSpread
      : Math.max(exploded ? 1 : 0, zoom) * (1 + EXPLODE.zoomExtra * zoom);

    const isZoomExploded = !selected && zoom > 0.35;
    if (isZoomExploded !== zoomExploded.current) {
      zoomExploded.current = isZoomExploded;
      onZoomExplode(isZoomExploded);
    }

    let moved = false;
    if (spread.current !== target) {
      const next = THREE.MathUtils.damp(spread.current, target, 4.5, delta);
      spread.current = Math.abs(next - target) < 0.001 ? target : next;
      moved = true;
    }
    materialsByPart.forEach((_, id) => {
      const goal =
        id === selected ? (def.parts.find((p) => p.id === id)?.focusBoost ?? EXPLODE.selectedBoost) : 1;
      const prev = boosts.current.get(id) ?? 1;
      if (prev === goal) return;
      const next = THREE.MathUtils.damp(prev, goal, 4.5, delta);
      boosts.current.set(id, Math.abs(next - goal) < 0.001 ? goal : next);
      moved = true;
    });
    if (moved) placeNodes(nodes, EXPLODE.scale, spread.current, boosts.current);

    // Ride: wheels roll forward (front is -Z, so the contact patch moves +Z)
    // and the body shimmies a little on the engine
    const ride = rideLevel.current;
    if (ride > 0) {
      wheelAngle.current = (wheelAngle.current - def.ride.spin * ride * delta) % (Math.PI * 2);
      spin(spinners, wheelAngle.current);
    }
    if (body.current) {
      const t = performance.now() / 1000;
      body.current.position.y = ride * (Math.sin(t * 38) * 0.0012 + Math.sin(t * 7.3) * 0.002);
      body.current.rotation.x = ride * Math.sin(t * 5.1) * 0.0025;
    }

    if (glowLevel.current !== lightsLevel.current) {
      glowLevel.current = lightsLevel.current;
      setGlow(glows, glowLevel.current);
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
      <group ref={body}>
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
    </group>
  );
}
