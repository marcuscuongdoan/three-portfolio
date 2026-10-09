"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import SectionLayout from "@/components/SectionLayout";
import { LolDivider } from "@/components/legends/LolOrnaments";
import { useCharacterAnimation } from "@/hooks/useCharacterAnimation";
import { techStack } from "@/data/portfolio";
import { SECTION_SHOTS } from "@/config/sectionShots";

// Passive, basic abilities, summoner spells, then item slots
const HOTKEYS = ["P", "Q", "W", "E", "R", "D", "F", "1", "2", "3", "4", "5", "6"];

const fadeUp = (show: boolean, delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: show ? 1 : 0, y: show ? 0 : 20 },
  transition: { duration: 0.8, delay },
});

export default function LegendHome() {
  const [showText, setShowText] = useState(false);
  const { containerRef } = useCharacterAnimation(SECTION_SHOTS.home);

  useEffect(() => {
    const timer = setTimeout(() => setShowText(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SectionLayout
      id="home"
      ref={containerRef}
      className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12 justify-end items-center sm:items-end"
    >
      <motion.div
        initial={{ opacity: 0, filter: "blur(10px)" }}
        animate={{
          opacity: showText ? 1 : 0,
          filter: showText ? "blur(0px)" : "blur(10px)",
        }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="max-w-2xl w-full text-center sm:text-right space-y-5 sm:space-y-6"
      >
        {/* Champion name + title */}
        <motion.div {...fadeUp(showText, 0.2)}>
          <p className="font-lol text-xs sm:text-sm tracking-[0.35em] uppercase text-lol-blue-200 mb-3">
            Welcome, Summoner
          </p>
          <h1 className="font-lol font-black uppercase leading-none tracking-wide text-5xl sm:text-6xl md:text-7xl lg:text-8xl lol-gold-text pb-2">
            Cuong
            <span className="block text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-[0.2em] mt-2">
              Marcus
            </span>
          </h1>
          <p className="font-lol italic text-lg sm:text-xl md:text-2xl text-lol-gold-100 mt-3 tracking-wide">
            The Fullstack Developer
          </p>
          <LolDivider align="right" className="mt-5 max-w-sm mx-auto sm:mr-0 sm:ml-auto" />
        </motion.div>

        {/* Lore */}
        <motion.div {...fadeUp(showText, 0.4)} className="space-y-3">
          <p className="text-base sm:text-lg md:text-xl text-lol-grey-100 leading-relaxed">
            I build{" "}
            <span className="text-lol-gold-100 font-semibold">
              fast, interactive web apps
            </span>{" "}
            with <span className="text-lol-blue-100">React</span>,{" "}
            <span className="text-lol-blue-100">Next.js</span>, and{" "}
            <span className="text-lol-blue-100">Three.js</span>, with a
            frontend focus.
          </p>
          <p className="text-sm sm:text-base text-lol-grey-100/80">
            I also design for the web and craft assets that bring ideas to life.
          </p>
        </motion.div>

        {/* Tech stack as an ability bar */}
        <motion.div {...fadeUp(showText, 0.6)}>
          <p className="font-lol text-xs tracking-[0.3em] uppercase text-lol-gold-200 mb-3">
            Abilities
          </p>
          <ul className="flex flex-wrap gap-2 sm:gap-3 justify-center sm:justify-end">
            {techStack.map((tech, i) => (
              <li key={tech.name} className="group relative">
                <div
                  title={tech.name}
                  className="relative w-11 h-11 sm:w-12 sm:h-12 p-2.5 bg-lol-slate border-2 border-lol-gold-400 text-lol-gold-100 transition-all duration-200 group-hover:border-lol-gold-200 group-hover:shadow-[0_0_12px_rgba(200,170,110,0.5)]"
                >
                  {tech.logo}
                  <span className="absolute -bottom-2 -right-2 min-w-5 h-5 px-1 flex items-center justify-center font-lol text-[10px] font-bold text-lol-gold-100 bg-lol-void border border-lol-gold-400">
                    {HOTKEYS[i] ?? ""}
                  </span>
                </div>
                {/* Ability tooltip */}
                <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-9 whitespace-nowrap px-2 py-1 text-xs text-lol-gold-100 bg-lol-void border border-lol-gold-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  {tech.name}
                </span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showText ? 1 : 0 }}
          transition={{ duration: 1, delay: 1.2, repeat: Infinity, repeatType: "reverse" }}
          className="flex justify-center pt-4"
          aria-hidden
        >
          <svg className="w-6 h-6 text-lol-gold-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="square" strokeWidth={1.5} d="M6 9l6 6 6-6M6 4l6 6 6-6" />
          </svg>
        </motion.div>
      </motion.div>
    </SectionLayout>
  );
}
