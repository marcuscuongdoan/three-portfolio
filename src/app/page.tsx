"use client";

import { useState, useEffect } from "react";
import BaseLayout from "@/components/BaseLayout";
import About from "@/components/About";
import { motion } from "framer-motion";

interface HomeContentProps {
  playCharacterAnimation?: (animationName: string, loop?: boolean, fadeTime?: number) => boolean;
  adjustCamera?: (options: {
    position?: { x: number; y: number; z: number };
    lookAt?: { x: number; y: number; z: number };
    duration?: number;
    easing?: (amount: number) => number;
    onComplete?: () => void;
  }) => void;
}

function HomeContent({ playCharacterAnimation, adjustCamera }: HomeContentProps) {
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    // Show text after a delay
    setTimeout(() => {
      setShowText(true);
    }, 1000);
  }, []);

  return (
    <>
      {/* Hero Section */}
      <div id="home" className="w-full h-screen max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 flex items-center justify-end snap-start snap-always">
        <motion.div
          initial={{ opacity: 0, filter: "blur(10px)" }}
          animate={{ 
            opacity: showText ? 1 : 0, 
            filter: showText ? "blur(0px)" : "blur(10px)" 
          }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="text-center text-white"
        >
          <p className="text-lg mb-2 text-left">Welcome to</p>
          <h1 className="text-7xl font-bold mb-4">Portfolio</h1>
          <p className="text-sm text-right">by Marcus - Cuong Doan</p>
        </motion.div>
      </div>

      {/* About Section */}
      <About playCharacterAnimation={playCharacterAnimation} adjustCamera={adjustCamera} />
    </>
  );
}

export default function Home() {
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
