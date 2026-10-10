"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

/**
 * Covers a backdrop swap (garage ↔ ride world, or the backdrop toggle): a
 * glowing ring races out across the floor from the bike with a soft wall of
 * light standing on it, like a scan wave sweeping the old scene away while
 * the next one rises behind it. Replays whenever `trigger` changes (not on
 * mount). Built-in materials only — no custom shader.
 */

const DURATION = 1.25; // seconds
const FROM = 1.9; // starts at the floor ring around the bike
const TO = 15; // past the garage walls (11 m)
const WALL = 2.6; // wall height

// Vertical alpha for the wall: solid at the floor, gone at the top
const makeWallAlpha = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "#000000");
  g.addColorStop(0.75, "#3a3a3a");
  g.addColorStop(1, "#ffffff");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(canvas);
};

const setOpacity = (material: THREE.Material, opacity: number) => {
  material.opacity = opacity;
};

export default function BackdropSweep({ trigger }: { trigger: string }) {
  const ringMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        // HDR: the ring blooms where bloom is on
        color: new THREE.Color(0.9, 2.4, 2.8),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  const wallMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color("#5fdcff"),
        alphaMap: makeWallAlpha(),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );
  const wallGeometry = useMemo(() => {
    const g = new THREE.CylinderGeometry(1, 1, WALL, 96, 1, true);
    g.translate(0, WALL / 2, 0);
    return g;
  }, []);

  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const wall = useRef<THREE.Mesh>(null);
  // Seconds since the sweep started; Infinity = idle
  const age = useRef(Infinity);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    age.current = 0;
  }, [trigger]);

  useFrame((_, rawDelta) => {
    if (!group.current || !ring.current || !wall.current) return;
    if (age.current > DURATION) {
      group.current.visible = false;
      return;
    }
    age.current += Math.min(rawDelta, 1 / 30);
    const t = Math.min(age.current / DURATION, 1);
    group.current.visible = true;
    const eased = 1 - Math.pow(1 - t, 3);
    const radius = THREE.MathUtils.lerp(FROM, TO, eased);
    ring.current.scale.setScalar(radius);
    wall.current.scale.set(radius, 1 - t * 0.5, radius);
    // Quick flash in, long fade out
    const fade = THREE.MathUtils.smoothstep(t, 0, 0.08) * Math.pow(1 - t, 1.4);
    setOpacity(ringMaterial, fade);
    setOpacity(wallMaterial, fade * 0.55);
  });

  return (
    <group ref={group} visible={false}>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.002} material={ringMaterial} raycast={() => null}>
        <ringGeometry args={[0.975, 1, 128]} />
      </mesh>
      <mesh ref={wall} geometry={wallGeometry} material={wallMaterial} raycast={() => null} />
    </group>
  );
}
