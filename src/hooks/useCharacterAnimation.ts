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

  useEffect(() => {
    if (!triggerOnView || !isInView || !isSpawnSequenceComplete) {
      hasTriggered.current = false;
      return;
    }

    // Prevent duplicate triggers
    if (hasTriggered.current) return;
    hasTriggered.current = true;

    // Play animation
    playCharacterAnimation(
      animation.name,
      animation.loop ?? true,
      animation.fadeTime ?? 0.5,
      animation.lookAtCamera ?? true
    );

    // Adjust camera if config provided
    if (camera) {
      adjustCamera({
        position: camera.position,
        lookAt: camera.lookAt,
        duration: camera.duration ?? 1500,
      });
    }

    // Reset trigger when leaving view
    return () => {
      hasTriggered.current = false;
    };
  }, [
    isInView,
    triggerOnView,
    isSpawnSequenceComplete,
    animation.name,
    animation.loop,
    animation.fadeTime,
    animation.lookAtCamera,
    camera,
    playCharacterAnimation,
    adjustCamera,
  ]);

  return { containerRef, isInView };
}
