"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html, useAnimations, useGLTF } from "@react-three/drei";
import { applySkin } from "@/lib/skinSwap";
import {
  Legend,
  LegendId,
  TRIAL_CAMERA,
  TRIAL_MODEL_HEIGHT,
} from "@/config/trial";

// Opacity of a legend while another one is focused
const DIMMED_OPACITY = 0.12;
// How long a spawning legend takes to fade in
const SPAWN_FADE_MS = 1400;

interface Fit {
  scale: number;
  offsetY: number;
}

// Measured once per rig, in its own space: GLB scenes are cached and shared
// with other pages, which may have left a transform on the root
const fits = new WeakMap<THREE.Object3D, Fit>();
const measureFit = (scene: THREE.Object3D): Fit => {
  let fit = fits.get(scene);
  if (!fit) {
    const saved = {
      position: scene.position.clone(),
      quaternion: scene.quaternion.clone(),
      scale: scene.scale.clone(),
    };
    const parent = scene.parent;
    scene.removeFromParent();
    scene.position.set(0, 0, 0);
    scene.rotation.set(0, 0, 0);
    scene.scale.set(1, 1, 1);
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const height = box.max.y - box.min.y || 1;
    const scale = TRIAL_MODEL_HEIGHT / height;
    fit = { scale, offsetY: -box.min.y * scale };
    fits.set(scene, fit);
    scene.position.copy(saved.position);
    scene.quaternion.copy(saved.quaternion);
    scene.scale.copy(saved.scale);
    parent?.add(scene);
  }
  return fit;
};

// Root transform this page renders the rig with (overrides other pages' props)
const IDENTITY_POSITION: [number, number, number] = [0, 0, 0];
const IDENTITY_ROTATION: [number, number, number] = [0, 0, 0];

/* ----------------------------- Animation ------------------------------ */

// Action setup lives outside the component: the React Compiler forbids
// mutating values returned from hooks (useAnimations' actions)
const crossFadeTo = (
  from: THREE.AnimationAction | null,
  to: THREE.AnimationAction,
  once: boolean,
  fade: number,
) => {
  to.reset();
  if (once) {
    to.setLoop(THREE.LoopOnce, 1);
    to.clampWhenFinished = true;
  } else {
    to.setLoop(THREE.LoopRepeat, Infinity);
  }
  to.play();
  if (from && from !== to) from.crossFadeTo(to, fade, false);
};

const startIdle = (idle: THREE.AnimationAction) => {
  crossFadeTo(null, idle, false, 0);
  // Offset per legend so they don't breathe in sync
  idle.time = Math.random() * idle.getClip().duration;
};

/* ------------------------------- Fading ------------------------------- */

interface MaterialState {
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
}
const originals = new WeakMap<THREE.Material, MaterialState>();

const forEachMaterial = (root: THREE.Object3D, fn: (m: THREE.Material) => void) =>
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(fn);
  });

// Below this a fading legend is too faint to cast a believable shadow
const SHADOW_MIN_FADE = 0.5;

const applyFade = (root: THREE.Object3D, fade: number, modeChanged: boolean) => {
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) child.castShadow = fade >= SHADOW_MIN_FADE;
  });
  forEachMaterial(root, (material) => {
    let o = originals.get(material);
    if (!o) {
      o = {
        opacity: material.opacity,
        transparent: material.transparent,
        depthWrite: material.depthWrite,
      };
      originals.set(material, o);
    }
    const opaque = fade >= 0.999;
    material.opacity = o.opacity * fade;
    if (modeChanged) {
      material.transparent = opaque ? o.transparent : true;
      // depthWrite stays as authored: turning it off lets a skinned mesh's
      // inner faces (armor, wings) show through and sort wrongly
      material.depthWrite = o.depthWrite;
      material.needsUpdate = true;
    }
  });
};

const prepareMeshes = (root: THREE.Object3D) =>
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // Skinned bounds follow the bind pose, not the animation
    mesh.frustumCulled = false;
  });

/* -------------------------------- Skins ------------------------------- */

// Suspense fallback while a skin downloads
function SkinLoading({ onLoading }: { onLoading: (loading: boolean) => void }) {
  useEffect(() => {
    onLoading(true);
    return () => onLoading(false);
  }, [onLoading]);
  return null;
}

function Skin({
  rig,
  modelPath,
  onApplied,
}: {
  rig: THREE.Object3D;
  modelPath: string;
  onApplied: (modelPath: string) => void;
}) {
  const { scene } = useGLTF(modelPath);
  useEffect(() => {
    applySkin(rig, scene);
    prepareMeshes(rig);
    onApplied(modelPath);
  }, [rig, scene, modelPath, onApplied]);
  return null;
}

/* ------------------------------ Character ----------------------------- */

interface TrialCharacterProps {
  legend: Legend;
  skinIndex: number;
  position: [number, number, number];
  // ms to wait before the spawn clip; null until the page has finished loading
  spawnDelay: number | null;
  // Bumped to replay the spawn clip
  spawnRound: number;
  isHovered: boolean;
  isFocused: boolean;
  isDimmed: boolean;
  interactive: boolean;
  showLabel: boolean;
  onHover: (id: LegendId | null) => void;
  onSelect: (id: LegendId) => void;
  onRegister: (id: LegendId, object: THREE.Object3D | null) => void;
  onSkinLoading: (id: LegendId, loading: boolean) => void;
}

export default function TrialCharacter({
  legend,
  skinIndex,
  position,
  spawnDelay,
  spawnRound,
  isHovered,
  isFocused,
  isDimmed,
  interactive,
  showLabel,
  onHover,
  onSelect,
  onRegister,
  onSkinLoading,
}: TrialCharacterProps) {
  // The first skin is the rig: its skeleton + clips drive every skin
  const { scene: rig, animations } = useGLTF(legend.skins[0]!.modelPath);
  const groupRef = useRef<THREE.Group>(null);
  const { actions, mixer } = useAnimations(animations, groupRef);
  const fit = useMemo(() => measureFit(rig), [rig]);
  const skin = legend.skins[skinIndex] ?? legend.skins[0]!;

  // Face the overview camera from this spot
  const rotationY = useMemo(() => {
    const [cx, , cz] = TRIAL_CAMERA.position;
    return Math.atan2(cx - position[0], cz - position[2]);
  }, [position]);

  useEffect(() => {
    onRegister(legend.id, rig);
    return () => onRegister(legend.id, null);
  }, [onRegister, legend.id, rig]);

  /* Animation: idle loop, with one-shot clips (focus, skin swap) on top */
  const currentRef = useRef<THREE.AnimationAction | null>(null);

  const play = useCallback(
    (clip: string | undefined, once: boolean) => {
      const action = clip ? actions[clip] : undefined;
      if (!action) return;
      // Already looping this clip: restarting it would pop
      if (!once && action === currentRef.current) return;
      crossFadeTo(currentRef.current, action, once, 0.35);
      currentRef.current = action;
    },
    [actions],
  );

  useEffect(() => {
    const idle = actions[legend.idleClip];
    if (!idle) return;
    startIdle(idle);
    currentRef.current = idle;

    // Any one-shot that finishes hands back to idle
    const onFinished = (event: { action: THREE.AnimationAction }) => {
      if (event.action !== currentRef.current) return;
      crossFadeTo(event.action, idle, false, 0.5);
      currentRef.current = idle;
    };
    mixer.addEventListener("finished", onFinished);
    return () => {
      mixer.removeEventListener("finished", onFinished);
      mixer.stopAllAction();
      currentRef.current = null;
    };
  }, [actions, mixer, legend.idleClip]);

  // Spawn once the loading overlay is gone (so the entrance is actually seen),
  // and again on every new spawn round (the tab becoming visible again): the
  // legend vanishes, then fades in while its spawn clip plays
  const spawnRef = useRef<{ state: "hidden" | "fading" | "done"; start: number }>({
    state: "hidden",
    start: 0,
  });
  useEffect(() => {
    if (spawnDelay === null) return;
    spawnRef.current = { state: "hidden", start: 0 };
    const id = setTimeout(() => {
      spawnRef.current = { state: "fading", start: performance.now() };
      play(legend.spawnClip, true);
    }, spawnDelay);
    return () => clearTimeout(id);
  }, [spawnDelay, spawnRound, play, legend.spawnClip]);

  const wasFocused = useRef(false);
  useEffect(() => {
    if (isFocused) play(legend.focusClip, true);
    else if (wasFocused.current) play(legend.idleClip, false);
    wasFocused.current = isFocused;
  }, [isFocused, play, legend.focusClip, legend.idleClip]);

  // Skin swaps play the skin's transform clip — but not the initial apply
  const appliedRef = useRef<string | null>(null);
  const handleApplied = useCallback(
    (modelPath: string) => {
      const previous = appliedRef.current;
      appliedRef.current = modelPath;
      if (previous === null || previous === modelPath) return;
      const swap = legend.skins.find((s) => s.modelPath === modelPath)?.swapClip;
      play(swap, true);
    },
    [legend.skins, play],
  );
  const handleSkinLoading = useCallback(
    (loading: boolean) => onSkinLoading(legend.id, loading),
    [onSkinLoading, legend.id],
  );

  /* Opacity = spawn fade-in combined with the dim while another legend is
     focused. Coming back (Back / Esc) snaps straight to the authored materials
     instead of fading in through the transparent state — the depth-of-field
     blur is clearing at the same time, so the snap isn't visible */
  const fadeRef = useRef(1);
  useFrame((_, delta) => {
    const spawn = spawnRef.current;
    if (groupRef.current) groupRef.current.visible = spawn.state !== "hidden";
    if (spawn.state === "hidden") return;

    let spawnFade = 1;
    if (spawn.state === "fading") {
      const t = (performance.now() - spawn.start) / SPAWN_FADE_MS;
      if (t >= 1) spawn.state = "done";
      else spawnFade = 1 - (1 - t) ** 3;
    }

    const prev = fadeRef.current;
    let fade = spawnFade;
    if (isDimmed) {
      const next = THREE.MathUtils.damp(prev, DIMMED_OPACITY, 5, delta);
      fade = Math.min(spawnFade, Math.abs(next - DIMMED_OPACITY) < 0.002 ? DIMMED_OPACITY : next);
    }
    if (fade === prev) return;
    fadeRef.current = fade;
    applyFade(rig, fade, prev >= 0.999 !== fade >= 0.999);
  });
  // The rig is cached with the GLB: leave it fully opaque for other pages
  useEffect(() => () => applyFade(rig, 1, true), [rig]);

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (interactive && spawnRef.current.state !== "hidden") onHover(legend.id);
  };
  const handleOut = () => onHover(null);
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (interactive && spawnRef.current.state !== "hidden") onSelect(legend.id);
  };

  return (
    <group position={position} rotation-y={rotationY}>
      <group ref={groupRef} position-y={fit.offsetY} scale={fit.scale}>
        <primitive
          object={rig}
          dispose={null}
          position={IDENTITY_POSITION}
          rotation={IDENTITY_ROTATION}
          scale={1}
        />
      </group>

      {/* Own boundary so a downloading skin never hides the current one */}
      <Suspense fallback={<SkinLoading onLoading={handleSkinLoading} />}>
        <Skin rig={rig} modelPath={skin.modelPath} onApplied={handleApplied} />
      </Suspense>

      {/* Invisible hit capsule: raycasting the skinned meshes per pointer move is
          far too expensive, and the capsule has no gaps to flicker through */}
      <mesh
        position-y={TRIAL_MODEL_HEIGHT / 2}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={handleClick}
      >
        <cylinderGeometry args={[0.42, 0.42, TRIAL_MODEL_HEIGHT, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>

      {/* Always mounted, hidden with CSS: unmounting drei's Html during a
          render tears down its React root mid-render (React warns about it) */}
      <Html
        position-y={TRIAL_MODEL_HEIGHT + 0.3}
        center
        zIndexRange={[10, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div
          className={`trial-label text-center whitespace-nowrap transition-[transform,opacity] duration-200 ${
            isHovered ? "scale-110" : ""
          } ${showLabel ? "opacity-100" : "opacity-0"}`}
        >
          <div className="font-lol text-base sm:text-lg font-bold trial-gold-text">
            {legend.name}
          </div>
          <div className="text-xs sm:text-sm text-white/90 trial-shadow-text">
            {skin.label}
          </div>
        </div>
      </Html>
    </group>
  );
}
