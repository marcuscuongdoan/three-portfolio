'use client';

import { useState, useEffect, useRef, ReactNode, cloneElement, isValidElement } from "react";
import World3DCanvas, { World3DCanvasRef } from "@/components/World3DCanvas";
import Navbar from "@/components/Navbar";
import CloudBackground, { CloudBackgroundRef } from "@/components/CloudBackground";

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
  characterModelPath = '/models/bot.glb',
  enableCloudControls = true,
  className = "",
}: BaseLayoutProps) {
  const [showContent, setShowContent] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const cloudRef = useRef<CloudBackgroundRef>(null);
  const world3DRef = useRef<World3DCanvasRef>(null);

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
    // Fade in all content after 0.5 seconds
    setTimeout(() => {
      setShowContent(true);
      setShowNav(true);
    }, 500);
  }, []);

  useEffect(() => {
    if (!enableCloudControls) return;

    // Keyboard controls for cloud management
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') {
        cloudRef.current?.moreCloud();
      } else if (e.key === '-' || e.key === '_') {
        cloudRef.current?.lessCloud();
      } else if (e.key === 'ArrowUp') {
        cloudRef.current?.increaseSpeed();
      } else if (e.key === 'ArrowDown') {
        cloudRef.current?.decreaseSpeed();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [enableCloudControls]);

  return (
    <main className="w-screen h-screen overflow-hidden bg-background relative">
      {/* Cloud Background - Fixed */}
      <div className="fixed inset-0 z-0">
        <CloudBackground 
          ref={cloudRef} 
          opacity={cloudOpacity} 
          maxClouds={maxClouds}
        />
      </div>
      
      {/* Main Content with fade-in */}
      <div
        style={{
          opacity: showContent ? 1 : 0,
          transition: 'opacity 1s ease-in',
        }}
        className="relative z-10 h-full"
      >
        {/* Navbar - Fixed */}
        {showNavbar && (
          <Navbar show={showNav} />
        )}
        
        {/* 3D Canvas - Fixed */}
        <div className="fixed inset-0 z-30 pointer-events-none opacity-90">
          <World3DCanvas 
            ref={world3DRef}
            className="w-full h-full" 
            characterModelPath={characterModelPath}
          />
        </div>
        
        {/* Children Content - Scrollable with Snap */}
        {children && (
          <div className={`relative z-20 h-full overflow-y-auto overflow-x-hidden ${className}`}>
            <div className="pointer-events-auto">
              {/* Clone children and inject playCharacterAnimation and adjustCamera functions */}
              {isValidElement(children) 
                ? cloneElement(children, { playCharacterAnimation, adjustCamera } as any)
                : children
              }
            </div>
          </div>
        )}
      </div>
    </main>
  );

}
