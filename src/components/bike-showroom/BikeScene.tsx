"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Bvh,
  CameraControls,
  Environment,
  Lightformer,
} from "@react-three/drei";
import { Bloom, DepthOfField, EffectComposer, Outline, ToneMapping } from "@react-three/postprocessing";
import { BloomEffect, DepthOfFieldEffect, ToneMappingMode } from "postprocessing";
import BikeModel, { BikeRuntime } from "@/components/bike-showroom/BikeModel";
import RideEffects from "@/components/bike-showroom/RideEffects";
import HologramIntro from "@/components/bike-showroom/HologramIntro";
import Garage from "@/components/bike-showroom/Garage";
import BackdropSweep from "@/components/bike-showroom/BackdropSweep";
import ShowroomSound from "@/components/bike-showroom/ShowroomSound";
import { overviewDistance, SUN_DIRECTION } from "@/config/bikeShowroom";
import { useBikeDef } from "@/components/bike-showroom/BikeContext";

type PartId = string;
// Below this width the part panel is a bottom sheet instead of a side panel
const STACKED_BREAKPOINT = 768;
// Furthest the camera goes (user zoom, and framing long parts on a phone)
const MAX_DISTANCE = 14;
// Seconds without input before the idle turntable resumes
const IDLE_DELAY = 4;

const EMPTY: THREE.Object3D[] = [];

function CameraRig({
  bike,
  selected,
  exploded,
  resetKey,
}: {
  bike: BikeRuntime | null;
  selected: PartId | null;
  exploded: boolean;
  // Bumped to send the camera back to the overview (Assemble)
  resetKey: number;
}) {
  const { camera: CAMERA, explode: EXPLODE } = useBikeDef();
  const overview = overviewDistance(CAMERA);
  const controls = useRef<CameraControls>(null);
  const size = useThree((s) => s.size);
  const lastInput = useRef(-Infinity);
  const stacked = size.width < STACKED_BREAKPOINT;
  // Portrait screens back off so the whole bike fits the width; exploded
  // backs off further so the spread-out parts still fit
  const overviewScale = (stacked ? 1.7 : 1) * (exploded ? EXPLODE.explodedDolly : 1);

  // Latest values for effects that must not re-run when these change
  const overviewScaleRef = useRef(overviewScale);
  const selectedRef = useRef(selected);
  useEffect(() => {
    overviewScaleRef.current = overviewScale;
    selectedRef.current = selected;
  });

  // Fly to the selected part (exploded position) or back to the overview
  useEffect(() => {
    const c = controls.current;
    if (!c || !bike) return;
    const [tx, ty, tz] = CAMERA.target;
    const [px, py, pz] = CAMERA.position;

    const part = selected ? bike.parts.get(selected) : undefined;
    if (!part) {
      const k = overviewScaleRef.current;
      c.setLookAt(tx + (px - tx) * k, ty + (py - ty) * k, tz + (pz - tz) * k, tx, ty, tz, true);
      c.setFocalOffset(0, 0, 0, true);
      return;
    }

    // Frame the part where it sits while open (every mesh at its own focus
    // offset — see PartRuntime.focusBox)
    const center = part.focusBox.getCenter(new THREE.Vector3());
    center.y += bike.groundOffset;
    const boxSize = part.focusBox.getSize(new THREE.Vector3());
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(CAMERA.fov / 2));
    const aspect = size.width / size.height;
    // Long along the bike (front + rear halves): look from the side so both
    // ends sit across the screen, back far enough to fit them in the part of
    // the view the panel leaves free
    const spansBike = boxSize.z > 2 * Math.max(boxSize.x, boxSize.y);

    let dir: THREE.Vector3;
    let distance: number;
    if (spansBike) {
      dir = new THREE.Vector3(1, 0.4, 0).normalize();
      // Between the parts list (left) and the panel (right) on desktop
      const freeWidth = stacked ? 0.9 : 0.46;
      const fitWidth = boxSize.z / 2 / (tanHalf * aspect * freeWidth);
      const fitHeight = boxSize.y / 2 / (tanHalf * (stacked ? 0.45 : 0.85));
      // A phone is narrow: framing both ends can take further than desktop
      distance = THREE.MathUtils.clamp(Math.max(fitWidth, fitHeight) * 1.1, 1.2, MAX_DISTANCE);
    } else {
      // Look from the overview side, leaning toward the direction the part
      // moved out so it isn't hidden behind the rest of the bike
      const [px, py, pz] = CAMERA.position;
      const [tx, ty, tz] = CAMERA.target;
      const overviewDir = new THREE.Vector3(px - tx, py - ty, pz - tz).normalize();
      dir = overviewDir.multiplyScalar(0.8).add(part.explode.clone().normalize().multiplyScalar(0.5));
      dir.y = Math.max(dir.y, 0.25);
      dir.normalize();
      const radius = boxSize.length() / 2;
      // The bottom sheet leaves only the top half of a phone for the part
      // Small parts (a fly screen) still keep some room around them
      distance = THREE.MathUtils.clamp(radius * 3.4, 1.6, 4.2) * (stacked ? 2 : 1);
    }
    const eye = center.clone().addScaledVector(dir, distance);
    c.setLookAt(eye.x, eye.y, eye.z, center.x, center.y, center.z, true);

    // Shift the view so the part clears the panel: right-hand panel on wide
    // screens, bottom sheet on narrow ones
    if (stacked) c.setFocalOffset(0, distance * tanHalf * 0.5, 0, true);
    // Long parts centre in the gap between list and panel; others sit left
    else c.setFocalOffset(distance * tanHalf * aspect * (spansBike ? 0.2 : 0.36), 0, 0, true);
    // overviewScale is read through a ref: exploding only dollies (below)
    // instead of re-aiming the camera
  }, [bike, selected, size.width, size.height, stacked, resetKey, CAMERA]);


  // Exploding / assembling backs the camera off / in, keeping the angle
  useEffect(() => {
    const c = controls.current;
    if (!c || selectedRef.current) return;
    c.dollyTo(overview * overviewScale, true);
  }, [overviewScale, overview]);

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
    if (!c || selected || exploded) return;
    if (performance.now() / 1000 - lastInput.current < IDLE_DELAY) return;
    c.rotate(delta * 0.12, 0, false);
  });

  return (
    <CameraControls
      ref={controls}
      makeDefault
      minDistance={0.8}
      maxDistance={MAX_DISTANCE}
      maxPolarAngle={Math.PI * 0.49}
      smoothTime={0.45}
    />
  );
}

// Cast shadow of the whole bike from the key light (drei's ContactShadows
// was dropped: its square plane showed as a lighter tile on the garage floor)
const CAST_SHADOW_OPACITY = 0.32;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

const STUDIO_KEY: [number, number, number] = [3, 5, -2];
const SUN_DISTANCE = 40;
// Studio: a tight 5 m box on the bike (crisp). Terrain: 60 m around it so
// buildings, poles and rocks shadow the ground too, at double resolution.
// Reallocates the map, so only on the switch
const fitShadow = (light: THREE.DirectionalLight, wide: boolean) => {
  const half = wide ? 30 : 2.6;
  const cam = light.shadow.camera;
  cam.left = cam.bottom = -half;
  cam.right = cam.top = half;
  cam.far = wide ? 90 : 15;
  cam.updateProjectionMatrix();
  light.shadow.mapSize.setScalar(wide ? 4096 : 2048);
  light.shadow.normalBias = wide ? 0.05 : 0.02;
  light.shadow.map?.dispose();
  light.shadow.map = null;
};

// The studio darkens while the bike's lights are on. The floor and contact
// shadow only exist while assembled: apart, parts may drop below y = 0
function Studio({
  darkLevel,
  lightsLevel,
  apart,
  intro,
  worldLevel,
}: {
  // 0 = light studio, 1 = dark (lights on, or the intro)
  darkLevel: React.RefObject<number>;
  // The bike's lights: swaps in a floor that the headlight beams can light
  lightsLevel: React.RefObject<number>;
  apart: boolean;
  // The hologram intro is running: no shadows until the real bike is in
  intro: boolean;
  // Ride world reveal (0..1): its terrain takes over as the ground. The
  // studio's flat floor, shadow catcher and contact shadows would otherwise
  // float over the dunes (the contact shadow even picks up the sand ripples)
  worldLevel: React.RefObject<number>;
}) {
  const { studio } = useBikeDef().theme;
  const { DAY, NIGHT } = useMemo(
    () => ({ DAY: new THREE.Color(studio.day), NIGHT: new THREE.Color(studio.night) }),
    [studio],
  );
  const floor = useRef<THREE.MeshBasicMaterial>(null);
  const floorMesh = useRef<THREE.Mesh>(null);
  const litFloor = useRef<THREE.Mesh>(null);
  const shadowLevel = useRef(1);
  const castShadow = useRef<THREE.ShadowMaterial>(null);
  const ambient = useRef<THREE.AmbientLight>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);
  // Shadow frustum: tight on the bike in the studio, wide over the terrain
  const wideShadow = useRef(false);

  useFrame(({ scene }, delta) => {
    const t = darkLevel.current;
    // Floor matches the background, so hiding it is invisible — it just
    // stops occluding parts that fall below it
    const world = worldLevel.current;
    const onTerrain = world > 0.3;
    if (floorMesh.current) floorMesh.current.visible = !apart && !onTerrain;
    // The unlit floor fades out over a lit one while the lights are on: its
    // emissive matches the dark background, so only the beams' pools show
    const lit = lightsLevel.current;
    if (floor.current) {
      floor.current.transparent = lit > 0.001;
      floor.current.opacity = 1 - lit;
    }
    if (litFloor.current) litFloor.current.visible = lit > 0.001 && !apart && !onTerrain;
    shadowLevel.current = THREE.MathUtils.damp(
      shadowLevel.current,
      apart || intro ? 0 : 1,
      6,
      Math.min(delta, 0.1),
    );
    // The bike's real shadow still lands on the sand (it receives shadows)
    const studioShadow = shadowLevel.current * (1 - THREE.MathUtils.smoothstep(world, 0, 0.3));
    if (castShadow.current) {
      castShadow.current.opacity = CAST_SHADOW_OPACITY * studioShadow;
      castShadow.current.visible = studioShadow > 0.01;
    }
    if (scene.background instanceof THREE.Color) scene.background.lerpColors(DAY, NIGHT, t);
    floor.current?.color.lerpColors(DAY, NIGHT, t);
    // In the world the key light is the sun the sky shows (SUN_DIRECTION).
    // The studio's soft reflections would wash its shadows out, so the sun
    // takes over most of the lighting there
    const sunAt = THREE.MathUtils.smoothstep(world, 0, 0.6);
    scene.environmentIntensity = mix(mix(1, 0.18, t), mix(0.4, 0.12, t), sunAt);
    if (ambient.current) ambient.current.intensity = mix(mix(0.35, 0.05, t), mix(0.15, 0.04, t), sunAt);
    if (key.current) {
      key.current.intensity = mix(mix(1.6, 0.25, t), mix(3.4, 0.45, t), sunAt);
      key.current.position.set(
        mix(STUDIO_KEY[0], SUN_DIRECTION[0] * SUN_DISTANCE, sunAt),
        mix(STUDIO_KEY[1], SUN_DIRECTION[1] * SUN_DISTANCE, sunAt),
        mix(STUDIO_KEY[2], SUN_DIRECTION[2] * SUN_DISTANCE, sunAt),
      );
      if (onTerrain !== wideShadow.current) {
        wideShadow.current = onTerrain;
        fitShadow(key.current, onTerrain);
      }
    }
    if (fill.current) fill.current.intensity = mix(0.6, 0.12, t);
  });

  return (
    <>
      <color attach="background" args={[studio.day]} />
      {/* Unlit floor in the background colour: a seamless infinite studio */}
      <mesh ref={floorMesh} rotation-x={-Math.PI / 2} position-y={-0.001}>
        <circleGeometry args={[40, 64]} />
        <meshBasicMaterial ref={floor} color={studio.day} />
      </mesh>
      <mesh ref={litFloor} rotation-x={-Math.PI / 2} position-y={-0.002} visible={false}>
        <circleGeometry args={[40, 64]} />
        <meshStandardMaterial color="#5a616b" emissive={studio.night} roughness={0.85} />
      </mesh>
      {/* Catches the key light's shadow of the whole bike (assembled only).
          Wider than the garage, so its edge never shows on the garage floor */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.0005} receiveShadow raycast={() => null}>
        <circleGeometry args={[30, 64]} />
        <shadowMaterial ref={castShadow} transparent opacity={CAST_SHADOW_OPACITY} />
      </mesh>


      <ambientLight ref={ambient} intensity={0.35} />
      <directionalLight
        ref={key}
        position={STUDIO_KEY}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-2.6}
        shadow-camera-right={2.6}
        shadow-camera-top={2.6}
        shadow-camera-bottom={-2.6}
        shadow-camera-near={0.5}
        shadow-camera-far={15}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <directionalLight ref={fill} position={[-4, 3, 3]} intensity={0.6} color="#dfe8ff" />

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

/* ------------------------------ Headlights ------------------------------- */

const BEAM_LENGTH = 3.2;
const BEAM_COLOR = new THREE.Color("#fff3dc");

// Vertical alpha gradient for the beam cone: bright at the lamp (top of the
// texture = cone tip), gone by the open end. Built-in material, no shader
const makeBeamAlpha = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.35, "#5a5a5a");
  g.addColorStop(1, "#000000");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(canvas);
};

/**
 * Light from the headlights while the lights are on: real spotlights (they
 * pool on the lit floor) and a soft visible cone from each lamp. Assembled
 * only — once apart the lamps aren't where the beams would start.
 */
function HeadlightBeams({
  bike,
  lightsLevel,
  assembled,
}: {
  bike: BikeRuntime;
  lightsLevel: React.RefObject<number>;
  assembled: boolean;
}) {
  const { lights } = useBikeDef();
  const BEAM_DIRECTION = useMemo(() => new THREE.Vector3(...lights.beamDirection).normalize(), [lights]);
  const level = useRef(0);
  const spots = useRef<(THREE.SpotLight | null)[]>([]);
  const cones = useRef<(THREE.Mesh | null)[]>([]);
  const alphaMap = useMemo(() => makeBeamAlpha(), []);
  const geometry = useMemo(() => {
    // Tip at the origin, opening along local -Y
    const g = new THREE.ConeGeometry(0.75, BEAM_LENGTH, 32, 1, true);
    g.translate(0, -BEAM_LENGTH / 2, 0);
    return g;
  }, []);
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), BEAM_DIRECTION),
    [BEAM_DIRECTION],
  );
  const targets = useMemo(
    () =>
      lights.headlights.map(([x, y, z]) => {
        const target = new THREE.Object3D();
        target.position.set(x, y, z).addScaledVector(BEAM_DIRECTION, 4);
        return target;
      }),
    [lights, BEAM_DIRECTION],
  );

  useFrame((_, delta) => {
    const goal = lightsLevel.current * (assembled ? 1 : 0);
    const next = THREE.MathUtils.damp(level.current, goal, 5, Math.min(delta, 0.1));
    level.current = Math.abs(next - goal) < 0.001 ? goal : next;
    const l = level.current;
    spots.current.forEach((spot) => {
      if (!spot) return;
      spot.visible = l > 0.001;
      spot.intensity = 9 * l;
    });
    cones.current.forEach((cone) => {
      if (!cone) return;
      cone.visible = l > 0.001;
      (cone.material as THREE.MeshBasicMaterial).opacity = 0.16 * l;
    });
  });

  return (
    <group position-y={bike.groundOffset}>
      {lights.headlights.map((position, i) => (
        <group key={position.join()}>
          <primitive object={targets[i]!} />
          <spotLight
            ref={(s) => {
              spots.current[i] = s;
            }}
            position={position}
            target={targets[i]}
            color={BEAM_COLOR}
            intensity={0}
            angle={0.42}
            penumbra={0.7}
            distance={9}
            decay={1.1}
            visible={false}
          />
          <mesh
            ref={(m) => {
              cones.current[i] = m;
            }}
            position={position}
            quaternion={quaternion}
            geometry={geometry}
            visible={false}
            renderOrder={2}
            raycast={() => null}
          >
            <meshBasicMaterial
              color={BEAM_COLOR}
              alphaMap={alphaMap}
              transparent
              opacity={0}
              depthWrite={false}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// OutlineEffect outlines meshes, not groups
const meshesOf = (bike: BikeRuntime | null, id: PartId | null) =>
  (id && bike?.parts.get(id)?.meshes) || EMPTY;

interface BikeSceneProps {
  exploded: boolean;
  // Parts spread by click or zoom (beams hide)
  apart: boolean;
  lightsOn: boolean;
  riding: boolean;
  // Garage when parked, ride world when riding; off = plain studio
  backdrop: boolean;
  // Loading is done: start the hologram intro
  introActive: boolean;
  // Jump straight to the end of the intro
  introSkipped: boolean;
  // The intro is still on screen (page state, synced via the callbacks below)
  introRunning: boolean;
  // The scan starts (studio lights coming back) / the intro is over
  onIntroReveal: () => void;
  onIntroDone: () => void;
  // 0..1 through the intro, every frame it changes (for fading the page in)
  onIntroProgress: (progress: number) => void;
  resetKey: number;
  onZoomExplode: (zoomExploded: boolean) => void;
  hovered: PartId | null;
  selected: PartId | null;
  onHoverPart: (id: PartId | null) => void;
  onClickPart: (id: PartId) => void;
}

export default function BikeScene({
  exploded,
  apart,
  lightsOn,
  riding,
  backdrop,
  introActive,
  introSkipped,
  introRunning,
  onIntroReveal,
  onIntroDone,
  onIntroProgress,
  resetKey,
  onZoomExplode,
  hovered,
  selected,
  onHoverPart,
  onClickPart,
}: BikeSceneProps) {
  const def = useBikeDef();
  const { intro: INTRO, theme } = def;
  // Spec screens in the garage
  const screenTitle = `${def.modelLine.replace(def.brand, "").trim()}  ${def.title}`.toUpperCase();
  const screenLine = def.heroSpecs
    .slice(0, 3)
    .map(([value]) => value)
    .join("  ·  ");
  const [bike, setBike] = useState<BikeRuntime | null>(null);
  const handleReady = useCallback((runtime: BikeRuntime) => setBike(runtime), []);

  const hoverSelection = useMemo(
    () => (hovered && hovered !== selected ? meshesOf(bike, hovered) : EMPTY),
    [bike, hovered, selected],
  );
  const selectedSelection = useMemo(() => meshesOf(bike, selected), [bike, selected]);

  // 0..1, eased toward the lights toggle; read every frame by the studio,
  // lamps, beams and bloom
  const lightsLevel = useRef(0);
  // 0..1 ride speed: spins up and coasts down rather than snapping
  const rideLevel = useRef(0);
  // Studio darkness: the lights toggle, or the intro (dark until the scan)
  const darkLevel = useRef(1);
  // Seconds since the intro began; negative before it starts
  const introClock = useRef(-1);
  const introPhase = useRef<"waiting" | "build" | "reveal" | "done">("waiting");
  const introProgress = useRef(-1);
  const bloom = useRef<BloomEffect>(null);
  // While riding, focus on the bike so scenery right by the camera (and far
  // off) goes soft instead of blocking the view
  const dof = useRef<DepthOfFieldEffect>(null);
  const dofTarget = useMemo(() => new THREE.Vector3(), []);
  // Follows the ride toggle itself, not the coasting ride speed: stopping or
  // exploding must clear the blur at once, or the spread-out parts go soft
  const dofLevel = useRef(0);
  // Garage / ride world hand-off: each reports its fade, and neither starts
  // coming in until the other is gone (no two backdrops overlapping)
  const garageLevel = useRef(0);
  const worldLevel = useRef(0);
  // Showroom LED glow (bloom while parked)
  const garageGlow = useRef(0);
  // Parked: bike loaded (introActive), assembled, not riding, intro over
  const garageShown = backdrop && introActive && !apart && !riding && !introRunning;
  const worldShown = backdrop && riding;
  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const target = lightsOn ? 1 : 0;
    const next = THREE.MathUtils.damp(lightsLevel.current, target, 3, delta);
    lightsLevel.current = Math.abs(next - target) < 0.001 ? target : next;
    const rideTarget = riding ? 1 : 0;
    const ride = THREE.MathUtils.damp(rideLevel.current, rideTarget, riding ? 1.4 : 2.2, delta);
    rideLevel.current = Math.abs(ride - rideTarget) < 0.001 ? rideTarget : ride;

    // Frame-time clock, capped per frame: the first frames after loading can
    // stall for seconds compiling shaders, and a wall clock would skip the
    // whole build while the screen is frozen
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
    const introDark =
      introClock.current < 0
        ? 1
        : // Lights come up through the shape and texture sweeps
          1 - THREE.MathUtils.smoothstep(introClock.current, INTRO.shapeStart + 0.4, INTRO.textureEnd);
    darkLevel.current = Math.max(lightsLevel.current, introDark);
    const introGlow = introClock.current >= 0 && introClock.current < INTRO.end ? 1 : 0;
    garageGlow.current = garageLevel.current;
    if (bloom.current) {
      bloom.current.intensity = Math.max(lightsLevel.current * 1.4, introGlow * 1.2, garageGlow.current * 0.55);
      // The white showroom sits close to the default threshold and would haze
      // over the bike: in daylight only the LEDs (emissive 3+) may bloom
      bloom.current.luminanceMaterial.threshold = THREE.MathUtils.lerp(
        1.1,
        1.9,
        garageGlow.current * (1 - Math.max(lightsLevel.current, introGlow)),
      );
    }
    if (dof.current && bike) {
      dofTarget.set(0, bike.groundOffset + 0.5, 0);
      dof.current.target = dofTarget;
      // Riding scenery or the parked garage: soft behind the bike
      const dofGoal = worldShown ? 3 : garageShown ? 3.4 : 0;
      dofLevel.current = THREE.MathUtils.damp(dofLevel.current, dofGoal, dofGoal > dofLevel.current ? 2 : 10, delta);
      if (Math.abs(dofLevel.current - dofGoal) < 0.001) dofLevel.current = dofGoal;
      dof.current.bokehScale = dofLevel.current;
    }
  });

  return (
    <>
      {/* Scene off also drops the ground (floor, shadows): the bike floats */}
      <Studio
        darkLevel={darkLevel}
        lightsLevel={lightsLevel}
        apart={apart || !backdrop}
        intro={introRunning}
        worldLevel={worldLevel}
      />
      <ShowroomSound introClock={introClock} rideLevel={rideLevel} riding={riding} />
      {/* Only swaps the visitor asked for (ride / backdrop toggle), not explode */}
      <BackdropSweep trigger={`${worldShown}|${backdrop}`} />
      <Garage
        palette={theme.garage}
        screenTitle={screenTitle}
        screenLine={screenLine}
        show={garageShown}
        lightsLevel={lightsLevel}
        levelRef={garageLevel}
        worldLevel={worldLevel}
      />
      {bike && <HeadlightBeams bike={bike} lightsLevel={lightsLevel} assembled={!apart} />}
      {bike && <HologramIntro bike={bike} clock={introClock} />}
      {bike && (
        <RideEffects
          groundOffset={bike.groundOffset}
          world={worldShown}
          rideLevel={rideLevel}
          lightsLevel={lightsLevel}
          garageLevel={garageLevel}
          worldLevel={worldLevel}
        />
      )}
      <Suspense fallback={null}>
        {/* BVH-accelerated raycasting: ~300k triangles are hit-tested on every pointer move */}
        <Bvh firstHitOnly>
          <BikeModel
            exploded={exploded}
            lightsLevel={lightsLevel}
            rideLevel={rideLevel}
            selected={selected}
            onZoomExplode={onZoomExplode}
            onReady={handleReady}
            onHoverPart={onHoverPart}
            onClickPart={onClickPart}
          />
        </Bvh>
      </Suspense>

      {/* No input lock here: the page blocks pointer events on the canvas
          during the intro (toggling CameraControls' `enabled` back on left
          it dead) */}
      <CameraRig bike={bike} selected={selected} exploded={exploded} resetKey={resetKey} />

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
        <DepthOfField ref={dof} focusRange={3.2} bokehScale={0} />
        {/* Only HDR highlights (the lit lamps) cross the threshold */}
        <Bloom ref={bloom} mipmapBlur luminanceThreshold={1.1} luminanceSmoothing={0.2} intensity={0} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  );
}
