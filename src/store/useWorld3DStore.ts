import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface CameraOptions {
  position?: { x: number; y: number; z: number };
  lookAt?: { x: number; y: number; z: number };
  duration?: number;
  easing?: (amount: number) => number;
  onComplete?: () => void;
}

interface World3DState {
  // State
  isSpawnSequenceComplete: boolean;
  
  // Actions
  playCharacterAnimation: (
    animationName: string,
    loop?: boolean,
    fadeTime?: number,
    lookAtCamera?: boolean
  ) => boolean;
  adjustCamera: (options: CameraOptions) => void;
  setSpawnSequenceComplete: (isComplete: boolean) => void;
  
  // Setters for the actual implementation functions
  setPlayCharacterAnimation: (
    fn: (
      animationName: string,
      loop?: boolean,
      fadeTime?: number,
      lookAtCamera?: boolean
    ) => boolean
  ) => void;
  setAdjustCamera: (fn: (options: CameraOptions) => void) => void;
}

export const useWorld3DStore = create<World3DState>()(
  devtools(
    (set, _get) => ({
      // Initial state
      isSpawnSequenceComplete: false,
      
      // Default implementations (no-ops until set by World3DCanvas)
      playCharacterAnimation: () => {
        console.warn('playCharacterAnimation not initialized yet');
        return false;
      },
      adjustCamera: () => {
        console.warn('adjustCamera not initialized yet');
      },
      
      // Actions
      setSpawnSequenceComplete: (isComplete: boolean) =>
        set({ isSpawnSequenceComplete: isComplete }, false, 'setSpawnSequenceComplete'),
      
      setPlayCharacterAnimation: (fn) =>
        set({ playCharacterAnimation: fn }, false, 'setPlayCharacterAnimation'),
      
      setAdjustCamera: (fn) =>
        set({ adjustCamera: fn }, false, 'setAdjustCamera'),
    }),
    { name: 'World3DStore' }
  )
);
