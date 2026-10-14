"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import type { FlightSample } from "@/components/owl-world/flightPath";
import { useOwlWorld } from "@/components/owl-world/owlStore";
import { playOwlCall, playVent } from "@/components/owl-world/owlSound";
import { nextIdleVent, ventSteam } from "@/components/owl-world/steam";
import { OWL_PAINTS, paintOwl } from "@/components/owl-world/owlPaint";
import { usePointerCursor } from "@/components/owl-world/Corridor";
import {
  headAngles,
  OWL_Z,
  OwlPoser,
  pointerPoint,
} from "@/components/owl-world/owlPoser";
import { useQuality } from "@/components/owl-world/quality";

export interface OwlHandle {
  // Called once per frame by the rig, after it has sampled the flight path
  update: (
    dt: number,
    sample: FlightSample,
    speed: number,
    pointer: THREE.Vector2,
  ) => void;
}

const _r = new THREE.Quaternion();
// A click plays the sitting owl's wing stretch this much faster, with a
// wingbeat sound where its wings open (seconds into the clip at normal speed)
export const CLICK_STRETCH_SPEED = 1.5;
export const STRETCH_WINGBEATS = [0.55, 1.85, 4.55];
export const clickWingbeats = () =>
  STRETCH_WINGBEATS.map((t) => t / CLICK_STRETCH_SPEED);

/** A clicked owl vents hard, and again (softer) as its wings sweep open */
export function clickVent(owl: THREE.Object3D) {
  ventSteam(owl, { strength: 1 });
  ventSteam(owl, { strength: 0.45, delay: clickWingbeats()[1]! });
  playVent();
}

/** Now and then an owl lets off a little steam by itself */
export function idleVent(owl: THREE.Object3D) {
  ventSteam(owl, {
    strength: 0.3 + Math.random() * 0.25,
    sparks: Math.random() < 0.6,
  });
  playVent({ quiet: true, strength: 0.7 });
}
const _head = new THREE.Vector3();
const _seen = new THREE.Vector3();

/** The guide owl: flies the path the scroll drives */
const Owl = forwardRef<OwlHandle>(function Owl(_, ref) {
  const { scene, animations } = useGLTF(useQuality().owlUrl);
  const group = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);

  const poser = useMemo(() => {
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false; // skinned bounds don't follow the flap
      (mesh.material as THREE.MeshStandardMaterial).envMapIntensity = 1.7;
    });
    // The guide is silver with rainbow wings and tail; the companions get
    // their own paint
    paintOwl(scene, { ...OWL_PAINTS.charcoal, rainbow: true });
    return new OwlPoser(scene, animations);
  }, [scene, animations]);

  useEffect(() => () => poser.dispose(), [poser]);

  const state = useRef({
    look: { yaw: 0, pitch: 0 },
    spin: -1, // 0..1 progress of a celebratory barrel roll, -1 when idle
    cheer: false,
    // How settled on its perch the owl is this frame (clicks only count then)
    perch: 0,
    // Seconds to the next idle puff of steam
    vent: nextIdleVent(),
  });
  const [hovered, setHovered] = useState(false);
  const [sitting, setSitting] = useState(true);
  usePointerCursor(hovered && sitting);

  // Cheer (contact form sent): stretch the wings if sitting, roll if flying
  const cheer = useOwlWorld((s) => s.cheer);
  const lastCheer = useRef(cheer);
  useEffect(() => {
    if (cheer === lastCheer.current) return;
    lastCheer.current = cheer;
    state.current.cheer = true;
  }, [cheer]);

  useImperativeHandle(
    ref,
    () => ({
      update(dt, sample, speed, pointer) {
        const st = state.current;
        const g = group.current;
        if (!g) return;
        if (st.cheer) {
          st.cheer = false;
          if (sample.perch > 0.5) poser.stretch();
          else st.spin = 0;
        }

        // Sitting owls watch the pointer: the head turns to the point under
        // it, at the owl's own depth
        _head.copy(sample.pos).setY(sample.pos.y + 0.35);
        const want = headAngles(
          _head,
          sample.quat,
          pointerPoint(camera, pointer, _head, _seen),
        );
        st.look.yaw = THREE.MathUtils.damp(st.look.yaw, want.yaw, 4, dt);
        st.look.pitch = THREE.MathUtils.damp(st.look.pitch, want.pitch, 4, dt);

        const bob = poser.update(dt, {
          perch: sample.perch,
          hover: sample.hover,
          land: sample.land,
          speed,
          lookYaw: st.look.yaw,
          lookPitch: st.look.pitch,
        });

        st.perch = sample.perch;
        st.vent -= dt;
        if (st.vent <= 0) {
          st.vent = nextIdleVent();
          idleVent(g);
        }
        const nowSitting = sample.perch > 0.95;
        if (nowSitting !== sitting) setSitting(nowSitting);
        g.position.copy(sample.pos);
        g.position.y += bob;
        g.quaternion.copy(sample.quat);

        if (st.spin >= 0) {
          st.spin += dt / 1.1;
          if (st.spin >= 1) st.spin = -1;
          else {
            const e = THREE.MathUtils.smootherstep(st.spin, 0, 1);
            g.quaternion.multiply(_r.setFromAxisAngle(OWL_Z, e * Math.PI * 2));
          }
        }
      },
    }),
    [poser, camera, sitting],
  );

  return (
    <group
      ref={group}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        // Only a sitting owl answers; one in flight ignores the click
        if (state.current.perch < 0.95) return;
        e.stopPropagation();
        if (!poser.stretch(CLICK_STRETCH_SPEED)) return;
        playOwlCall({ pitch: 1, wingbeats: clickWingbeats() });
        clickVent(group.current!);
        state.current.vent = nextIdleVent();
      }}
    >
      <primitive object={scene} />
      {/* An easy target round the body: the owl is small on screen */}
      <mesh position-y={0.02} userData={{ noShadow: true }}>
        <sphereGeometry args={[0.36, 12, 10]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          colorWrite={false}
        />
      </mesh>
    </group>
  );
});

export default Owl;
