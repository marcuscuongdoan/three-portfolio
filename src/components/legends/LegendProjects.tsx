"use client";

import { memo, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import SectionLayout from "@/components/SectionLayout";
import { LolSectionTitle } from "@/components/legends/LolOrnaments";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useCharacterAnimation } from "@/hooks/useCharacterAnimation";
import { projects, Project } from "@/data/portfolio";
import { SECTION_SHOTS } from "@/config/sectionShots";

export default function LegendProjects() {
  const isMobile = useIsMobile(640);
  const { containerRef, isInView } = useCharacterAnimation(SECTION_SHOTS.projects);

  return (
    <SectionLayout id="projects" ref={containerRef} className="flex-col">
      <LolSectionTitle
        eyebrow="Collection"
        title="My Projects"
        subtitle="Explore my latest work and creative solutions"
        className="mb-10 z-10 flex-shrink-0 px-4"
      />

      {isInView &&
        (isMobile ? (
          // Mobile: horizontal snap scroll, 80% width cards with 10% peek
          <div className="w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide px-[10vw]">
            <div className="flex gap-[10vw] pb-4">
              {projects.map((project) => (
                <div key={project.id} className="flex-shrink-0 w-[80vw] snap-start">
                  <ProjectCard project={project} compact />
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Desktop: 3D perspective marquee (same layout as the homepage)
          <div
            className="w-full"
            style={{
              perspective: "1500px",
              perspectiveOrigin: "left center",
              transform:
                "perspective(50vw) rotateY(-30deg) translateX(-15vw) translateZ(20vw)",
            }}
          >
            <div className="w-full relative flex flex-row-reverse gap-3 items-center">
              {projects.map((project) => (
                <MarqueeItem key={project.id} project={project} />
              ))}
            </div>
          </div>
        ))}
    </SectionLayout>
  );
}

const MarqueeItem = memo(function MarqueeItem({ project }: { project: Project }) {
  const [isHovered, setIsHovered] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const staggerOffset = (project.id - 1) * 500;

  return (
    <motion.div
      className="relative flex-shrink-0 w-[500px]"
      animate={{
        // Respect prefers-reduced-motion: keep cards static instead of marquee
        ...(shouldReduceMotion
          ? {}
          : {
              x: [
                `calc(-100vw - ${staggerOffset}px)`,
                `calc(300vw - ${staggerOffset}px)`,
              ],
            }),
        scale: isHovered ? 1.15 : 1,
      }}
      transition={{
        x: { duration: 20, ease: "linear", repeat: Infinity },
        scale: { duration: 0.3, ease: "easeOut" },
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      style={{ zIndex: isHovered ? 50 : 1 }}
    >
      <ProjectCard project={project} highlighted={isHovered} />
    </motion.div>
  );
});

interface ProjectCardProps {
  project: Project;
  compact?: boolean;
  highlighted?: boolean;
}

function ProjectCard({ project, compact = false, highlighted = false }: ProjectCardProps) {
  return (
    <a
      href={project.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block h-full focus:outline-none"
    >
      <div
        className={`lol-frame h-full flex flex-col transition-shadow duration-300 ${compact ? "p-3" : "p-5"} ${
          highlighted ? "shadow-[0_0_32px_rgba(200,170,110,0.35)]" : ""
        }`}
      >
        {/* Splash art */}
        <div className="relative aspect-video overflow-hidden border border-lol-gold-400 mb-4">
          <Image
            src={project.image}
            alt={project.name}
            width={800}
            height={450}
            sizes={compact ? "80vw" : "500px"}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-lol-void/80 via-transparent to-transparent" />
          <span className="absolute bottom-2 left-3 font-lol text-[10px] tracking-[0.3em] uppercase text-lol-blue-100">
            Project {String(project.id).padStart(2, "0")}
          </span>
        </div>

        <h3
          className={`font-lol font-bold uppercase tracking-wide text-lol-gold-100 mb-2 ${compact ? "text-base" : "text-2xl"}`}
        >
          {project.name}
        </h3>
        <p
          className={`text-lol-grey-100 leading-relaxed mb-4 flex-grow ${compact ? "text-xs line-clamp-3" : "text-sm"}`}
        >
          {project.description}
        </p>
        <span className="inline-flex items-center gap-2 font-lol font-semibold uppercase tracking-[0.15em] text-xs text-lol-gold-200 group-hover:text-lol-gold-100 transition-colors">
          View Project
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="square" strokeWidth={1.5} d="M13 6l6 6-6 6M5 12h14" />
          </svg>
        </span>
      </div>
    </a>
  );
}
