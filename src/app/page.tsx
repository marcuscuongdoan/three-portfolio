"use client";

import BaseLayout from "@/components/BaseLayout";
import Home from "@/components/Home";
import About from "@/components/About";
import Contact from "@/components/Contact";

interface HomeContentProps {
  playCharacterAnimation?: (animationName: string, loop?: boolean, fadeTime?: number, lookAtCamera?: boolean) => boolean;
  adjustCamera?: (options: {
    position?: { x: number; y: number; z: number };
    lookAt?: { x: number; y: number; z: number };
    duration?: number;
    easing?: (amount: number) => number;
    onComplete?: () => void;
  }) => void;
}

function HomeContent({ playCharacterAnimation, adjustCamera }: HomeContentProps) {
  return (
    <>
      {/* Home Section */}
      <Home playCharacterAnimation={playCharacterAnimation} adjustCamera={adjustCamera} />

      {/* About Section */}
      <About playCharacterAnimation={playCharacterAnimation} adjustCamera={adjustCamera} />

      {/* Contact Section */}
      <Contact playCharacterAnimation={playCharacterAnimation} adjustCamera={adjustCamera} />
    </>
  );
}

export default function Page() {
  return (
    <BaseLayout
      showNavbar={true}
      cloudOpacity={0.3}
      maxClouds={50}
      enableCloudControls={true}
      className="snap-y snap-mandatory"
    >
      <HomeContent />
    </BaseLayout>
  );
}
