"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Bvh, CameraControls, Environment, Lightformer } from "@react-three/drei";
import { Bloom, EffectComposer, Outline, ToneMapping } from "@react-three/postprocessing";
import { BloomEffect, ToneMappingMode } from "postprocessing";
import PlantModel, { type PlantRuntime } from "@/components/plant-showroom/PlantModel";
import PlantFlows from "@/components/plant-showroom/PlantFlows";
import HologramIntro from "@/components/bike-showroom/HologramIntro";
import { peekShowroomAudio } from "@/components/bike-showroom/showroomAudio";
import type { PlantDefinition } from "@/config/gasTurbine";
import type { PlantSim } from "@/components/plant-showroom/plantSim";

// Below this width the part panel is a bottom sheet instead of a side panel
const STACKED_BREAKPOINT = 768;
const MAX_DISTANCE = 20;
// Seconds without input before the idle turntable resumes
const IDLE_DELAY = 4;
const EMPTY: THREE.Object3D[] = [];

function CameraRig({
  def,
  plant,
  selected,
  resetKey,
}: {
  def: PlantDefinition;
  plant: PlantRuntime | null;
  selected: string | null;
  resetKey: number;
}) {
  const CAMERA = def.camera;
  const controls = useRef<CameraControls>(null);
  const size = useThree((s) => s.size);
  const lastInput = useRef(-Infinity);
  const stacked = size.width < STACKED_BREAKPOINT;

  // Overview, or the open part framed from the overview side
  useEffect(() => {
    const c = controls.current;
    if (!c || !plant) return;
    const [tx, ty, tz] = CAMERA.target;
    const [px, py, pz] = CAMERA.position;
    const part = selected ? plant.parts.get(selected) : undefined;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(CAMERA.fov / 2));
    const aspect = size.width / size.height;

    if (!part) {
      // Portrait screens back off so the whole pad fits the width
      const k = stacked ? 1.75 : 1;
      c.setLookAt(tx + (px - tx) * k, ty + (py - ty) * k, tz + (pz - tz) * k, tx, ty, tz, true);
      c.setFocalOffset(0, 0, 0, true);
      return;
    }
    const center = part.box.getCenter(new THREE.Vector3());
    center.y += plant.groundOffset;
    const radius = part.box.getSize(new THREE.Vector3()).length() / 2;
    const dir = new THREE.Vector3(px - tx, py - ty, pz - tz).normalize();
    // Fit the part's bounding sphere in the share of the view the panel leaves
    const fit = radius / (tanHalf * Math.min(1, aspect) * (stacked ? 0.95 : 0.8));
    const distance = THREE.MathUtils.clamp(fit * 1.35, 2.4, MAX_DISTANCE) * (stacked ? 1.35 : 1);
    const eye = center.clone().addScaledVector(dir, distance);
    c.setLookAt(eye.x, eye.y, eye.z, center.x, center.y, center.z, true);
    // Bottom sheet on phones; on wider screens the part sits in the gap
    // between the parts list (left) and the panel (right)
    if (stacked) c.setFocalOffset(0, distance * tanHalf * 0.5, 0, true);
    else c.setFocalOffset(distance * tanHalf * aspect * 0.16, 0, 0, true);
  }, [plant, selected, size.width, size.height, stacked, resetKey, CAMERA]);

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
    if (!c || selected) return;
    if (performance.now() / 1000 - lastInput.current < IDLE_DELAY) return;
    c.rotate(delta * 0.08, 0, false);
  });

  return (
    <CameraControls
      ref={controls}
      makeDefault
      minDistance={1.2}
      maxDistance={MAX_DISTANCE}
      maxPolarAngle={Math.PI * 0.48}
      smoothTime={0.5}
    />
  );
}

/**
 * Night yard: dark floor, a cool moon key light with shadows sized to the
 * pad, warm floodlights, and procedural reflections for the steel.
 */
function Yard({ night, shadows }: { night: string; shadows: boolean }) {
  const shadow = useRef<THREE.ShadowMaterial>(null);
  const level = useRef(0);
  useFrame((_, delta) => {
    level.current = THREE.MathUtils.damp(level.current, shadows ? 1 : 0, 4, Math.min(delta, 0.1));
    if (shadow.current) shadow.current.opacity = 0.45 * level.current;
  });
  return (
    <>
      <color attach="background" args={[night]} />
      <fog attach="fog" args={[night, 14, 34]} />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.002} receiveShadow={false} raycast={() => null}>
        <circleGeometry args={[60, 64]} />
        <meshStandardMaterial color="#161a21" roughness={0.95} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.0005} receiveShadow raycast={() => null}>
        <circleGeometry args={[12, 64]} />
        <shadowMaterial ref={shadow} transparent opacity={0} />
      </mesh>

      <ambientLight intensity={0.25} color="#b8c6ff" />
      <directionalLight
        position={[5, 9, 4]}
        intensity={1.5}
        color="#dfe6ff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-4.5}
        shadow-camera-right={4.5}
        shadow-camera-top={4.5}
        shadow-camera-bottom={-4.5}
        shadow-camera-near={1}
        shadow-camera-far={25}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      {/* Sodium floodlights on the yard */}
      <pointLight position={[-3.6, 3.2, 3]} intensity={6} distance={12} decay={1.6} color="#ffc27a" />
      <pointLight position={[3.4, 3.4, -3.2]} intensity={5} distance={12} decay={1.6} color="#ffb066" />

      <Environment resolution={256}>
        <Lightformer form="rect" intensity={2.2} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[12, 5, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#ffd1a1" position={[7, 2, 0]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={1} color="#c9d6ff" position={[-7, 2, 0]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="ring" intensity={1.6} color="#ffe2c4" position={[0, 3, -7]} scale={3} />
      </Environment>
    </>
  );
}

// Feeds the intro clock and the simulation to the synthesised sound
function PlantSound({ def, sim, introClock }: { def: PlantDefinition; sim: PlantSim; introClock: React.RefObject<number> }) {
  useEffect(() => () => peekShowroomAudio()?.stopAll(), []);
  useFrame((_, delta) => {
    const audio = peekShowroomAudio();
    if (!audio?.isEnabled) return;
    audio.updateIntro(introClock.current, def.intro, Math.min(delta, 0.1));
    const s = sim.state;
    audio.updateTurbine({
      speed: s.speed,
      flame: s.flame,
      load: s.load,
      alarm: s.mode === "starting" && s.phase.id === "sbo",
      busLive: s.busLive,
      loadsOn: s.loadsOn,
    });
  });
  return null;
}

const meshesOf = (plant: PlantRuntime | null, id: string | null) =>
  (id && plant?.parts.get(id)?.meshes) || EMPTY;

interface PlantSceneProps {
  def: PlantDefinition;
  sim: PlantSim;
  // Plant seconds per real second
  rate: number;
  showFlows: boolean;
  introActive: boolean;
  introSkipped: boolean;
  introRunning: boolean;
  onIntroReveal: () => void;
  onIntroDone: () => void;
  onIntroProgress: (progress: number) => void;
  resetKey: number;
  hovered: string | null;
  selected: string | null;
  onHoverPart: (id: string | null) => void;
  onClickPart: (id: string) => void;
  onClickEmpty: () => void;
  busLabel: React.RefObject<HTMLDivElement | null>;
}

export default function PlantScene({
  def,
  sim,
  rate,
  showFlows,
  introActive,
  introSkipped,
  introRunning,
  onIntroReveal,
  onIntroDone,
  onIntroProgress,
  resetKey,
  hovered,
  selected,
  onHoverPart,
  onClickPart,
  onClickEmpty,
  busLabel,
}: PlantSceneProps) {
  const INTRO = def.intro;
  const [plant, setPlant] = useState<PlantRuntime | null>(null);
  const handleReady = useCallback((runtime: PlantRuntime) => setPlant(runtime), []);
  const hoverSelection = useMemo(
    () => (hovered && hovered !== selected ? meshesOf(plant, hovered) : EMPTY),
    [plant, hovered, selected],
  );
  const selectedSelection = useMemo(() => meshesOf(plant, selected), [plant, selected]);

  const introClock = useRef(-1);
  const introPhase = useRef<"waiting" | "build" | "reveal" | "done">("waiting");
  const introProgress = useRef(-1);
  const bloom = useRef<BloomEffect>(null);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    sim.advance(delta * rate);

    // Same clock as the bike showroom's intro (see BikeScene)
    if (introSkipped) introClock.current = INTRO.end;
    else if (introActive) introClock.current = Math.max(introClock.current, 0) + Math.min(rawDelta, 1 / 30);
    if (introPhase.current === "waiting" && introClock.current >= 0) introPhase.current = "build";
    if (introPhase.current === "build" && introClock.current >= INTRO.textureStart) {
      introPhase.current = "reveal";
      onIntroReveal();
    }
    const progress =
      introClock.current < 0 ? 0 : THREE.MathUtils.smoothstep(introClock.current, INTRO.scanStart, INTRO.textureEnd);
    if (Math.abs(progress - introProgress.current) > 0.002 || (progress === 1 && introProgress.current !== 1)) {
      introProgress.current = progress;
      onIntroProgress(progress);
    }
    if (introPhase.current === "reveal" && introClock.current >= INTRO.end) {
      introPhase.current = "done";
      onIntroDone();
    }
    const introGlow = introClock.current >= 0 && introClock.current < INTRO.end ? 1 : 0;
    if (bloom.current) bloom.current.intensity = Math.max(0.9, introGlow * 1.2);
  });

  return (
    <>
      <Yard night={def.theme.night} shadows={!introRunning} />
      <PlantSound def={def} sim={sim} introClock={introClock} />
      {plant && <HologramIntro bike={plant} clock={introClock} intro={INTRO} laserSpan={1.9} />}
      {plant && (
        <PlantFlows
          def={def}
          sim={sim}
          groundOffset={plant.groundOffset}
          show={showFlows}
          selected={selected}
          busLabel={busLabel}
        />
      )}
      <Suspense fallback={null}>
        <Bvh firstHitOnly>
          <PlantModel
            def={def}
            sim={sim}
            selected={selected}
            onReady={handleReady}
            onHoverPart={onHoverPart}
            onClickPart={onClickPart}
            onClickEmpty={onClickEmpty}
          />
        </Bvh>
      </Suspense>
      <CameraRig def={def} plant={plant} selected={selected} resetKey={resetKey} />

      {/* autoClear={false} is required for Outline; the composer turns off the
          renderer's tone mapping, so ACES is re-added at the end */}
      <EffectComposer autoClear={false} multisampling={4}>
        <Outline
          selection={hoverSelection}
          selectionLayer={10}
          visibleEdgeColor={0xff6b2c}
          hiddenEdgeColor={0xff6b2c}
          edgeStrength={4}
          blur
        />
        <Outline
          selection={selectedSelection}
          selectionLayer={11}
          visibleEdgeColor={0xff6b2c}
          hiddenEdgeColor={0x9d8cff}
          edgeStrength={7}
          pulseSpeed={0.3}
          blur
        />
        <Bloom ref={bloom} mipmapBlur luminanceThreshold={1.05} luminanceSmoothing={0.2} intensity={0.9} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  );
}
