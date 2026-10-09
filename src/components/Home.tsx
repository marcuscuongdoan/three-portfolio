"use client";

import { useState, useEffect } from "react";
import SectionLayout from "@/components/SectionLayout";
import { motion, useReducedMotion } from "framer-motion";
import { useCharacterAnimation } from "@/hooks/useCharacterAnimation";
import { techStack } from "@/data/portfolio";
import { SECTION_SHOTS } from "@/config/sectionShots";


export default function Home() {
  const [showText, setShowText] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const { containerRef } = useCharacterAnimation(SECTION_SHOTS.home);

  useEffect(() => {
    // Show text after a delay
    const timer = setTimeout(() => {
      setShowText(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SectionLayout 
      id="home" 
      ref={containerRef}
      className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12 justify-end sm:justify-end items-center sm:items-end"
    >
      <motion.div
        initial={{ opacity: 0, filter: "blur(10px)" }}
        animate={{ 
          opacity: showText ? 1 : 0, 
          filter: showText ? "blur(0px)" : "blur(10px)" 
        }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="text-foreground space-y-4 sm:space-y-6 max-w-2xl text-center sm:text-right w-full"
      >
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: showText ? 1 : 0, y: showText ? 0 : 20 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="space-y-2"
        >
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground">Hi there! 👋</p>
          <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold bg-gradient-to-r from-blue-200 via-blue-300 to-blue-100 bg-clip-text text-transparent">
            I&apos;m Cuong – Marcus
          </h1>
        </motion.div>

        {/* Title & Description */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: showText ? 1 : 0, y: showText ? 0 : 20 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="space-y-3 sm:space-y-4"
        >
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold">
            <span className="text-blue-300">Fullstack Developer</span> with{" "}
            <span className="text-blue-200">Frontend Focus</span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed">
            I build <span className="font-semibold text-foreground">fast, interactive web apps</span> with{" "}
            <span className="text-blue-300 font-medium">React</span>,{" "}
            <span className="text-blue-300 font-medium">Next.js</span>, and{" "}
            <span className="text-blue-300 font-medium">Three.js</span>.
          </p>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground">
            I&apos;m also capable of designing web and interesting assets to bring ideas to life. ✨
          </p>
        </motion.div>

        {/* Tech Stack Carousel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: showText ? 1 : 0, y: showText ? 0 : 20 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="relative overflow-hidden rounded-full"
        >
          <div className="flex gap-3">
            <motion.div
              className="flex gap-3 shrink-0"
              // Two identical sets below, so -50% of this element's own width
              // loops seamlessly regardless of actual content width
              animate={
                shouldReduceMotion ? undefined : { x: ["0%", "-50%"] }
              }
              transition={{
                x: {
                  repeat: Infinity,
                  repeatType: "loop",
                  duration: 30,
                  ease: "linear",
                },
              }}
            >
              {/* First set of tech stack */}
              {techStack.map((tech) => (
                <div
                  key={tech.name}
                  className="group relative shrink-0"
                >
                  <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-100/30 to-blue-200/30 border border-blue-200/40 rounded-full hover:border-blue-300/60 hover:scale-105 transition-all">
                    <div className="w-5 h-5 flex items-center justify-center">
                      {tech.logo}
                    </div>
                    <span className="text-sm font-medium whitespace-nowrap">{tech.name}</span>
                  </div>
                </div>
              ))}
              {/* Duplicate set for seamless loop */}
              {techStack.map((tech) => (
                <div
                  key={`${tech.name}-duplicate`}
                  className="group relative shrink-0"
                >
                  <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-100/30 to-blue-200/30 border border-blue-200/40 rounded-full hover:border-blue-300/60 hover:scale-105 transition-all">
                    <div className="w-5 h-5 flex items-center justify-center">
                      {tech.logo}
                    </div>
                    <span className="text-sm font-medium whitespace-nowrap">{tech.name}</span>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
          {/* Gradient overlays for fade effect */}
          <div className="absolute top-0 left-0 w-20 h-full bg-gradient-to-r from-background to-transparent pointer-events-none z-10" />
          <div className="absolute top-0 right-0 w-20 h-full bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
        </motion.div>

        {/* CTA Arrow */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showText ? 1 : 0 }}
          transition={{ duration: 1, delay: 1.2, repeat: Infinity, repeatType: "reverse" }}
          className="flex justify-center pt-8"
        >
          <svg
            className="w-6 h-6 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </motion.div>
      </motion.div>
    </SectionLayout>
  );
}
