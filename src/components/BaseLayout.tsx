"use client";

import { useState, useEffect, ReactNode, useTransition } from "react";
import dynamic from "next/dynamic";
import World3DCanvas, { CharacterId } from "@/components/World3DCanvas";
import Navbar from "@/components/Navbar";
import { useIsMobile } from "@/hooks/useIsMobile";

// Lazy load CloudBackground for better performance
const CloudBackground = dynamic(() => import("@/components/CloudBackground"), {
  ssr: false,
  loading: () => null,
});

// If the spawn sequence never completes (WebGL failure, model load error),
// reveal the page content anyway after this long
const SPAWN_FALLBACK_MS = 10000;

interface BaseLayoutProps {
  children?: ReactNode;
  // Fixed UI rendered above the 3D canvas (e.g. a skin picker)
  overlay?: ReactNode;
  // Replaces the default cloud background
  background?: ReactNode;
  // Replaces the default navbar; receives whether it should be shown
  renderNavbar?: (show: boolean) => ReactNode;
  showNavbar?: boolean;
  cloudOpacity?: number;
  maxClouds?: number;
  character?: CharacterId;
  characterModelPath?: string;
  className?: string;
}

export default function BaseLayout({
  children,
  overlay,
  background,
  renderNavbar,
  showNavbar = true,
  cloudOpacity = 0.3,
  maxClouds = 50,
  character = "bot",
  characterModelPath,
  className = "",
}: BaseLayoutProps) {
  const [spawnSequenceComplete, setSpawnSequenceComplete] = useState(false);
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

  // Safety net: never leave the page hidden forever if the 3D world fails
  useEffect(() => {
    if (spawnSequenceComplete) return;
    const fallbackId = setTimeout(
      () => setSpawnSequenceComplete(true),
      SPAWN_FALLBACK_MS,
    );
    return () => clearTimeout(fallbackId);
  }, [spawnSequenceComplete]);

  return (
    <main className="w-screen h-screen overflow-hidden bg-background relative">
      {/* Cloud Background - Fixed (always visible) */}
      <div className="fixed inset-0 z-0">
        {background ?? (
          <CloudBackground
            opacity={cloudOpacity}
            maxClouds={effectiveMaxClouds}
          />
        )}
      </div>

      {/* 3D Canvas - Fixed (always visible) - More transparent on mobile */}
      <div
        className={`fixed inset-0 z-30 pointer-events-none ${isMobile ? "opacity-50" : "opacity-90"}`}
      >
        <World3DCanvas
          className="w-full h-full"
          character={character}
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
            pointerEvents: spawnSequenceComplete ? "auto" : "none",
            transition: "opacity 1s ease-in",
          }}
          className="relative z-40"
        >
          {renderNavbar ? (
            renderNavbar(spawnSequenceComplete)
          ) : (
            <Navbar show={spawnSequenceComplete} />
          )}
        </div>
      )}

      {/* Overlay - Fixed above the canvas (hidden until spawn completes) */}
      {overlay && (
        <div
          style={{
            opacity: spawnSequenceComplete ? 1 : 0,
            pointerEvents: spawnSequenceComplete ? "auto" : "none",
            transition: "opacity 1s ease-in",
          }}
          className="relative z-40"
        >
          {overlay}
        </div>
      )}

      {/* Children Content - Scrollable with Snap (hidden until spawn completes) */}
      {children && (
        <div
          className={`relative z-10 h-full ${spawnSequenceComplete ? "overflow-y-auto" : "overflow-hidden"} overflow-x-hidden ${className}`}
          style={{
            opacity: spawnSequenceComplete ? 1 : 0,
            pointerEvents: spawnSequenceComplete ? "auto" : "none",
            transition: "opacity 0.5s ease-in",
          }}
        >
          <div className="pointer-events-auto">{children}</div>
        </div>
      )}
    </main>
  );
}
