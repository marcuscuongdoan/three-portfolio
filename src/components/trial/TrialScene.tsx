"use client";

import { Suspense, useCallback, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import {
  DepthOfField,
  EffectComposer,
  Outline,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { DepthOfFieldEffect, ToneMappingMode } from "postprocessing";
import CampEnvironment from "@/components/trial/CampEnvironment";
import TrialCharacter from "@/components/trial/TrialCharacter";
import TrialEmptySlot from "@/components/trial/TrialEmptySlot";
import IntroClouds from "@/components/trial/IntroClouds";
import {
  introEase,
  LEGENDS,
  LegendId,
  TimeOfDay,
  TRIAL_CAMERA,
  TRIAL_CAMPFIRE_POSITION,
  TRIAL_INTRO,
  TRIAL_MOBILE,
  TRIAL_MODEL_HEIGHT,
  TRIAL_SLOTS,
  TRIAL_SPAWN_STAGGER,
} from "@/config/trial";

const EMPTY_SELECTION: THREE.Object3D[] = [];

// OutlineEffect outlines meshes, not groups — flatten a model to its meshes
const collectMeshes = (root: THREE.Object3D) => {
  const meshes: THREE.Object3D[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o);
  });
  return meshes;
};

const UP = new THREE.Vector3(0, 1, 0);

// Camera pose for a focused legend: in front of it, on the line toward the
// overview camera.
// - Side panel (sm and up): pan the camera right so the legend sits on the
//   left and the content panel gets the right side.
// - Stacked (mobile): back off until the legend fits the strip between the
//   header and the bottom panel, then lens-shift the view (setViewOffset) so
//   it sits in that strip — panning the camera instead would sink it below
//   the ground.
const focusPose = (position: [number, number, number], width: number, height: number) => {
  const aspect = width / height;
  const stacked = width < TRIAL_MOBILE.breakpoint;
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(TRIAL_CAMERA.fov / 2));
  const p = new THREE.Vector3(...position);
  const [cx, , cz] = TRIAL_CAMERA.position;
  const dir = new THREE.Vector3(cx - p.x, 0, cz - p.z).normalize();

  if (stacked) {
    const top = TRIAL_MOBILE.headerPx;
    const bottom = height * (1 - TRIAL_MOBILE.panelFraction);
    const strip = Math.max(bottom - top, 1);
    const distance =
      ((TRIAL_MODEL_HEIGHT / TRIAL_MOBILE.modelFill) * height) / (strip * 2 * tanHalf);
    return {
      // Raised a little so the line of sight clears the campfire
      position: p.clone().addScaledVector(dir, distance).setY(1.5),
      lookAt: p.clone().setY(TRIAL_MODEL_HEIGHT / 2),
      focus: p.clone().setY(1.2),
      viewOffsetY: height / 2 - (top + bottom) / 2,
    };
  }

  const distance = TRIAL_CAMERA.focusDistance;
  // World units that move the legend to `focusScreenX` (NDC) at its distance
  const pan = -TRIAL_CAMERA.focusScreenX * distance * tanHalf * aspect;
  // Camera's right vector: it looks along -dir
  const right = new THREE.Vector3().crossVectors(dir, UP).negate();
  return {
    position: p.clone().addScaledVector(dir, distance).addScaledVector(right, pan).setY(1.35),
    lookAt: p.clone().addScaledVector(right, pan).setY(0.95),
    focus: p.clone().setY(1.2),
    viewOffsetY: 0,
  };
};

function CameraRig({
  focusedPosition,
  dofRef,
  introStartRef,
}: {
  focusedPosition: [number, number, number] | null;
  dofRef: React.RefObject<DepthOfFieldEffect | null>;
  // performance.now() when the intro began; null while still loading
  introStartRef: React.RefObject<number | null>;
}) {
  const size = useThree((s) => s.size);
  const portrait = size.width < size.height;

  const target = useMemo(() => {
    if (focusedPosition) return focusPose(focusedPosition, size.width, size.height);
    return {
      position: new THREE.Vector3(
        ...(portrait ? TRIAL_CAMERA.portraitPosition : TRIAL_CAMERA.position),
      ),
      lookAt: new THREE.Vector3(
        ...(portrait ? TRIAL_CAMERA.portraitLookAt : TRIAL_CAMERA.lookAt),
      ),
      focus: new THREE.Vector3(...TRIAL_CAMPFIRE_POSITION),
      viewOffsetY: 0,
    };
  }, [focusedPosition, size.width, size.height, portrait]);

  const intro = useMemo(
    () => ({
      position: new THREE.Vector3(
        ...(portrait ? TRIAL_INTRO.portraitStartPosition : TRIAL_INTRO.startPosition),
      ),
      lookAt: new THREE.Vector3(...TRIAL_INTRO.startLookAt),
    }),
    [portrait],
  );

  const viewOffset = useRef(0);
  const look = useRef(new THREE.Vector3(...TRIAL_INTRO.startLookAt));
  const desired = useRef(new THREE.Vector3());
  const focusPoint = useRef(new THREE.Vector3(...TRIAL_CAMPFIRE_POSITION));

  useFrame(({ camera, pointer, size: viewport, events }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);

    // Intro: parked high above the camp while loading (under the overlay),
    // then a scripted dive down to the overview
    const introStart = introStartRef.current;
    const introT =
      introStart === null ? 0 : (performance.now() - introStart) / TRIAL_INTRO.durationMs;
    if (introT < 1) {
      const flown = introEase(Math.max(introT, 0));
      camera.position.lerpVectors(intro.position, target.position, flown);
      look.current.lerpVectors(intro.lookAt, target.lookAt, flown);
      camera.lookAt(look.current);
      return;
    }

    const d = desired.current.copy(target.position);
    // Gentle parallax while browsing the camp
    if (!focusedPosition) {
      d.x += pointer.x * 0.35;
      d.y += pointer.y * 0.15;
    }
    const lambda = 3.2;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, d.x, lambda, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, d.y, lambda, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, d.z, lambda, delta);
    look.current.x = THREE.MathUtils.damp(look.current.x, target.lookAt.x, lambda, delta);
    look.current.y = THREE.MathUtils.damp(look.current.y, target.lookAt.y, lambda, delta);
    look.current.z = THREE.MathUtils.damp(look.current.z, target.lookAt.z, lambda, delta);
    camera.lookAt(look.current);

    // R3F only raycasts on pointer events; while the camera glides back, re-test
    // the last pointer so a legend sliding under (or away from) it updates hover
    if (!focusedPosition && camera.position.distanceToSquared(d) > 1e-4) {
      events.update?.();
    }

    // Lens shift for the stacked mobile layout
    const cam = camera as THREE.PerspectiveCamera;
    viewOffset.current = THREE.MathUtils.damp(viewOffset.current, target.viewOffsetY, lambda, delta);
    if (Math.abs(viewOffset.current) > 0.5) {
      const { width, height } = viewport;
      cam.setViewOffset(width, height, 0, viewOffset.current, width, height);
    } else if (cam.view?.enabled) {
      viewOffset.current = 0;
      cam.clearViewOffset();
    }

    // Blur everything but the focused legend
    const dof = dofRef.current;
    if (dof) {
      focusPoint.current.lerp(target.focus, 1 - Math.exp(-lambda * delta));
      dof.target = focusPoint.current;
      dof.bokehScale = THREE.MathUtils.damp(
        dof.bokehScale,
        focusedPosition ? 6 : 0,
        lambda,
        delta,
      );
    }
  });

  return null;
}

interface TrialSceneProps {
  hoveredId: LegendId | null;
  focusedId: LegendId | null;
  skins: Record<LegendId, number>;
  timeOfDay: TimeOfDay;
  // True once the first load is done; legends then play their spawn clip
  ready: boolean;
  // True once the intro camera has landed; labels show from then on
  introDone: boolean;
  // Bumped to make every legend spawn again
  spawnRound: number;
  onHover: (id: LegendId | null) => void;
  onSelect: (id: LegendId) => void;
  onSkinLoading: (id: LegendId, loading: boolean) => void;
}

export default function TrialScene({
  hoveredId,
  focusedId,
  skins,
  timeOfDay,
  ready,
  introDone,
  spawnRound,
  onHover,
  onSelect,
  onSkinLoading,
}: TrialSceneProps) {
  const [objects, setObjects] = useState<Partial<Record<LegendId, THREE.Object3D>>>({});
  const handleRegister = useCallback((id: LegendId, object: THREE.Object3D | null) => {
    setObjects((prev) => {
      if ((prev[id] ?? null) === object) return prev;
      const next = { ...prev };
      if (object) next[id] = object;
      else delete next[id];
      return next;
    });
  }, []);

  const dofRef = useRef<DepthOfFieldEffect>(null);

  // The intro starts on the first frame after loading finishes
  const introStartRef = useRef<number | null>(null);
  useFrame(() => {
    if (ready && introStartRef.current === null) introStartRef.current = performance.now();
  });
  const portrait = useThree((s) => s.size.width < s.size.height);
  const focusedPosition =
    TRIAL_SLOTS.find((s) => s.legend && s.legend === focusedId)?.position ?? null;

  const hoveredObject = !focusedId && hoveredId ? objects[hoveredId] : undefined;
  const hoverSelection = useMemo(
    () => (hoveredObject ? collectMeshes(hoveredObject) : EMPTY_SELECTION),
    [hoveredObject],
  );

  return (
    <>
      <CampEnvironment timeOfDay={timeOfDay} />
      <IntroClouds introStartRef={introStartRef} portrait={portrait} timeOfDay={timeOfDay} />

      {TRIAL_SLOTS.map((slot, index) => {
        if (!slot.legend) {
          return (
            <TrialEmptySlot
              key={slot.key}
              position={slot.position}
              showLabel={!focusedId && introDone}
              dimmed={!!focusedId}
            />
          );
        }
        const legend = LEGENDS[slot.legend];
        return (
          // One boundary per legend so each pops in as soon as its GLB is ready
          <Suspense key={slot.key} fallback={null}>
            <TrialCharacter
              legend={legend}
              skinIndex={skins[legend.id]}
              position={slot.position}
              spawnDelay={
                // First round waits for the intro camera to arrive
                ready
                  ? (spawnRound === 0 ? TRIAL_INTRO.spawnDelayMs : 0) + index * TRIAL_SPAWN_STAGGER
                  : null
              }
              spawnRound={spawnRound}
              isHovered={hoveredId === legend.id && !focusedId}
              isFocused={focusedId === legend.id}
              isDimmed={!!focusedId && focusedId !== legend.id}
              interactive={!focusedId}
              showLabel={!focusedId && introDone}
              onHover={onHover}
              onSelect={onSelect}
              onRegister={handleRegister}
              onSkinLoading={onSkinLoading}
            />
          </Suspense>
        );
      })}

      <CameraRig focusedPosition={focusedPosition} dofRef={dofRef} introStartRef={introStartRef} />

      {/* The composer disables the renderer's tone mapping, so ACES is re-added.
          autoClear={false} is required for Outline, otherwise its mask comes out blank. */}
      <EffectComposer autoClear={false} multisampling={4}>
        <DepthOfField ref={dofRef} focusRange={2.5} bokehScale={0} />
        <Outline
          selection={hoverSelection}
          visibleEdgeColor={0xffd27a}
          hiddenEdgeColor={0xffd27a}
          edgeStrength={7}
          pulseSpeed={0.35}
          blur
        />
        <Vignette offset={0.25} darkness={timeOfDay === "day" ? 0.4 : 0.6} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  );
}
