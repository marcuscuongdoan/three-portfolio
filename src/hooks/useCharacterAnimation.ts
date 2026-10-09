import { useEffect, useRef } from 'react';
import { useWorld3DStore } from '@/store/useWorld3DStore';
import { useInView } from 'framer-motion';

interface AnimationConfig {
  name: string;
  loop?: boolean;
  fadeTime?: number;
  lookAtCamera?: boolean;
}

interface CameraConfig {
  position?: { x: number; y: number; z: number };
  lookAt?: { x: number; y: number; z: number };
  duration?: number;
}

interface UseCharacterAnimationOptions {
  animation: AnimationConfig;
  camera?: CameraConfig;
  triggerOnView?: boolean;
  viewAmount?: number;
}

/**
 * Custom hook to handle character animations with camera adjustments
 * Simplifies animation logic across different sections
 */
export function useCharacterAnimation({
  animation,
  camera,
  triggerOnView = true,
  viewAmount = 0.3,
}: UseCharacterAnimationOptions) {
  const { playCharacterAnimation, adjustCamera, isSpawnSequenceComplete } = useWorld3DStore();
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: false, amount: viewAmount });
  const hasTriggered = useRef(false);

  // Keep latest configs in refs — callers pass fresh object literals every
  // render, so putting them in the effect deps would retrigger the animation
  // (and camera tween) on every parent re-render while the section is in view
  const animationRef = useRef(animation);
  const cameraRef = useRef(camera);
  useEffect(() => {
    animationRef.current = animation;
    cameraRef.current = camera;
  });

  useEffect(() => {
    if (!triggerOnView || !isInView || !isSpawnSequenceComplete) {
      // Only reset when actually out of view / not ready, so the animation
      // re-triggers on the next scroll into view — not on every re-render
      hasTriggered.current = false;
      return;
    }

    // Prevent duplicate triggers
    if (hasTriggered.current) return;
    hasTriggered.current = true;

    const anim = animationRef.current;
    playCharacterAnimation(
      anim.name,
      anim.loop ?? true,
      anim.fadeTime ?? 0.5,
      anim.lookAtCamera ?? true
    );

    // Adjust camera if config provided
    const cam = cameraRef.current;
    if (cam) {
      adjustCamera({
        position: cam.position,
        lookAt: cam.lookAt,
        duration: cam.duration ?? 1500,
      });
    }
  }, [
    isInView,
    triggerOnView,
    isSpawnSequenceComplete,
    playCharacterAnimation,
    adjustCamera,
  ]);

  return { containerRef, isInView };
}
