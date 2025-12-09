'use client';

import { useEffect, useRef, useState } from 'react';
import { World3D } from '@/lib/three-world/World3D';

interface World3DCanvasProps {
  characterModelPath?: string;
  className?: string;
  onCameraAnimationComplete?: () => void;
}

export default function World3DCanvas({ 
  characterModelPath = '/models/bot.glb',
  className = '',
  onCameraAnimationComplete
}: World3DCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World3D | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        
        // Load character
        console.log('Loading character...');
        await world.loadCharacter(characterModelPath);
        
        // Start the world
        world.start();
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize world:', err);
        setError('Failed to load character model. Please check if the model exists at: ' + characterModelPath);
        setIsLoading(false);
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
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-white text-xl">Loading 3D World...</div>
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
}
