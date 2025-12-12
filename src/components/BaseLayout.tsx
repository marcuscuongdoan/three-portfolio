'use client';

import { useState, useEffect, useRef, ReactNode, cloneElement, isValidElement } from "react";
import World3DCanvas, { World3DCanvasRef } from "@/components/World3DCanvas";
import Navbar from "@/components/Navbar";
import CloudBackground, { CloudBackgroundRef } from "@/components/CloudBackground";
import { useIsMobile } from "@/hooks/useIsMobile";

interface BaseLayoutProps {
  children?: ReactNode;
  showNavbar?: boolean;
  cloudOpacity?: number;
  maxClouds?: number;
  characterModelPath?: string;
  enableCloudControls?: boolean;
  className?: string;
}

export default function BaseLayout({
  children,
  showNavbar = true,
  cloudOpacity = 0.3,
  maxClouds = 50,
  characterModelPath = '/models/bot.fbx',
  className = "",
}: BaseLayoutProps) {
  const [showContent, setShowContent] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [spawnSequenceComplete, setSpawnSequenceComplete] = useState(false);
  const cloudRef = useRef<CloudBackgroundRef>(null);
  const world3DRef = useRef<World3DCanvasRef>(null);
  
  // Detect mobile for performance optimizations
  const isMobile = useIsMobile(640);
  
  // Reduce cloud count on mobile
  const effectiveMaxClouds = isMobile ? Math.min(maxClouds, 10) : maxClouds;

  // Function to play character animation
  const playCharacterAnimation = (animationName: string, loop: boolean = true, fadeTime: number = 0.3, lookAtCamera: boolean = true) => {
    if (world3DRef.current) {
      return world3DRef.current.playCharacterAnimation(animationName, loop, fadeTime, lookAtCamera);
    }
    return false;
  };

  // Function to adjust camera position
  const adjustCamera = (options: {
    position?: { x: number; y: number; z: number };
    lookAt?: { x: number; y: number; z: number };
    duration?: number;
    easing?: (amount: number) => number;
    onComplete?: () => void;
  }) => {
    if (world3DRef.current) {
      world3DRef.current.adjustCamera(options);
    }
  };


  useEffect(() => {
    // Poll for spawn sequence completion
    const checkSpawnSequence = () => {
      if (world3DRef.current?.isSpawnSequenceComplete()) {
        setSpawnSequenceComplete(true);
        // Fade in content after sequence completes
        setTimeout(() => {
          setShowContent(true);
          setShowNav(true);
        }, 500);
      } else {
        // Check again in 100ms
        setTimeout(checkSpawnSequence, 100);
      }
    };
    
    // Start checking after a brief delay to ensure world is initialized
    setTimeout(checkSpawnSequence, 500);
  }, []);

  return (
    <main className="w-screen h-screen overflow-hidden bg-background relative">
      {/* Cloud Background - Fixed (always visible) */}
      <div className="fixed inset-0 z-0">
        <CloudBackground 
          ref={cloudRef} 
          opacity={cloudOpacity} 
          maxClouds={effectiveMaxClouds}
        />
      </div>
      
      {/* 3D Canvas - Fixed (always visible) - More transparent on mobile */}
      <div className={`fixed inset-0 z-30 pointer-events-none ${isMobile ? 'opacity-50' : 'opacity-90'}`}>
        <World3DCanvas 
          ref={world3DRef}
          className="w-full h-full" 
          characterModelPath={characterModelPath}
          isMobile={isMobile}
        />
      </div>
      
      {/* Navbar - Fixed (hidden until spawn completes) */}
      {showNavbar && (
        <div
          style={{
            opacity: showContent && spawnSequenceComplete ? 1 : 0,
            pointerEvents: spawnSequenceComplete ? 'auto' : 'none',
            transition: 'opacity 1s ease-in',
          }}
          className="relative z-40"
        >
          <Navbar show={showNav && spawnSequenceComplete} />
        </div>
      )}
      
      {/* Children Content - Scrollable with Snap (hidden until spawn completes) */}
      {children && (
        <div 
          className={`relative z-10 h-full ${spawnSequenceComplete ? 'overflow-y-auto' : 'overflow-hidden'} overflow-x-hidden ${className}`}
          style={{
            opacity: spawnSequenceComplete ? 1 : 0,
            pointerEvents: spawnSequenceComplete ? 'auto' : 'none',
            transition: 'opacity 0.5s ease-in'
          }}
        >
          <div className="pointer-events-auto">
            {/* Clone children and inject playCharacterAnimation and adjustCamera functions */}
            {isValidElement(children) 
              ? cloneElement(children, { playCharacterAnimation, adjustCamera } as any)
              : children
            }
          </div>
        </div>
      )}
    </main>
  );

}
