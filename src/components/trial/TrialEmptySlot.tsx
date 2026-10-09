"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html, Sparkles } from "@react-three/drei";
import { TRIAL_MODEL_HEIGHT } from "@/config/trial";

// An open spot at the campfire: a summoning circle and a hovering crystal,
// waiting for the next legend
export default function TrialEmptySlot({
  position,
  showLabel,
  dimmed,
}: {
  position: [number, number, number];
  showLabel: boolean;
  dimmed: boolean;
}) {
  const ring = useRef<THREE.Mesh>(null);
  const crystal = useRef<THREE.Mesh>(null);
  const group = useRef<THREE.Group>(null);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    if (ring.current) ring.current.rotation.z = t * 0.4;
    if (crystal.current) {
      crystal.current.rotation.y = t * 0.8;
      crystal.current.position.y = 1.1 + Math.sin(t * 1.6) * 0.12;
    }
    // Shrink away while a legend is focused
    if (group.current) {
      const s = THREE.MathUtils.damp(group.current.scale.x, dimmed ? 0.001 : 1, 5, delta);
      group.current.scale.setScalar(s);
      group.current.visible = s > 0.01;
    }
  });

  return (
    <group position={position}>
      <group ref={group}>
        <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.02}>
          <ringGeometry args={[0.45, 0.6, 6, 1]} />
          <meshBasicMaterial
            color="#9be7ff"
            transparent
            opacity={0.7}
            depthWrite={false}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position-y={0.015}>
          <circleGeometry args={[0.45, 32]} />
          <meshBasicMaterial
            color="#4fc3f7"
            transparent
            opacity={0.18}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh ref={crystal} position-y={1.1}>
          <octahedronGeometry args={[0.22, 0]} />
          <meshStandardMaterial
            color="#bfefff"
            emissive="#4fc3f7"
            emissiveIntensity={1.4}
            transparent
            opacity={0.85}
            flatShading
            toneMapped={false}
          />
        </mesh>
        <Sparkles count={18} position-y={0.8} scale={[0.9, 1.4, 0.9]} size={2.5} speed={0.6} color="#9be7ff" />
      </group>

      {/* Always mounted, hidden with CSS: unmounting drei's Html during a
          render tears down its React root mid-render (React warns about it) */}
      <Html
        position-y={TRIAL_MODEL_HEIGHT + 0.3}
        center
        zIndexRange={[10, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div className={`text-center whitespace-nowrap transition-opacity duration-200 ${showLabel ? "opacity-80" : "opacity-0"}`}>
          <div className="font-lol text-base sm:text-lg font-bold text-[#bfefff] trial-shadow-text">
            Empty Slot
          </div>
          <div className="text-xs sm:text-sm text-white/70 trial-shadow-text">
            Coming soon
          </div>
        </div>
      </Html>
    </group>
  );
}
