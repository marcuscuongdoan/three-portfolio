"use client";

import { ComponentProps, useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { MOON_DIR } from "@/components/owl-world/SkyDome";
import { flight, guide } from "@/components/owl-world/owlStore";
import { LAST_STOP } from "@/components/owl-world/flightPath";

/**
 * Shadows. The moon (key light) casts for everything, through one shadow map
 * whose box follows the guide owl, so it stays sharp across a 90 m valley.
 * A couple of lanterns at home cast too, refreshed every other frame and only
 * while the tour is at home. Meshes opt in automatically; a subtree marked
 * with userData.noShadow (lamps, glows, sky) is left out.
 */

// Half-size of the moon's shadow box (m) and its shadow map resolution
const MOON_BOX = 24;
const MOON_MAP = 2048;

export function ShadowMoon({ intensity, color, direction = MOON_DIR }: { intensity: number; color: string; direction?: THREE.Vector3 }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const l = light.current;
    if (!l) return;
    scene.add(l.target);
    const cam = l.shadow.camera;
    cam.left = cam.bottom = -MOON_BOX;
    cam.right = cam.top = MOON_BOX;
    cam.near = 1;
    cam.far = 160;
    cam.updateProjectionMatrix();
    return () => void scene.remove(l.target);
  }, [scene]);

  useFrame(() => {
    const l = light.current;
    if (!l) return;
    // Centre the box a little ahead of the guide, where the camera looks
    l.target.position.copy(guide.pos);
    l.position.copy(guide.pos).addScaledVector(direction, 70);
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
  const frame = useRef(0);
  useEffect(() => {
    const l = light.current;
    if (!l) return;
    l.shadow.autoUpdate = false;
    l.shadow.needsUpdate = true;
    l.shadow.camera.near = 0.08;
    l.shadow.camera.far = far;
  }, [far]);
  useFrame(() => {
    const l = light.current;
    if (!l) return;
    const nearHome = flight.current < 0.7 || flight.current > LAST_STOP - 0.7;
    if (nearHome && frame.current++ % 3 === 0) l.shadow.needsUpdate = true;
  });
  return <pointLight ref={light} castShadow shadow-mapSize={[512, 512]} shadow-bias={-0.004} shadow-radius={4} {...props} />;
}

/** Marks every mesh as a caster and receiver, keeping out noShadow subtrees */
export function ShadowSetup() {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const apply = () => {
      const visit = (o: THREE.Object3D) => {
        if (o.userData.noShadow) return;
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && !mesh.userData.shadowSet) {
          mesh.userData.shadowSet = true;
          mesh.receiveShadow = true;
          mesh.castShadow = !mesh.userData.receiveOnly;
        }
        o.children.forEach(visit);
      };
      visit(scene);
    };
    apply();
    // Late arrivals: the owls (Suspense) and anything mounted afterwards
    const id = window.setInterval(apply, 1000);
    return () => window.clearInterval(id);
  }, [scene]);
  return null;
}
