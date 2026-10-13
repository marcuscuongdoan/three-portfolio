"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import type { FlightSample } from "@/components/owl-world/flightPath";
import { useOwlWorld } from "@/components/owl-world/owlStore";
import { headAngles, OWL_Z, OwlPoser, pointerPoint } from "@/components/owl-world/owlPoser";

export const OWL_URL = "/models/owl_web.glb";

export interface OwlHandle {
  // Called once per frame by the rig, after it has sampled the flight path
  update: (dt: number, sample: FlightSample, speed: number, pointer: THREE.Vector2) => void;
}

const _r = new THREE.Quaternion();
const _head = new THREE.Vector3();
const _seen = new THREE.Vector3();

/** The guide owl: flies the path the scroll drives */
const Owl = forwardRef<OwlHandle>(function Owl(_, ref) {
  const { scene, animations } = useGLTF(OWL_URL);
  const group = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);

  const poser = useMemo(() => {
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false; // skinned bounds don't follow the flap
      (mesh.material as THREE.MeshStandardMaterial).envMapIntensity = 1.7;
    });
    return new OwlPoser(scene, animations);
  }, [scene, animations]);

  useEffect(() => () => poser.dispose(), [poser]);
  useEffect(() => useOwlWorld.getState().setLoaded(), []);

  const state = useRef({
    look: { yaw: 0, pitch: 0 },
    spin: -1, // 0..1 progress of a celebratory barrel roll, -1 when idle
    cheer: false,
  });

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
        const want = headAngles(_head, sample.quat, pointerPoint(camera, pointer, _head, _seen));
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
    [poser, camera],
  );

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  );
});

export default Owl;

useGLTF.preload(OWL_URL);
