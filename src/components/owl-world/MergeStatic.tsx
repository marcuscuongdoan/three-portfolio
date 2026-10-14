"use client";

import { ReactNode, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Draws a static subtree in as few calls as it can: once mounted, every plain
 * mesh inside is baked into one mesh per look-alike material, and the
 * originals are hidden (each draw call is paid again in every shadow map).
 * Only for things that never move, change or take pointer events.
 */

const ATTRIBUTES = ["position", "normal", "uv"] as const;

function signature(m: THREE.Material) {
  const s = m as THREE.MeshStandardMaterial & THREE.MeshBasicMaterial;
  return [
    m.type,
    s.color?.getHexString(),
    s.emissive?.getHexString(),
    s.emissiveIntensity,
    s.roughness,
    s.metalness,
    s.map?.uuid,
    s.toneMapped,
    m.side,
    m.transparent,
    m.opacity,
  ].join("|");
}

/** A copy in `space`, non-indexed, with only the attributes every part shares */
function prepare(mesh: THREE.Mesh, space: THREE.Matrix4) {
  const src = mesh.geometry;
  const g = src.index ? src.toNonIndexed() : src.clone();
  for (const name of Object.keys(g.attributes)) {
    if (!(ATTRIBUTES as readonly string[]).includes(name)) g.deleteAttribute(name);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position!.count * 2), 2));
  g.clearGroups();
  g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(space, mesh.matrixWorld));
  return g;
}

export default function MergeStatic({ children }: { children: ReactNode }) {
  const root = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    const group = root.current!;
    group.updateWorldMatrix(true, true);
    const space = group.matrixWorld.clone().invert();
    const buckets = new Map<string, { material: THREE.Material; parts: THREE.BufferGeometry[] }>();
    const sources: THREE.Mesh[] = [];
    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.visible || mesh.userData.merged || Array.isArray(mesh.material)) return;
      if ((mesh as THREE.InstancedMesh).isInstancedMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh) return;
      const key = signature(mesh.material);
      let bucket = buckets.get(key);
      if (!bucket) buckets.set(key, (bucket = { material: mesh.material, parts: [] }));
      bucket.parts.push(prepare(mesh, space));
      sources.push(mesh);
    });

    const made: THREE.Mesh[] = [];
    for (const { material, parts } of buckets.values()) {
      const geometry = mergeGeometries(parts);
      parts.forEach((p) => p.dispose());
      if (!geometry) continue;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.merged = true;
      made.push(mesh);
    }
    // Only swap if every bucket merged; otherwise leave the originals be
    if (made.length !== buckets.size) {
      made.forEach((m) => m.geometry.dispose());
      return;
    }
    made.forEach((m) => group.add(m));
    sources.forEach((m) => (m.visible = false));
    return () => {
      made.forEach((m) => {
        group.remove(m);
        m.geometry.dispose();
      });
      sources.forEach((m) => (m.visible = true));
    };
  }, []);

  return <group ref={root}>{children}</group>;
}
