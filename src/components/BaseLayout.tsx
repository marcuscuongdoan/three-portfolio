'use client';

import { useState, useRef, ReactNode, useTransition } from "react";
import dynamic from 'next/dynamic';
import World3DCanvas, { World3DCanvasRef } from "@/components/World3DCanvas";
import Navbar from "@/components/Navbar";
import { useIsMobile } from "@/hooks/useIsMobile";

// Lazy load CloudBackground for better performance
const CloudBackground = dynamic(() => import("@/components/CloudBackground"), {
  ssr: false,
  loading: () => null
});

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
  const [spawnSequenceComplete, setSpawnSequenceComplete] = useState(false);
  const world3DRef = useRef<World3DCanvasRef>(null);
  const [, startTransition] = useTransition();
  
  // Detect mobile for performance optimizations
  const isMobile = useIsMobile(640);
  
  // Reduce cloud count on mobile
  const effectiveMaxClouds = isMobile ? Math.min(maxClouds, 10) : maxClouds;

  // Event-based spawn sequence completion handler
  const handleSpawnSequenceComplete = () => {
    // Use transition for non-urgent UI update
    startTransition(() => {
      setSpawnSequenceComplete(true);
    });
  };

  return (
      <main className="w-screen h-screen overflow-hidden bg-background relative">
        {/* Cloud Background - Fixed (always visible) */}
        <div className="fixed inset-0 z-0">
          <CloudBackground 
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
            onSpawnSequenceComplete={handleSpawnSequenceComplete}
          />
        </div>
        
        {/* Navbar - Fixed (hidden until spawn completes) */}
        {showNavbar && (
          <div
            style={{
              opacity: spawnSequenceComplete ? 1 : 0,
              pointerEvents: spawnSequenceComplete ? 'auto' : 'none',
              transition: 'opacity 1s ease-in',
            }}
            className="relative z-40"
          >
            <Navbar show={spawnSequenceComplete} />
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
              {children}
            </div>
          </div>
        )}
      </main>
  );

}
