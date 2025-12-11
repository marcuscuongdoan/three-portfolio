'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { World3D } from '@/lib/three-world/World3D';

interface World3DCanvasProps {
  characterModelPath?: string;
  className?: string;
  onCameraAnimationComplete?: () => void;
}

export interface World3DCanvasRef {
  playCharacterAnimation: (animationName: string, loop?: boolean, fadeTime?: number, lookAtCamera?: boolean) => boolean;
  adjustCamera: (options: {
    position?: { x: number; y: number; z: number };
    lookAt?: { x: number; y: number; z: number };
    duration?: number;
    easing?: (amount: number) => number;
    onComplete?: () => void;
  }) => void;
  isSpawnSequenceComplete: () => boolean;
}

const World3DCanvas = forwardRef<World3DCanvasRef, World3DCanvasProps>(({ 
  characterModelPath = '/models/bot.glb',
  className = '',
  onCameraAnimationComplete
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World3D | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoading, setShowLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expose playCharacterAnimation, adjustCamera, and isSpawnSequenceComplete functions to parent components
  useImperativeHandle(ref, () => ({
    playCharacterAnimation: (animationName: string, loop: boolean = true, fadeTime: number = 0.3, lookAtCamera: boolean = true) => {
      if (worldRef.current) {
        return worldRef.current.playCharacterAnimation(animationName, loop, fadeTime, lookAtCamera);
      }
      return false;
    },
    adjustCamera: (options: {
      position?: { x: number; y: number; z: number };
      lookAt?: { x: number; y: number; z: number };
      duration?: number;
      easing?: (amount: number) => number;
      onComplete?: () => void;
    }) => {
      if (worldRef.current) {
        worldRef.current.adjustCamera(options);
      }
    },
    isSpawnSequenceComplete: () => {
      if (worldRef.current) {
        return worldRef.current.isSpawnSequenceComplete();
      }
      return false;
    }
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize World3D
    const world = new World3D(containerRef.current);
    worldRef.current = world;

    // Set up camera animation complete callback
    if (onCameraAnimationComplete) {
      world.onCameraZoomComplete(onCameraAnimationComplete);
    }

    // Load character only (no museum)
    const initWorld = async () => {
      try {
        setIsLoading(true);
        
        // Detect file format and load accordingly
        const fileExtension = characterModelPath.split('.').pop()?.toLowerCase();
        
        console.log('Loading character...');
        
        if (fileExtension === 'fbx') {
          // FBX format - load with separate animation files
          console.log('Detected FBX format, loading with separate animations');
          
          // Define animation paths
          const animationPaths = {
            'idle': '/models/idle.fbx',
            'walking': '/models/walking.fbx',
            'cheering': '/models/cheering.fbx',
            'falling': '/models/falling.fbx',
            'falling-impact': '/models/falling-impact.fbx',
            'standing-up': '/models/standing-up.fbx',
            'entering-code': '/models/entering-code.fbx'
          };
          
          await world.loadCharacterFBX(characterModelPath, animationPaths);
        } else {
          // GLTF/GLB format - load with embedded animations
          console.log('Detected GLTF/GLB format, loading with embedded animations');
          await world.loadCharacter(characterModelPath);
        }
        
        // Start the world
        world.start();
        
        // Start fade-out
        setIsLoading(false);
        
        // Remove loading screen after fade completes
        setTimeout(() => {
          setShowLoading(false);
        }, 1000); // 1 second for fade transition
      } catch (err) {
        console.error('Failed to initialize world:', err);
        setError('Failed to load character model. Please check if the model exists at: ' + characterModelPath);
        setIsLoading(false);
        setTimeout(() => {
          setShowLoading(false);
        }, 1000);
      }
    };

    initWorld();

    // Cleanup
    return () => {
      if (worldRef.current) {
        worldRef.current.dispose();
        worldRef.current = null;
      }
    };
  }, [characterModelPath, onCameraAnimationComplete]);

  return (
    <div className={`relative ${className}`}>
      <div 
        ref={containerRef} 
        className="w-full h-full"
        style={{ touchAction: 'none' }}
      />
      
      {showLoading && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-background"
          style={{
            opacity: isLoading ? 1 : 0,
            transition: 'opacity 1s ease-out',
            pointerEvents: isLoading ? 'auto' : 'none'
          }}
        >
          <div className="text-foreground text-xl font-medium">Loading...</div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
          <div className="text-red-400 text-center p-4 max-w-md">
            <div className="text-xl font-bold mb-2">Error</div>
            <div>{error}</div>
          </div>
        </div>
      )}
    </div>
  );
});

World3DCanvas.displayName = 'World3DCanvas';

export default World3DCanvas;
