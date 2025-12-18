"use client";

import { useState, useEffect } from "react";
import SectionLayout from "@/components/SectionLayout";
import { motion } from "framer-motion";
import { useCharacterAnimation } from "@/hooks/useCharacterAnimation";

const techStack = [
  {
    name: 'React',
    logo: <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-cyan-400"><path d="M12 10.11c1.03 0 1.87.84 1.87 1.89 0 1-.84 1.85-1.87 1.85S10.13 13 10.13 12c0-1.05.84-1.89 1.87-1.89M7.37 20c.63.38 2.01-.2 3.6-1.7-.52-.59-1.03-1.23-1.51-1.9a22.7 22.7 0 0 1-2.4-.36c-.51 2.14-.32 3.61.31 3.96m.71-5.74l-.29-.51c-.11.29-.22.58-.29.86.27.06.57.11.88.16l-.3-.51m6.54-.76l.81-1.5-.81-1.5c-.3-.53-.62-1-.91-1.47C13.17 9 12.6 9 12 9s-1.17 0-1.71.03c-.29.47-.61.94-.91 1.47L8.57 12l.81 1.5c.3.53.62 1 .91 1.47.54.03 1.11.03 1.71.03s1.17 0 1.71-.03c.29-.47.61-.94.91-1.47M12 6.78c-.19.22-.39.45-.59.72h1.18c-.2-.27-.4-.5-.59-.72m0 10.44c.19-.22.39-.45.59-.72h-1.18c.2.27.4.5.59.72M16.62 4c-.62-.38-2 .2-3.59 1.7.52.59 1.03 1.23 1.51 1.9.82.08 1.63.2 2.4.36.51-2.14.32-3.61-.32-3.96m-.7 5.74l.29.51c.11-.29.22-.58.29-.86-.27-.06-.57-.11-.88-.16l.3.51m1.45-7.05c1.47.84 1.63 3.05 1.01 5.63 2.54.75 4.37 1.99 4.37 3.68s-1.83 2.93-4.37 3.68c.62 2.58.46 4.79-1.01 5.63-1.46.84-3.45-.12-5.37-1.95-1.92 1.83-3.91 2.79-5.38 1.95-1.46-.84-1.62-3.05-1-5.63-2.54-.75-4.37-1.99-4.37-3.68s1.83-2.93 4.37-3.68c-.62-2.58-.46-4.79 1-5.63 1.47-.84 3.46.12 5.38 1.95 1.92-1.83 3.91-2.79 5.37-1.95M17.08 12c.34.75.64 1.5.89 2.26 2.1-.63 3.28-1.53 3.28-2.26s-1.18-1.63-3.28-2.26c-.25.76-.55 1.51-.89 2.26M6.92 12c-.34-.75-.64-1.5-.89-2.26-2.1.63-3.28 1.53-3.28 2.26s1.18 1.63 3.28 2.26c.25-.76.55-1.51.89-2.26m9.07 1.93l.3.51c.31-.05.61-.1.88-.16-.07-.28-.18-.57-.29-.86l-.29.51.4.71-.71-1.24-.81-1.5.81-1.5.71-1.24-.4.71.29-.51c.11-.29.22-.58.29-.86-.27-.06-.57-.11-.88-.16l-.3.51.29-.51-.4-.71.71 1.24.81 1.5-.81 1.5-.71 1.24.4-.71-.29.51M9.88 13.93l-.3.51-.88-.16c.07.28.18.57.29.86l.29-.51-.29.51.4.71.71-1.24.81-1.5-.81-1.5-.71-1.24.4.71.29-.51c.11-.29.22-.58.29-.86-.27-.06-.57-.11-.88-.16l-.3.51.29-.51-.4-.71.71 1.24.81 1.5-.81 1.5-.71 1.24.4-.71-.29.51m6.79 2.11c.28.39.56.77.81 1.15.5-.41.97-.87 1.37-1.36a19.8 19.8 0 0 1-2.18.21m1.19-6.58a16 16 0 0 1 1.37-1.36c-.25.38-.53.76-.81 1.15.74.05 1.47.11 2.18.21-.4-.49-.87-.95-1.37-1.36a19.8 19.8 0 0 0-1.37 1.36m-5.73 0a19.8 19.8 0 0 0-1.37-1.36c-.5.41-.97.87-1.37 1.36.71-.1 1.44-.16 2.18-.21-.28-.39-.56-.77-.81-1.15m0 6.58c.25-.38.53-.76.81-1.15-.74-.05-1.47-.11-2.18-.21.4.49.87.95 1.37 1.36.44-.43.88-.88 1.37-1.36a19.8 19.8 0 0 1-1.37 1.36m-2.9-2.11l-.3-.51c-.31.05-.61.1-.88.16.07.28.18.57.29.86l.29-.51-.29.51.4.71.71-1.24.81-1.5-.81-1.5-.71-1.24.4.71.29-.51c.11-.29.22-.58.29-.86-.27-.06-.57-.11-.88-.16l-.3.51.29-.51-.4-.71.71 1.24.81 1.5-.81 1.5-.71 1.24.4-.71-.29.51z"/></svg>
  },
  {
    name: 'Next.js',
    logo: <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><path d="M11.572 0c-.176 0-.31.001-.358.007a19.76 19.76 0 0 1-.364.033C7.443.346 4.25 2.185 2.228 5.012a11.875 11.875 0 0 0-2.119 5.243c-.096.659-.108.854-.108 1.747s.012 1.089.108 1.748c.652 4.506 3.86 8.292 8.209 9.695.779.25 1.6.422 2.534.525.363.04 1.935.04 2.299 0 1.611-.178 2.977-.577 4.323-1.264.207-.106.247-.134.219-.158-.02-.013-.9-1.193-1.955-2.62l-1.919-2.592-2.404-3.558a338.739 338.739 0 0 0-2.422-3.556c-.009-.002-.018 1.579-.023 3.51-.007 3.38-.01 3.515-.052 3.595a.426.426 0 0 1-.206.214c-.075.037-.14.044-.495.044H7.81l-.108-.068a.438.438 0 0 1-.157-.171l-.049-.106.005-4.703.007-4.705.072-.092a.645.645 0 0 1 .174-.143c.096-.047.134-.051.54-.051.478 0 .558.018.682.154.035.038 1.337 1.999 2.895 4.361a10760.433 10760.433 0 0 0 4.735 7.17l1.9 2.879.096-.063a12.317 12.317 0 0 0 2.466-2.163 11.944 11.944 0 0 0 2.824-6.134c.096-.66.108-.854.108-1.748 0-.893-.012-1.088-.108-1.747-.652-4.506-3.859-8.292-8.208-9.695a12.597 12.597 0 0 0-2.499-.523A33.119 33.119 0 0 0 11.573 0zm4.069 7.217c.347 0 .408.005.486.047a.473.473 0 0 1 .237.277c.018.06.023 1.365.018 4.304l-.006 4.218-.744-1.14-.746-1.14v-3.066c0-1.982.01-3.097.023-3.15a.478.478 0 0 1 .233-.296c.096-.05.13-.054.5-.054z"/></svg>
  },
  {
    name: 'Tailwind',
    logo: <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-cyan-400"><path d="M12 6c-2.67 0-4.33 1.33-5 4 1-1.33 2.17-1.83 3.5-1.5.76.19 1.31.74 1.91 1.35.98 1 2.09 2.15 4.59 2.15 2.67 0 4.33-1.33 5-4-1 1.33-2.17 1.83-3.5 1.5-.76-.19-1.3-.74-1.91-1.35C15.61 7.15 14.5 6 12 6m-5 6c-2.67 0-4.33 1.33-5 4 1-1.33 2.17-1.83 3.5-1.5.76.19 1.3.74 1.91 1.35C8.39 16.85 9.5 18 12 18c2.67 0 4.33-1.33 5-4-1 1.33-2.17 1.83-3.5 1.5-.76-.19-1.3-.74-1.91-1.35C10.61 13.15 9.5 12 7 12z"/></svg>
  },
  {
    name: 'Three.js',
    logo: <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><path d="M.38 0a.268.268 0 0 0-.256.332l2.894 11.716a.268.268 0 0 0 .01.04l2.89 11.708a.268.268 0 0 0 .447.128L23.802 7.15a.268.268 0 0 0-.112-.45l-5.784-1.667a.268.268 0 0 0-.123-.035L6.38 1.715a.268.268 0 0 0-.144-.04L.628.005A.268.268 0 0 0 .38 0z"/></svg>
  },
  {
    name: 'Zustand',
    logo: <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-amber-600"><path d="M12 0C5.383 0 0 5.383 0 12s5.383 12 12 12 12-5.383 12-12S18.617 0 12 0zm0 2.182c5.418 0 9.818 4.4 9.818 9.818 0 5.418-4.4 9.818-9.818 9.818-5.418 0-9.818-4.4-9.818-9.818 0-5.418 4.4-9.818 9.818-9.818zM8.727 7.636a1.091 1.091 0 1 0 0 2.182 1.091 1.091 0 0 0 0-2.182zm6.546 0a1.091 1.091 0 1 0 0 2.182 1.091 1.091 0 0 0 0-2.182zM12 13.364c-1.957 0-3.6.946-4.364 2.345h8.728c-.764-1.399-2.407-2.345-4.364-2.345z"/></svg>
  },
  {
    name: 'Vite',
    logo: <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-purple-500"><path d="m8.286 10.578.512-8.657a.306.306 0 0 1 .247-.282L17.377.006a.306.306 0 0 1 .353.385l-1.558 5.403a.306.306 0 0 0 .352.385l2.388-.46a.306.306 0 0 1 .332.438l-6.79 13.55-.123.19a.294.294 0 0 1-.252.14c-.177 0-.35-.152-.305-.369l1.095-5.301a.306.306 0 0 0-.388-.355l-1.433.435a.306.306 0 0 1-.389-.354l.69-3.375a.306.306 0 0 0-.37-.36l-2.32.536a.306.306 0 0 1-.374-.316zm14.976-7.926L17.284 3.74l-.544 1.887 2.077-.4a.8.8 0 0 1 .84.369.8.8 0 0 1 .034.783L12.9 19.93l-.013.025-.015.023-.122.19a.801.801 0 0 1-.672.37.826.826 0 0 1-.634-.302.8.8 0 0 1-.16-.67l1.029-4.981-1.12.34a.81.81 0 0 1-.86-.262.802.802 0 0 1-.165-.67l.63-3.08-2.027.468a.808.808 0 0 1-.768-.233.81.81 0 0 1-.217-.6l.389-6.57-7.44-1.33a.612.612 0 0 0-.64.906L11.58 23.691a.612.612 0 0 0 1.066-.004l11.26-20.135a.612.612 0 0 0-.644-.9z"/></svg>
  },
  {
    name: 'Node.js',
    logo: <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-green-600"><path d="M11.998 0c-.321 0-.641.084-.922.247l-8.667 4.998a1.846 1.846 0 0 0-.923 1.597v9.991c0 .657.354 1.265.922 1.597l2.292 1.324c1.129.549 1.547.549 2.094.549 1.703 0 2.677-1.035 2.677-2.834V7.723c0-.13-.104-.234-.234-.234h-1.025a.234.234 0 0 0-.234.234v9.746c0 .754-.777 1.508-2.039.871l-2.398-1.383a.464.464 0 0 1-.234-.403V7.563c0-.165.09-.318.234-.402l8.667-5.003a.465.465 0 0 1 .468 0l8.667 5.003c.144.084.234.237.234.402v9.991a.463.463 0 0 1-.234.403l-8.667 5.002a.464.464 0 0 1-.468 0l-2.207-1.314c-.131-.078-.312-.11-.445-.048-.361.168-.431.201-.77.304-.096.029-.241.075.054.216l2.862 1.699c.28.163.599.247.922.247s.641-.084.922-.247l8.667-4.998a1.846 1.846 0 0 0 .922-1.597V7.562a1.846 1.846 0 0 0-.922-1.597l-8.667-4.998A1.833 1.833 0 0 0 11.998 0zm2.475 6.894c-2.686 0-3.293.852-3.293 2.268 0 .13.104.234.234.234h1.047c.116 0 .214-.084.229-.198.155-1.048.621-1.577 1.783-1.577.734 0 1.309.166 1.659.453.175.144.576.576.193 1.438-.354.798-1.111 1.029-2.051 1.321-1.768.547-2.748 1.199-2.748 2.771 0 1.229.729 2.315 2.771 2.315 1.948 0 2.883-.474 3.598-1.718.141.268.232.462.373.645.095.122.234.154.373.09l.986-.586a.235.235 0 0 0 .104-.313c-.227-.397-.274-.592-.274-1.048V9.506c0-1.831-1.111-2.612-3.984-2.612zm.235 3.594c1.229 0 2.107.267 2.621.792.259.265.357.569.357.96v.407c-.32 1.154-1.443 1.528-2.978 1.528-1.527 0-1.944-.48-1.944-1.14 0-.656.259-1.048 1.944-1.547z"/></svg>
  },
  {
    name: 'NativeScript',
    logo: <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-blue-600"><path d="M1.77 5.76L12 0l10.23 5.76v12.48L12 24 1.77 18.24V5.76zm2.58 1.5v9.48L12 21.24l7.65-4.5v-9.48L12 2.76 4.35 7.26zm2.58 1.49L12 12.5l5.07-3.75v7.5L12 19.99l-5.07-3.74v-7.5z"/></svg>
  },
  {
    name: 'Vue',
    logo: <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-green-500"><path d="M2 3h3.5L12 15l6.5-12H22L12 21 2 3m4.5 0h3L12 7.58 14.5 3h3L12 13.08 6.5 3z"/></svg>
  },
  {
    name: 'Angular',
    logo: <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-red-600"><path d="M12 2.5L3 6.56v4.07c0 5.28 3.62 10.25 9 11.44 5.38-1.19 9-6.16 9-11.44V6.56L12 2.5zm1 15.95h-2v-2h2v2zm0-4h-2v-6h2v6z"/></svg>
  }
];

export default function Home() {
  const [showText, setShowText] = useState(false);
  
  // Use custom animation hook
  const { containerRef } = useCharacterAnimation({
    animation: {
      name: 'idle',
      loop: true,
      fadeTime: 0.5,
      lookAtCamera: true,
    },
    camera: {
      position: { x: 0, y: 1.7, z: 1 },
      lookAt: { x: 0.5, y: 1.5, z: 0 },
      duration: 1500,
    },
  });

  useEffect(() => {
    // Show text after a delay
    setTimeout(() => {
      setShowText(true);
    }, 1000);
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
            I'm Cuong – Marcus
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
            I'm also capable of designing web and interesting assets to bring ideas to life. ✨
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
              animate={{
                x: [0, -1400],
              }}
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

        {/* Social Links */}
        {/* <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: showText ? 1 : 0, y: showText ? 0 : 20 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 justify-center sm:justify-end"
        >
          <a
            href="https://github.com/marcuscuongdoan"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center gap-3 px-5 py-3 bg-gradient-to-r from-blue-50/80 to-blue-100/80 hover:from-blue-100 hover:to-blue-200 border border-blue-200 rounded-lg transition-all duration-300 active:scale-95 sm:hover:scale-105 hover:shadow-lg hover:shadow-blue-300/30"
          >
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6 fill-blue-400 group-hover:fill-blue-500 transition-colors"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            <span className="font-medium text-sm sm:text-base text-blue-600 group-hover:text-blue-700 transition-colors">GitHub</span>
          </a>

          <a
            href="https://www.linkedin.com/in/marcus-cuong-doan/"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center gap-3 px-5 py-3 bg-gradient-to-r from-blue-200 to-blue-300 hover:from-blue-300 hover:to-blue-400 border border-blue-300 rounded-lg transition-all duration-300 active:scale-95 sm:hover:scale-105 hover:shadow-lg hover:shadow-blue-300/50"
          >
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6 fill-blue-600"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            <span className="font-medium text-sm sm:text-base text-blue-700">LinkedIn</span>
          </a>
        </motion.div> */}

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
