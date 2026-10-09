"use client";

import {
  Component,
  ReactNode,
  Suspense,
  lazy,
  memo,
  useEffect,
  useState,
} from "react";
import { Canvas } from "@react-three/fiber";

// Lazy so each page only downloads (and preloads) its own character
const CHARACTERS = {
  bot: lazy(() => import("@/components/three/characters/BotCharacter")),
  "miss-fortune": lazy(
    () => import("@/components/three/characters/MissFortuneCharacter"),
  ),
};

export type CharacterId = keyof typeof CHARACTERS;

interface World3DCanvasProps {
  character?: CharacterId;
  // Model file for the character; each character has its own default
  characterModelPath?: string;
  className?: string;
  onCameraAnimationComplete?: () => void;
  onSpawnSequenceComplete?: () => void;
  isMobile?: boolean;
}

// Catches loader/render errors inside the Canvas (e.g. missing model files)
class CanvasErrorBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Failed to initialize 3D world:", error);
    this.props.onError();
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

const World3DCanvas = memo(function World3DCanvas({
  character = "bot",
  characterModelPath,
  className = "",
  onCameraAnimationComplete,
  onSpawnSequenceComplete,
  isMobile = false,
}: World3DCanvasProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [showLoading, setShowLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const Character = CHARACTERS[character];

  // Fade the loading overlay out once the scene reports ready
  useEffect(() => {
    if (isLoading) return;
    const fadeTimeoutId = setTimeout(() => setShowLoading(false), 1000);
    return () => clearTimeout(fadeTimeoutId);
  }, [isLoading]);

  const handleError = () => {
    setError(
      "Failed to load character model. Please check if the model exists at: " +
        (characterModelPath ?? `the default path for '${character}'`),
    );
    setIsLoading(false);
  };

  return (
    <div className={`relative ${className}`}>
      <Canvas
        className="w-full h-full"
        // R3F sets pointer-events: auto on its wrapper, which would swallow
        // wheel/touch scrolling of the content underneath. The scene needs no
        // pointer input (head tracking listens on document).
        style={{ pointerEvents: "none" }}
        camera={{ fov: 75, near: 0.1, far: 1000, position: [0, -10, 1] }}
        gl={{
          antialias: !isMobile, // Disable antialiasing on mobile for performance
          alpha: true, // Transparent background
          powerPreference: isMobile ? "low-power" : "high-performance",
        }}
        // Lower pixel ratio + no shadows on mobile for performance
        dpr={isMobile ? 1 : [1, 2]}
        shadows={!isMobile}
      >
        <CanvasErrorBoundary onError={handleError}>
          <Suspense fallback={null}>
            <Character
              modelPath={characterModelPath}
              onReady={() => setIsLoading(false)}
              onCameraAnimationComplete={onCameraAnimationComplete}
              onSpawnSequenceComplete={onSpawnSequenceComplete}
            />
          </Suspense>
        </CanvasErrorBoundary>
      </Canvas>

      {showLoading && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-background"
          style={{
            opacity: isLoading ? 1 : 0,
            transition: "opacity 1s ease-out",
            pointerEvents: isLoading ? "auto" : "none",
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

export default World3DCanvas;
