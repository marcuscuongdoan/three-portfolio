"use client";

import { useState, useEffect, useRef } from "react";
import BaseLayout from "@/components/BaseLayout";
import About from "@/components/About";
import Contact from "@/components/Contact";
import SectionLayout from "@/components/SectionLayout";
import { motion, useInView } from "framer-motion";

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
  const homeRef = useRef(null);
  const isHomeInView = useInView(homeRef, { once: false, amount: 0.3 });

  useEffect(() => {
    // Show text after a delay
    setTimeout(() => {
      setShowText(true);
    }, 1000);
  }, []);

  // Trigger idle animation and default camera position when Home section is in view
  useEffect(() => {
    if (isHomeInView) {
      // Play idle animation
      playCharacterAnimation?.('idle', true, 0.5);

      // Set default camera position
      adjustCamera?.({
        position: { x: 0, y: 1.7, z: 1 },
        lookAt: { x: 0.5, y: 1.5, z: 0 },
        duration: 1500
      });
    }
  }, [isHomeInView, playCharacterAnimation, adjustCamera]);

  return (
    <>
      {/* Hero Section */}
      <SectionLayout 
        id="home" 
        ref={homeRef}
        className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 justify-end"
      >
        <motion.div
          initial={{ opacity: 0, filter: "blur(10px)" }}
          animate={{ 
            opacity: showText ? 1 : 0, 
            filter: showText ? "blur(0px)" : "blur(10px)" 
          }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="text-center text-foreground"
        >
          <p className="text-lg mb-2 text-left">Welcome to</p>
          <h1 className="text-7xl font-bold mb-4">Portfolio</h1>
          <p className="text-sm text-right">by Marcus - Cuong Doan</p>
        </motion.div>
      </SectionLayout>

      {/* About Section */}
      <About playCharacterAnimation={playCharacterAnimation} adjustCamera={adjustCamera} />

      {/* Contact Section */}
      <Contact playCharacterAnimation={playCharacterAnimation} adjustCamera={adjustCamera} />
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
