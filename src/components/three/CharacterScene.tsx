"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useAnimations } from "@react-three/drei";
import { useWorld3DStore } from "@/store/useWorld3DStore";

/** One step of the intro sequence played before the character settles into idle */
export interface SpawnStep {
  clip: string;
  loop?: boolean;
  timeScale?: number;
  fadeIn?: number; // seconds
  fadeOut?: number; // seconds, applied when the next step takes over
  // Move on after this many ms; omitted = wait for the clip's 'finished' event
  advanceAfterMs?: number;
  // Extra ms to hold the last pose after 'finished' before moving on
  holdMs?: number;
}

export interface CharacterConfig {
  // Lowercased names accepted by playCharacterAnimation -> clip name
  aliases: Record<string, string>;
  idleClip: string;
  spawn: SpawnStep[];
  idleFadeIn?: number;
  headBoneName?: string; // exact bone name; otherwise the first bone containing "head"
  scale?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  // Add a subtle emissive to lit materials (helps the FBX bot)
  addEmissive?: boolean;
}

// Easing functions (TWEEN-compatible signatures: t in [0,1] -> [0,1])
const easeOutQuad = (t: number) => t * (2 - t);
const easeInOutQuad = (t: number) =>
  t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

interface CameraAnimation {
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromLook: THREE.Vector3;
  toLook: THREE.Vector3;
  elapsed: number; // seconds
  duration: number; // seconds
  easing: (t: number) => number;
  onComplete?: () => void;
}

export interface CharacterSceneCallbacks {
  onReady?: () => void;
  onCameraAnimationComplete?: () => void;
  onSpawnSequenceComplete?: () => void;
}

interface CharacterSceneProps extends CharacterSceneCallbacks {
  model: THREE.Object3D;
  clips: THREE.AnimationClip[];
  config: CharacterConfig;
}

export default function CharacterScene({
  model,
  clips,
  config,
  onReady,
  onCameraAnimationComplete,
  onSpawnSequenceComplete,
}: CharacterSceneProps) {
  const camera = useThree((state) => state.camera);

  const groupRef = useRef<THREE.Group>(null);
  const { actions, mixer } = useAnimations(clips, groupRef);

  // Spotlight target (must be part of the scene graph)
  const spotTarget = useMemo(() => {
    const target = new THREE.Object3D();
    target.position.set(0, 1, 0);
    return target;
  }, []);

  // Store actions
  const setPlayCharacterAnimation = useWorld3DStore(
    (s) => s.setPlayCharacterAnimation,
  );
  const setAdjustCamera = useWorld3DStore((s) => s.setAdjustCamera);
  const setSpawnSequenceComplete = useWorld3DStore(
    (s) => s.setSpawnSequenceComplete,
  );

  // Keep latest callbacks without retriggering effects
  const onCameraAnimationCompleteRef = useRef(onCameraAnimationComplete);
  const onSpawnSequenceCompleteRef = useRef(onSpawnSequenceComplete);
  useEffect(() => {
    onCameraAnimationCompleteRef.current = onCameraAnimationComplete;
    onSpawnSequenceCompleteRef.current = onSpawnSequenceComplete;
  });

  // Mutable state (never triggers re-render)
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const headTrackingRef = useRef(false);
  const headBoneRef = useRef<THREE.Bone | null>(null);
  const cameraAnimRef = useRef<CameraAnimation | null>(null);
  const mousePositionRef = useRef(new THREE.Vector2(0, 0));
  const isMouseInWindowRef = useRef(true);

  // Reusable temporaries (avoid per-frame allocations)
  const temps = useMemo(
    () => ({
      lookAt: new THREE.Vector3(),
      headWorldPos: new THREE.Vector3(),
      lookAtTarget: new THREE.Vector3(),
      defaultLookAtTarget: new THREE.Vector3(0, 2.2, 2),
      raycaster: new THREE.Raycaster(),
      planeNormal: new THREE.Vector3(),
      plane: new THREE.Plane(),
      intersectPoint: new THREE.Vector3(),
      lookAtHelper: new THREE.Object3D(),
      parentWorldQuat: new THREE.Quaternion(),
      targetWorldQuat: new THREE.Quaternion(),
    }),
    [],
  );

  const { aliases, idleClip, spawn, idleFadeIn = 0.5, headBoneName, addEmissive } =
    config;

  // One-time model setup: shadows, FBX material fixes, head bone lookup
  useEffect(() => {
    headBoneRef.current = null;
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (!addEmissive) return;
        const mesh = child as THREE.Mesh;
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        materials.forEach((mat) => {
          if (
            mat instanceof THREE.MeshStandardMaterial ||
            mat instanceof THREE.MeshPhongMaterial
          ) {
            // Subtle emission for definition without washing out
            mat.emissive = new THREE.Color(0x202020);
            mat.emissiveIntensity = 0.15;
            mat.needsUpdate = true;
          }
        });
      }
      if (child instanceof THREE.Bone && !headBoneRef.current) {
        const boneName = child.name.toLowerCase();
        const isHead = headBoneName
          ? child.name === headBoneName
          : boneName.includes("head") && !boneName.includes("top");
        if (isHead) headBoneRef.current = child;
      }
    });
    if (!headBoneRef.current) {
      console.warn("Head bone not found in character model");
    }
  }, [model, headBoneName, addEmissive]);

  // Start a camera position/look-at animation (processed in useFrame)
  const startCameraAnimation = useCallback(
    (options: {
      position?: { x: number; y: number; z: number };
      lookAt?: { x: number; y: number; z: number };
      duration?: number; // milliseconds (public API kept from World3D)
      easing?: (t: number) => number;
      onComplete?: () => void;
    }) => {
      const { position, lookAt, duration = 1000, easing, onComplete } = options;

      const fromPos = camera.position.clone();
      const toPos = position
        ? new THREE.Vector3(position.x, position.y, position.z)
        : fromPos.clone();

      // Current look-at point: one unit along the view direction
      const fromLook = new THREE.Vector3();
      camera.getWorldDirection(fromLook);
      fromLook.add(camera.position);
      const toLook = lookAt
        ? new THREE.Vector3(lookAt.x, lookAt.y, lookAt.z)
        : fromLook.clone();

      cameraAnimRef.current = {
        fromPos,
        toPos,
        fromLook,
        toLook,
        elapsed: 0,
        duration: Math.max(duration, 1) / 1000,
        easing: easing ?? easeInOutQuad,
        onComplete,
      };
    },
    [camera],
  );

  // Public API: play a named character animation with cross-fade
  const playAnimation = useCallback(
    (
      animationName: string,
      loop: boolean = true,
      fadeTime: number = 0.3,
      lookAtCamera: boolean = false,
    ): boolean => {
      // Accept an alias or an exact clip name
      const key =
        aliases[animationName.toLowerCase()] ??
        (actions[animationName] ? animationName : undefined);
      if (!key) {
        console.warn(`Animation '${animationName}' not found`);
        return false;
      }
      const targetAction = actions[key];
      if (!targetAction) {
        console.warn(`Animation '${animationName}' is not loaded`);
        return false;
      }

      // Already playing this animation — don't restart
      if (
        currentActionRef.current === targetAction &&
        targetAction.isRunning()
      ) {
        return true;
      }

      if (
        currentActionRef.current &&
        currentActionRef.current !== targetAction
      ) {
        currentActionRef.current.fadeOut(fadeTime);
      }

      if (loop) {
        targetAction.setLoop(THREE.LoopRepeat, Infinity);
      } else {
        targetAction.setLoop(THREE.LoopOnce, 1);
        targetAction.clampWhenFinished = true;
      }

      targetAction.reset();
      targetAction.fadeIn(fadeTime);
      targetAction.play();
      currentActionRef.current = targetAction;
      headTrackingRef.current = lookAtCamera;

      // One-shot animations return to idle after finishing
      if (!loop && key !== idleClip) {
        const onFinished = (event: { action: THREE.AnimationAction }) => {
          if (event.action !== targetAction) return;
          mixer.removeEventListener("finished", onFinished);
          // Only return to idle if nothing else took over in the meantime
          if (currentActionRef.current === targetAction) {
            playAnimation(idleClip, true, fadeTime, lookAtCamera);
          }
        };
        mixer.addEventListener("finished", onFinished);
      }

      return true;
    },
    [actions, mixer, aliases, idleClip],
  );

  // Public API: adjust camera (blocked until spawn sequence completes)
  const adjustCamera = useCallback(
    (options: {
      position?: { x: number; y: number; z: number };
      lookAt?: { x: number; y: number; z: number };
      duration?: number;
      easing?: (t: number) => number;
      onComplete?: () => void;
    }) => {
      if (!useWorld3DStore.getState().isSpawnSequenceComplete) {
        return;
      }
      startCameraAnimation(options);
    },
    [startCameraAnimation],
  );

  // Register the public API with the store
  useEffect(() => {
    setPlayCharacterAnimation(playAnimation);
    setAdjustCamera(adjustCamera);
    return () => {
      setPlayCharacterAnimation(() => false);
      setAdjustCamera(() => {});
      setSpawnSequenceComplete(false);
    };
  }, [
    playAnimation,
    adjustCamera,
    setPlayCharacterAnimation,
    setAdjustCamera,
    setSpawnSequenceComplete,
  ]);

  // Track mouse for head look-at
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!headTrackingRef.current) return;
      isMouseInWindowRef.current =
        event.clientX >= 0 &&
        event.clientX <= window.innerWidth &&
        event.clientY >= 0 &&
        event.clientY <= window.innerHeight;
      mousePositionRef.current.set(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1,
      );
    };
    const handleMouseLeave = () => {
      isMouseInWindowRef.current = false;
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  // Spawn sequence: play config.spawn steps in order, then settle into idle,
  // plus the initial camera zoom-in.
  useEffect(() => {
    const idle = actions[idleClip];

    const timeouts = new Set<ReturnType<typeof setTimeout>>();
    const schedule = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        timeouts.delete(id);
        fn();
      }, ms);
      timeouts.add(id);
    };
    const finishedListeners: Array<
      (event: { action: THREE.AnimationAction }) => void
    > = [];

    const finishSpawn = () => {
      setSpawnSequenceComplete(true);
      onSpawnSequenceCompleteRef.current?.();
    };

    // Fade out the step being left and restore its playback speed
    let previous: { action: THREE.AnimationAction; step: SpawnStep } | null =
      null;
    const leavePrevious = () => {
      if (!previous) return;
      previous.action.fadeOut(previous.step.fadeOut ?? 0.3);
      if (previous.step.timeScale) previous.action.setEffectiveTimeScale(1);
      previous = null;
    };

    const playIdleAfterSequence = () => {
      leavePrevious();
      if (idle) {
        idle.setLoop(THREE.LoopRepeat, Infinity);
        idle.reset();
        idle.fadeIn(idleFadeIn);
        idle.play();
        currentActionRef.current = idle;
      }
      finishSpawn();
    };

    const playStep = (index: number) => {
      const step = spawn[index];
      if (!step) {
        playIdleAfterSequence();
        return;
      }
      const action = actions[step.clip];
      if (!action) {
        console.warn(`Spawn animation '${step.clip}' not available, skipping`);
        playStep(index + 1);
        return;
      }

      leavePrevious();
      if (step.loop) {
        action.setLoop(THREE.LoopRepeat, Infinity);
      } else {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      action.reset();
      if (step.timeScale) action.setEffectiveTimeScale(step.timeScale);
      action.fadeIn(step.fadeIn ?? 0.3);
      action.play();
      currentActionRef.current = action;
      previous = { action, step };

      const next = () => playStep(index + 1);
      if (step.advanceAfterMs !== undefined) {
        schedule(next, step.advanceAfterMs);
        return;
      }
      const onFinished = (event: { action: THREE.AnimationAction }) => {
        if (event.action !== action) return;
        mixer.removeEventListener("finished", onFinished);
        if (step.holdMs) schedule(next, step.holdMs);
        else next();
      };
      finishedListeners.push(onFinished);
      mixer.addEventListener("finished", onFinished);
    };

    // Kick off the animation sequence
    playStep(0);

    // Initial camera zoom-in
    camera.position.set(0, -10, 1);
    camera.lookAt(0, 2, 0);
    schedule(() => {
      startCameraAnimation({
        position: { x: 0, y: 1.25, z: 1 },
        lookAt: { x: 0.5, y: 1.5, z: 0 },
        duration: 1500,
        easing: easeOutQuad,
        onComplete: () => onCameraAnimationCompleteRef.current?.(),
      });
    }, 100);

    // Signal that the scene is mounted and animating (loading overlay can fade)
    onReady?.();

    return () => {
      timeouts.forEach(clearTimeout);
      finishedListeners.forEach((listener) =>
        mixer.removeEventListener("finished", listener),
      );
      cameraAnimRef.current = null;
      mixer.stopAllAction();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    actions,
    mixer,
    camera,
    startCameraAnimation,
    setSpawnSequenceComplete,
    spawn,
    idleClip,
    idleFadeIn,
  ]);

  // Make the character's head look at the mouse cursor (or default target)
  const updateHeadLookAt = () => {
    const headBone = headBoneRef.current;
    if (!headBone || !headBone.parent) return;

    headBone.getWorldPosition(temps.headWorldPos);

    if (!isMouseInWindowRef.current) {
      temps.lookAtTarget.copy(temps.defaultLookAtTarget);
    } else {
      temps.raycaster.setFromCamera(mousePositionRef.current, camera);
      temps.planeNormal
        .subVectors(camera.position, temps.headWorldPos)
        .normalize();
      temps.plane.setFromNormalAndCoplanarPoint(
        temps.planeNormal,
        temps.headWorldPos,
      );
      // intersectPlane returns null when the ray misses the plane
      const hit = temps.raycaster.ray.intersectPlane(
        temps.plane,
        temps.intersectPoint,
      );
      if (hit) {
        temps.lookAtTarget.copy(temps.intersectPoint);
      } else {
        temps.lookAtTarget.copy(temps.defaultLookAtTarget);
      }
    }

    headBone.parent.getWorldQuaternion(temps.parentWorldQuat);
    temps.lookAtHelper.position.copy(temps.headWorldPos);
    temps.lookAtHelper.lookAt(temps.lookAtTarget);
    temps.targetWorldQuat.copy(temps.lookAtHelper.quaternion);
    // Convert world quaternion to the bone's local space
    temps.parentWorldQuat.invert();
    temps.parentWorldQuat.multiply(temps.targetWorldQuat);
    headBone.quaternion.slerp(temps.parentWorldQuat, 0.05);
    headBone.updateMatrix();
  };

  useFrame((_, delta) => {
    // Drive camera animation
    const anim = cameraAnimRef.current;
    if (anim) {
      anim.elapsed += delta;
      const t = Math.min(anim.elapsed / anim.duration, 1);
      const eased = anim.easing(t);
      camera.position.lerpVectors(anim.fromPos, anim.toPos, eased);
      temps.lookAt.lerpVectors(anim.fromLook, anim.toLook, eased);
      camera.lookAt(temps.lookAt);
      if (t >= 1) {
        cameraAnimRef.current = null;
        anim.onComplete?.();
      }
    }

    // Head look-at runs AFTER the mixer update (drei updates the mixer
    // before user useFrame callbacks) so it can override the head pose
    if (headTrackingRef.current) {
      updateHeadLookAt();
    }
  });

  return (
    <>
      {/* Balanced ambient light for natural visibility */}
      <ambientLight intensity={1.8} />

      {/* Strong directional light for definition and depth */}
      <directionalLight
        position={[50, 50, 50]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-camera-near={0.1}
        shadow-camera-far={200}
      />

      {/* Moderate spotlight for character accent without washing out */}
      <spotLight
        position={[0, 6, 3]}
        intensity={5}
        angle={Math.PI / 3}
        penumbra={0.95}
        decay={2}
        distance={20}
        target={spotTarget}
      />
      <primitive object={spotTarget} />

      {/* Subtle rim light for depth without overpowering */}
      <pointLight color={0xaabbff} intensity={4} distance={12} position={[0, 2, -2]} />

      {/* Character (dispose={null}: the model is cached by the loader) */}
      <group ref={groupRef}>
        <primitive
          object={model}
          dispose={null}
          scale={config.scale ?? 1}
          position={config.position ?? [0, 0, 0]}
          rotation={config.rotation ?? [0, 0, 0]}
        />
      </group>
    </>
  );
}
