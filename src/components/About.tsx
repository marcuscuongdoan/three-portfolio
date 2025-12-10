"use client";

import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useEffect } from "react";
import Image from "next/image";

interface AboutProps {
  playCharacterAnimation?: (animationName: string, loop?: boolean, fadeTime?: number) => boolean;
  adjustCamera?: (options: {
    position?: { x: number; y: number; z: number };
    lookAt?: { x: number; y: number; z: number };
    duration?: number;
    easing?: (amount: number) => number;
    onComplete?: () => void;
  }) => void;
}

// Template project data
const projects = [
  {
    id: 1,
    name: "VGIG Physical Concert",
    description: "VGIG is an immersive platform that brings fans closer to music and the artists they love through interactive digital experiences.",
    url: "https://vgig.bw.land",
    image: "/images/about-vgig.png"
  },
  {
    id: 2,
    name: "Defind",
    description: "Track and discover the most profitable crypto wallets and DeFi traders. Analyze wallet performance, find trending tokens, and copy successful trading strategies.",
    url: "https://defind.info",
    image: "/images/defind.png"
  },
  {
    id: 3,
    name: "Desygner Website",
    description: "Leverage the power of AI and expertly crafted marketing materials and promotional content to fast-track business growth, saving precious time and money.",
    url: "https://desygner.com",
    image: "/images/desygner.png"
  },
  {
    id: 4,
    name: "XLD Finance",
    description: "High-performance chain for stablecoins, payment, and onchain FX, with the vision of bringing all currencies onchain.",
    url: "https://central.global",
    image: "/images/xld.png"
  },
  {
    id: 5,
    name: "Motion Miracles Website",
    description: "Game technology studio & agency focused on delivering immersive gaming products and services in blockchain and cross-platform games to our players and clients/partners.",
    url: "https://www.motionmiracles.com",
    image: "/images/motion-miracles.png"
  },
  {
    id: 6,
    name: "Mental Gym Project",
    description: `We aim to create a safe environment 
where we can be able to:
Assist the young generations on 
alleviate mental health stigma
Foster individuals’ self-expression 
and self-awareness towards mental 
well-being`,
    url: "https://mental-gym.vercel.app",
    image: "/images/mental-gym.png"
  },
];

export default function About({ playCharacterAnimation, adjustCamera }: AboutProps) {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: false, amount: 0.3 });
  const hasTriggeredAnimation = useRef(false);

  // Trigger run animation and adjust camera when scrolling into About section
  useEffect(() => {
    if (isInView && !hasTriggeredAnimation.current) {
      // Play run animation
      if (playCharacterAnimation) {
        playCharacterAnimation('run', true, 0.5);
      }

      // Zoom out and move camera to the left
      if (adjustCamera) {
        adjustCamera({
          position: { x: 0, y: 1.25, z: 1 }, // Zoom out and move left
          lookAt: { x: 0.5, y: 1.5, z: 0 },
          duration: 1500
        });
      }

      hasTriggeredAnimation.current = true;
    } else if (!isInView && hasTriggeredAnimation.current) {
      // Return to idle and reset camera when scrolling away from About section
      if (playCharacterAnimation) {
        playCharacterAnimation('idle', true, 0.5);
      }

      // Return camera to original position
      if (adjustCamera) {
        adjustCamera({
          position: { x: 0, y: 1.7, z: 1 },
          lookAt: { x: 0.5, y: 1.5, z: 0 },
          duration: 1500
        });
      }

      hasTriggeredAnimation.current = false;
    }
  }, [isInView, playCharacterAnimation, adjustCamera]);

  return (
    <section
      id="about"
      ref={containerRef}
      className="min-h-screen w-[100vw] h-[100vh] flex flex-col items-center justify-center py-20 overflow-x-hidden relative snap-start snap-always"
    >
      {/* Section Title */}
      <motion.div
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="mb-16 text-center z-10"
      >
        <h2 className="text-5xl md:text-6xl font-bold text-white mb-4">
          My Projects
        </h2>
        <p className="text-lg text-gray-300 max-w-2xl mx-auto">
          Explore my latest work and creative solutions
        </p>
      </motion.div>

      {/* Projects Container */}
      {isInView && <div className="w-full" style={{
        perspective: "1500px",
        perspectiveOrigin: "left center",
        transform: "perspective(50vw) rotateY(-30deg) translateX(-15vw) translateZ(20vw)",
      }}>
        <div className="w-full relative overflow-hidden flex flex-row-reverse gap-12 items-center">
          {projects.map((project, index) => (
            <ProjectBlock
              key={`${project.id}-${index}`}
              project={project}
              index={index}
              isInView={isInView}
              totalCount={projects.length}
            />
          ))}
        </div>
      </div>}
    </section>
  );
}


interface ProjectBlockProps {
  project: {
    id: number;
    name: string;
    description: string;
    url: string;
    image: string;
  };
  index: number;
  isInView: boolean;
  totalCount: number;
}

function ProjectBlock({ project }: ProjectBlockProps) {
  // Calculate consistent distance for all items
  // Start from -100vw and end at 100vw, with stagger offset applied to both
  const blockWidth = 500;
  const staggerOffset = (project.id - 1) * blockWidth;
  
  return (
    <motion.div
      className="relative flex-shrink-0 w-[500px]"
      animate={{
        x: [`calc(-100vw - ${staggerOffset}px)`, `calc(300vw - ${staggerOffset}px)`],
      }}
      transition={{
        x: {
          duration: 10,
          ease: "linear",
          repeat: Infinity,
        },
      }}
    >
      <div className="h-full">
        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block h-full"
        >
          {/* Wall-like perspective container */}
          <div
            className="relative overflow-x-hidden rounded-lg shadow-2xl h-full"
            style={{
              background: "linear-gradient(135deg, rgba(30, 30, 60, 0.9) 0%, rgba(60, 60, 100, 0.95) 100%)",
              transition: "transform 0.3s ease"
            }}
          >
            {/* Content */}
            <div className="flex flex-col p-6 h-full">
              {/* Image Section */}
              <div className="relative mb-6">
                <div className="aspect-video bg-gradient-to-br from-purple-600/30 to-blue-600/30 rounded-lg overflow-hidden border border-white/10">
                  <Image
                    src={project.image}
                    alt={project.name}
                    width={350}
                    height={197}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Text Section */}
              <div className="flex flex-col flex-grow">
                <h3 className="text-2xl font-bold text-white mb-3">
                  {project.name}
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed mb-4 flex-grow">
                  {project.description}
                </p>
                <div className="inline-flex items-center text-blue-400 hover:text-blue-300 transition-colors">
                  <span className="font-semibold text-sm">View Project</span>
                  <svg
                    className="w-4 h-4 ml-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Decorative Elements */}
            <div
              className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500"
              style={{
                opacity: 0.7
              }}
            />
          </div>
        </a>
      </div>
    </motion.div>
  );
}
