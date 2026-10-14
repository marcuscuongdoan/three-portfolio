"use client";

import { ComponentProps, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { MOON_DIR } from "@/components/owl-world/SkyDome";
import { flight, guide } from "@/components/owl-world/owlStore";
import { LAST_STOP } from "@/components/owl-world/flightPath";
import { useQuality } from "@/components/owl-world/quality";

/**
 * Shadows. The moon (key light) casts for everything, through one shadow map
 * whose box follows the guide owl, so it stays sharp across a 90 m valley.
 * A couple of lanterns at home cast too, refreshed every other frame and only
 * while the tour is at home. Meshes opt in automatically; a subtree marked
 * with userData.noShadow (lamps, glows, sky) is left out.
 *
 * No light refreshes its shadow by itself: ShadowSetup decides each frame
 * which do. Off high quality, the moon refreshes every other frame, and the
 * lanterns' six-sided renders leave out the instanced trees and bushes
 * (userData.lampShadowFree): they cover the whole valley, so they're never
 * culled and would be drawn in full six times over. On those frames the moon
 * waits, so the trees still shadow in moonlight.
 */

let moon: THREE.DirectionalLight | null = null;
const lamps = new Set<THREE.PointLight>();

// Half-size of the moon's shadow box (m) and its shadow map resolution
const MOON_BOX = 24;
const MOON_MAP = 2048;
const MOON_TEXEL = (MOON_BOX * 2) / MOON_MAP;

export function ShadowMoon({ intensity, color, direction = MOON_DIR }: { intensity: number; color: string; direction?: THREE.Vector3 }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const l = light.current;
    if (!l) return;
    scene.add(l.target);
    l.shadow.autoUpdate = false;
    moon = l;
    const cam = l.shadow.camera;
    cam.left = cam.bottom = -MOON_BOX;
    cam.right = cam.top = MOON_BOX;
    cam.near = 1;
    cam.far = 160;
    cam.updateProjectionMatrix();
    return () => {
      scene.remove(l.target);
      moon = null;
    };
  }, [scene]);

  // The light's own axes, for snapping its box to whole shadow-map texels
  const axes = useMemo(() => {
    const back = direction.clone().normalize();
    const right = new THREE.Vector3(0, 1, 0).cross(back).normalize();
    const up = back.clone().cross(right).normalize();
    return { right, up, back };
  }, [direction]);

  useFrame(() => {
    const l = light.current;
    if (!l) return;
    // Centre the box on the guide, moved only in whole texels across the
    // light: a box sliding by fractions of a texel re-samples every shadow
    // edge each frame, and they shimmer
    const { right, up, back } = axes;
    const x = Math.round(guide.pos.dot(right) / MOON_TEXEL) * MOON_TEXEL;
    const y = Math.round(guide.pos.dot(up) / MOON_TEXEL) * MOON_TEXEL;
    l.target.position.copy(right).multiplyScalar(x).addScaledVector(up, y).addScaledVector(back, guide.pos.dot(back));
    l.position.copy(l.target.position).addScaledVector(direction, 70);
  });

  return (
    <directionalLight
      ref={light}
      color={color}
      intensity={intensity}
      castShadow
      shadow-mapSize={[MOON_MAP, MOON_MAP]}
      shadow-bias={-0.0006}
      shadow-normalBias={0.04}
      shadow-radius={3}
    />
  );
}

/** A point light whose shadows only refresh near home, every third frame */
export function HomeShadowLight({ far, ...props }: ComponentProps<"pointLight"> & { far: number }) {
  const light = useRef<THREE.PointLight>(null);
  useEffect(() => {
    const l = light.current;
    if (!l) return;
    l.shadow.autoUpdate = false;
    l.shadow.needsUpdate = true;
    l.shadow.camera.near = 0.08;
    l.shadow.camera.far = far;
    lamps.add(l);
    return () => void lamps.delete(l);
  }, [far]);
  return <pointLight ref={light} castShadow shadow-mapSize={[512, 512]} shadow-bias={-0.004} shadow-radius={4} {...props} />;
}

/**
 * Marks every mesh as a caster and receiver, keeping out noShadow subtrees,
 * and schedules the shadow refreshes
 */
export function ShadowSetup() {
  const scene = useThree((s) => s.scene);
  const quality = useQuality();
  const vegetation = useRef(new Set<THREE.Object3D>());
  const frame = useRef(0);
  useEffect(() => {
    const trees = vegetation.current;
    const apply = () => {
      const visit = (o: THREE.Object3D) => {
        if (o.userData.noShadow) return;
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && !mesh.userData.shadowSet) {
          mesh.userData.shadowSet = true;
          mesh.receiveShadow = true;
          mesh.castShadow = !mesh.userData.receiveOnly;
          if (mesh.castShadow && mesh.userData.lampShadowFree) trees.add(mesh);
        }
        o.children.forEach(visit);
      };
      visit(scene);
    };
    apply();
    // Late arrivals: the owls (Suspense) and anything mounted afterwards
    const id = window.setInterval(apply, 1000);
    return () => {
      window.clearInterval(id);
      trees.clear();
    };
  }, [scene]);

  useFrame(() => {
    const n = frame.current++;
    // Home, including the whole loop round the perch tree (stop 0 → 1): a lamp's
    // shadow left frozen while its light and the leaves move flickers badly
    const nearHome = flight.current < 1.6 || flight.current > LAST_STOP - 0.9;
    const lampFrame = nearHome && n % 3 === 0;
    if (lampFrame) lamps.forEach((l) => (l.shadow.needsUpdate = true));
    const treesCast = quality.vegetationInLampShadows || !lampFrame;
    vegetation.current.forEach((o) => (o.castShadow = treesCast));
    if (moon) moon.shadow.needsUpdate = quality.moonShadowEvery <= 1 || (treesCast && n % quality.moonShadowEvery === 0);
  });
  return null;
}
