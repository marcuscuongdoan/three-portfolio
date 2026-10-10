"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Bvh,
  CameraControls,
  ContactShadows,
  Environment,
  Lightformer,
} from "@react-three/drei";
import { EffectComposer, Outline, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import BikeModel, { BikeRuntime } from "@/components/africa-twin/BikeModel";
import { AFRICA_TWIN_CAMERA, PartId } from "@/config/africaTwin";

export const STUDIO_COLOR = "#e8eaed";
// Below this width the part panel is a bottom sheet instead of a side panel
const STACKED_BREAKPOINT = 768;
// Seconds without input before the idle turntable resumes
const IDLE_DELAY = 4;

const EMPTY: THREE.Object3D[] = [];

function CameraRig({
  bike,
  selected,
  paused,
}: {
  bike: BikeRuntime | null;
  selected: PartId | null;
  paused: boolean;
}) {
  const controls = useRef<CameraControls>(null);
  const size = useThree((s) => s.size);
  const lastInput = useRef(-Infinity);

  // Fly to the selected part (exploded position) or back to the overview
  useEffect(() => {
    const c = controls.current;
    if (!c || !bike) return;
    const stacked = size.width < STACKED_BREAKPOINT;
    const [tx, ty, tz] = AFRICA_TWIN_CAMERA.target;
    const [px, py, pz] = AFRICA_TWIN_CAMERA.position;

    const part = selected ? bike.parts.get(selected) : undefined;
    if (!part) {
      // Portrait screens back off so the whole bike fits the width
      const scale = stacked ? 1.7 : 1;
      c.setLookAt(px * scale, py * scale, pz * scale, tx, ty, tz, true);
      c.setFocalOffset(0, 0, 0, true);
      return;
    }

    const center = part.center.clone().add(part.explode);
    center.y += bike.groundOffset;
    // Look from the overview side, leaning toward the direction the part
    // moved out so it isn't hidden behind the rest of the bike
    const overviewDir = new THREE.Vector3(px - tx, py - ty, pz - tz).normalize();
    const outward = part.explode.clone();
    const dir = overviewDir.multiplyScalar(0.8).add(outward.normalize().multiplyScalar(0.5));
    dir.y = Math.max(dir.y, 0.25);
    dir.normalize();
    // The bottom sheet leaves only the top half of a phone for the part
    const distance = THREE.MathUtils.clamp(part.radius * 3.4, 1.2, 4.2) * (stacked ? 2 : 1);
    const eye = center.clone().addScaledVector(dir, distance);
    c.setLookAt(eye.x, eye.y, eye.z, center.x, center.y, center.z, true);

    // Shift the view so the part clears the panel: right-hand panel on wide
    // screens, bottom sheet on narrow ones
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(AFRICA_TWIN_CAMERA.fov / 2));
    if (stacked) c.setFocalOffset(0, distance * tanHalf * 0.5, 0, true);
    else c.setFocalOffset(distance * tanHalf * (size.width / size.height) * 0.36, 0, 0, true);
  }, [bike, selected, size.width, size.height]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const onStart = () => {
      lastInput.current = performance.now() / 1000;
    };
    c.addEventListener("controlstart", onStart);
    c.addEventListener("control", onStart);
    return () => {
      c.removeEventListener("controlstart", onStart);
      c.removeEventListener("control", onStart);
    };
  }, []);

  // Slow turntable while nobody is interacting
  useFrame((_, delta) => {
    const c = controls.current;
    if (!c || selected || paused) return;
    if (performance.now() / 1000 - lastInput.current < IDLE_DELAY) return;
    c.rotate(delta * 0.12, 0, false);
  });

  return (
    <CameraControls
      ref={controls}
      makeDefault
      minDistance={0.8}
      maxDistance={9}
      maxPolarAngle={Math.PI * 0.49}
      smoothTime={0.45}
    />
  );
}

function Studio() {
  return (
    <>
      <color attach="background" args={[STUDIO_COLOR]} />
      {/* Unlit floor in the background colour: a seamless infinite studio */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.001}>
        <circleGeometry args={[40, 64]} />
        <meshBasicMaterial color={STUDIO_COLOR} />
      </mesh>
      <ContactShadows position-y={0.001} scale={7} far={2} blur={2.4} opacity={0.55} resolution={1024} />

      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 5, -2]} intensity={1.6} />
      <directionalLight position={[-4, 3, 3]} intensity={0.6} color="#dfe8ff" />

      {/* Procedural studio reflections — no HDR download */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3} position={[0, 4, 0]} rotation-x={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={1.6} position={[5, 1.5, 0]} rotation-y={-Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[-5, 1.5, 0]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer form="ring" intensity={2} color="#ffe2c4" position={[0, 2, -5]} scale={2} />
      </Environment>
    </>
  );
}

// OutlineEffect outlines meshes, not groups
const meshesOf = (bike: BikeRuntime | null, id: PartId | null) =>
  (id && bike?.parts.get(id)?.meshes) || EMPTY;

interface BikeSceneProps {
  exploded: boolean;
  hovered: PartId | null;
  selected: PartId | null;
  onHoverPart: (id: PartId | null) => void;
  onClickPart: (id: PartId) => void;
}

export default function BikeScene({
  exploded,
  hovered,
  selected,
  onHoverPart,
  onClickPart,
}: BikeSceneProps) {
  const [bike, setBike] = useState<BikeRuntime | null>(null);
  const handleReady = useCallback((runtime: BikeRuntime) => setBike(runtime), []);

  const hoverSelection = useMemo(
    () => (hovered && hovered !== selected ? meshesOf(bike, hovered) : EMPTY),
    [bike, hovered, selected],
  );
  const selectedSelection = useMemo(() => meshesOf(bike, selected), [bike, selected]);

  return (
    <>
      <Studio />
      <Suspense fallback={null}>
        {/* BVH-accelerated raycasting: ~300k triangles are hit-tested on every pointer move */}
        <Bvh firstHitOnly>
          <BikeModel
            exploded={exploded}
            selected={selected}
            onReady={handleReady}
            onHoverPart={onHoverPart}
            onClickPart={onClickPart}
          />
        </Bvh>
      </Suspense>

      <CameraRig bike={bike} selected={selected} paused={exploded} />

      {/* autoClear={false} is required for Outline; the composer turns off the
          renderer's tone mapping, so ACES is re-added at the end */}
      <EffectComposer autoClear={false} multisampling={4}>
        <Outline
          selection={hoverSelection}
          selectionLayer={10}
          visibleEdgeColor={0xe4002b}
          hiddenEdgeColor={0xe4002b}
          edgeStrength={5}
          blur
        />
        <Outline
          selection={selectedSelection}
          selectionLayer={11}
          visibleEdgeColor={0xe4002b}
          hiddenEdgeColor={0x1f3a93}
          edgeStrength={8}
          pulseSpeed={0.3}
          blur
        />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  );
}
