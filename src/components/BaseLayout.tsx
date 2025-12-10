'use client';

import { useState, useEffect, useRef, ReactNode } from "react";
import World3DCanvas from "@/components/World3DCanvas";
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
    <main className={`w-screen h-screen overflow-hidden bg-black relative ${className}`}>
      {/* Cloud Background */}
      <CloudBackground 
        ref={cloudRef} 
        opacity={cloudOpacity} 
        maxClouds={maxClouds}
      />
      
      {/* Main Content with fade-in */}
      <div
        style={{
          opacity: showContent ? 1 : 0,
          transition: 'opacity 1s ease-in',
        }}
      >
        {/* Navbar */}
        {showNavbar && <Navbar show={showNav} />}
        
        {/* 3D Canvas */}
        <div className="absolute inset-0 pt-16">
          <World3DCanvas 
            className="w-full h-full" 
            characterModelPath={characterModelPath}
          />
        </div>
        
        {/* Children Content */}
        {children && (
          <div className="absolute inset-0 pt-16 pointer-events-none">
            {children}
          </div>
        )}
      </div>
    </main>
  );
}
