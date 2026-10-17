"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ProjectsMenu } from "@/components/ProjectSheet";
import ProjectsIcon from "@/components/ProjectsIcon";
import { Canvas } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import { track } from "@/lib/analytics";
import PlantScene from "@/components/plant-showroom/PlantScene";
import PlantPartPanel from "@/components/plant-showroom/PlantPartPanel";
import PlantHud from "@/components/plant-showroom/PlantHud";
import MatrixRain from "@/components/bike-showroom/MatrixRain";
import { getShowroomAudio } from "@/components/bike-showroom/showroomAudio";
import { PlantSim, partStatus } from "@/components/plant-showroom/plantSim";
import type { PlantDefinition } from "@/config/gasTurbine";

// Plant seconds per real second; the start sequence is 10 plant minutes
const RATES = [5, 15, 60];
const DEFAULT_RATE = 15;
// How often the page reads the simulation for the readouts
const POLL_MS = 125;

// The visitor's sound choice, shared with the bike showrooms (a convenience only)
const SOUND_KEY = "bike-showroom-sound";
const readSoundPref = () => {
  try {
    return localStorage.getItem(SOUND_KEY) === "1";
  } catch {
    return false;
  }
};
const writeSoundPref = (on: boolean) => {
  try {
    localStorage.setItem(SOUND_KEY, on ? "1" : "0");
  } catch {
    // Storage blocked: just don't remember
  }
};

function LoadingOverlay({ progress, title }: { progress: number; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0c0f14]">
      <p className="font-at text-3xl font-bold uppercase italic text-white">{title}</p>
      <div className="mt-4 h-1 w-56 overflow-hidden rounded-full bg-white/15">
        <div className="h-full bg-[#6fffd2] transition-[width] duration-300" style={{ width: `${Math.round(progress)}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500">{Math.round(progress)}%</p>
    </div>
  );
}

/**
 * Interactive plant showroom (see PlantDefinition): the unit in 3D with its
 * parts to open, and a station blackout to run — the turbine starts, picks up
 * the plant's safety buses and carries the shutdown loads, with the flows,
 * exhaust, readings and sound following the simulation.
 */
export default function PlantShowroom({ def }: { def: PlantDefinition }) {
  const PARTS = def.parts;
  const [sim] = useState(() => new PlantSim());
  const [snap, setSnap] = useState(sim.state);
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [showFlows, setShowFlows] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  // Readouts follow the simulation a few times a second, not every frame
  useEffect(() => {
    const id = setInterval(() => setSnap(sim.state), POLL_MS);
    return () => clearInterval(id);
  }, [sim]);
  const running = snap.mode !== "standby";

  const [soundOn, setSoundOn] = useState(false);
  const toggleSound = useCallback(() => {
    const next = !soundOn;
    // Inside the click: browsers only start audio from a user gesture
    getShowroomAudio().setEnabled(next);
    writeSoundPref(next);
    track("sound_toggle", { bike: def.slug, on: next });
    setSoundOn(next);
  }, [soundOn, def.slug]);
  useEffect(() => {
    if (!readSoundPref()) return;
    const resume = () => {
      getShowroomAudio().setEnabled(true);
      setSoundOn(true);
    };
    window.addEventListener("pointerdown", resume, { once: true });
    window.addEventListener("keydown", resume, { once: true });
    return () => {
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
    };
  }, []);

  const { active, progress } = useProgress();
  const [ready, setReady] = useState(false);
  const [introSkipped, setIntroSkipped] = useState(false);
  const [introDark, setIntroDark] = useState(true);
  const [introRunning, setIntroRunning] = useState(true);
  if (!ready && !active && progress >= 100) {
    setReady(true);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setIntroSkipped(true);
  }
  const handleIntroReveal = useCallback(() => setIntroDark(false), []);
  const handleIntroDone = useCallback(() => setIntroRunning(false), []);
  const mainRef = useRef<HTMLElement>(null);
  const busLabel = useRef<HTMLDivElement>(null);
  const handleIntroProgress = useCallback((p: number) => {
    mainRef.current?.style.setProperty("--at-intro", p.toFixed(3));
  }, []);
  const intro = ready && !introSkipped && introRunning;
  const introDim = ready && !introSkipped && introDark;

  const startRun = useCallback(() => {
    sim.start();
    setSnap(sim.state);
    track("plant_run", { plant: def.slug, rate });
  }, [sim, def.slug, rate]);
  const stopRun = useCallback(() => {
    sim.stop();
    setSnap(sim.state);
    track("plant_stop", { plant: def.slug });
  }, [sim, def.slug]);
  const skipStart = useCallback(() => {
    sim.skip();
    setSnap(sim.state);
  }, [sim]);

  // Pointer-out fires when crossing gaps between meshes; debounce the clear
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const introRef = useRef(intro);
  useEffect(() => {
    introRef.current = intro;
  });
  const handleHoverPart = useCallback((id: string | null) => {
    if (id && introRef.current) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    if (id) setHovered(id);
    else hoverTimer.current = setTimeout(() => setHovered(null), 80);
  }, []);
  useEffect(
    () => () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    },
    [],
  );

  const handleClickPart = useCallback(
    (id: string) => {
      if (!intro) setSelected(id);
    },
    [intro],
  );
  const close = useCallback(() => {
    setSelected(null);
    setResetKey((k) => k + 1);
  }, []);
  const handleEmpty = useCallback(() => {
    handleHoverPart(null);
    if (selected) close();
  }, [selected, close, handleHoverPart]);

  useEffect(() => {
    if (selected) track("part_open", { bike: def.slug, part: selected });
  }, [selected, def.slug]);

  const step = useCallback(
    (delta: number) =>
      setSelected((current) => {
        const i = PARTS.findIndex((p) => p.id === current);
        return PARTS[(i + delta + PARTS.length) % PARTS.length]!.id;
      }),
    [PARTS],
  );

  // Esc closes the panel; arrows step through parts while it's open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (introRef.current) return;
      if (e.key === "Escape" && selected) close();
      if (!selected) return;
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, close, step]);

  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);

  const selectedIndex = PARTS.findIndex((p) => p.id === selected);
  const selectedPart = selectedIndex >= 0 ? PARTS[selectedIndex] : null;
  const hoveredPart = PARTS.find((p) => p.id === hovered) ?? null;
  const starting = snap.mode === "starting";

  return (
    <main
      ref={mainRef}
      className="at-dark fixed inset-0 overflow-clip select-none bg-[var(--bk-night)]"
      onPointerMove={(e) => setCursor({ x: e.clientX, y: e.clientY })}
      onPointerLeave={() => setCursor(null)}
    >
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ fov: def.camera.fov, near: 0.05, far: 120, position: def.camera.position }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        style={{ pointerEvents: intro ? "none" : "auto" }}
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true;
        }}
        onPointerMissed={handleEmpty}
      >
        <Suspense fallback={null}>
          <PlantScene
            def={def}
            sim={sim}
            rate={rate}
            showFlows={showFlows}
            introActive={ready}
            introSkipped={introSkipped}
            introRunning={intro}
            onIntroReveal={handleIntroReveal}
            onIntroDone={handleIntroDone}
            onIntroProgress={handleIntroProgress}
            resetKey={resetKey}
            hovered={hovered}
            selected={selected}
            onHoverPart={handleHoverPart}
            onClickPart={handleClickPart}
            onClickEmpty={handleEmpty}
            busLabel={busLabel}
          />
        </Suspense>
      </Canvas>

      {/* Where the power leaves the pad: pinned to the scene each frame */}
      <div
        ref={busLabel}
        aria-hidden
        className="font-at pointer-events-none fixed left-0 top-0 z-10 whitespace-nowrap rounded-full border border-[#9d8cff]/60 bg-black/50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-[#cfc6ff] opacity-0 transition-opacity duration-500"
      >
        To safety buses →
      </div>

      {/* Header */}
      <header className="at-chrome at-reveal pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-4 md:p-8">
        <div>
          <p className="font-at text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 md:text-sm">
            {def.modelLine}
          </p>
          <h1 className="font-at text-4xl font-extrabold uppercase italic leading-[0.9] text-slate-900 md:text-6xl">
            {def.title}
          </h1>
          <div className="mt-2 flex h-1 w-28 overflow-hidden md:w-40">
            <span className="flex-1 bg-[var(--bk-stripe-1)]" />
            <span className="flex-1 bg-[var(--bk-stripe-2)]" />
            <span className="flex-1 bg-[var(--bk-stripe-3)]" />
          </div>
          <dl className="mt-4 hidden gap-6 lg:flex">
            {def.heroSpecs.map(([value, label]) => (
              <div key={label}>
                <dt className="font-at text-2xl font-bold italic text-slate-900">{value}</dt>
                <dd className="text-xs uppercase tracking-wider text-slate-500">{label}</dd>
              </div>
            ))}
          </dl>
          {/* Run state on small screens (the full panel is desktop-only) */}
          {running && !intro && (
            <div className="mt-3 xl:hidden">
              <PlantHud state={snap} compact />
            </div>
          )}
        </div>
        <div className="pointer-events-auto flex shrink-0 items-center gap-2">
          <Link
            href="/"
            className="font-at rounded-full border border-slate-300 bg-white/70 px-4 py-1.5 text-sm font-semibold uppercase tracking-wider text-slate-700 backdrop-blur transition-colors hover:border-slate-900 hover:text-slate-900"
          >
            ← Portfolio
          </Link>
          {/* Icon-only on phones, where the title needs the width */}
          <ProjectsMenu className="font-at flex items-center gap-2 rounded-full border border-slate-300 bg-white/70 px-2.5 py-2 text-sm font-semibold uppercase tracking-wider text-slate-700 backdrop-blur transition-colors hover:border-slate-900 hover:text-slate-900 md:px-4 md:py-1.5">
            <ProjectsIcon />
            <span className="hidden md:inline">Projects</span>
            <span className="sr-only md:hidden">Projects</span>
          </ProjectsMenu>
        </div>
      </header>

      <div className="at-chrome fixed right-4 top-[4.25rem] z-40 md:right-8 md:top-[5.5rem]">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={toggleSound}
          aria-pressed={soundOn}
          aria-label={soundOn ? "Mute sound" : "Turn sound on"}
          title={soundOn ? "Mute sound" : "Turn sound on"}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white/70 text-slate-700 backdrop-blur transition-colors hover:border-slate-900 hover:text-slate-900"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
            {soundOn ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="M17 9l5 6M22 9l-5 6" />}
          </svg>
        </button>
      </div>

      {/* Simulation panel — wide desktop, while no part is open */}
      {running && !selectedPart && !intro && (
        <div className="fixed right-8 top-[8.5rem] bottom-28 z-20 hidden flex-col xl:flex">
          <PlantHud state={snap} compact={false} />
        </div>
      )}

      {/* Parts list — desktop */}
      {!intro && (
        <nav
          aria-label="Parts"
          className="at-chrome at-scroll fixed left-8 top-1/2 z-20 hidden max-h-[56vh] w-60 -translate-y-[40%] overflow-y-auto pr-2 lg:block"
        >
          <ol className="space-y-0.5">
            {PARTS.map((part, i) => {
              const isActive = part.id === selected;
              const isHover = part.id === hovered;
              return (
                <li key={part.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(part.id)}
                    onPointerEnter={() => handleHoverPart(part.id)}
                    onPointerLeave={() => handleHoverPart(null)}
                    className={`group flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors ${
                      isActive ? "bg-slate-900 text-white" : isHover ? "bg-white text-slate-900" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span
                      className={`font-at text-xs font-semibold tabular-nums ${isActive ? "text-[var(--bk-accent-light)]" : "text-[var(--bk-accent)]"}`}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-at text-[15px] font-semibold uppercase tracking-wide">{part.name}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      {/* Parts chips — mobile / tablet */}
      {!selectedPart && !intro && (
        <nav
          aria-label="Parts"
          className="at-chrome at-scroll fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-20 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden"
        >
          {PARTS.map((part) => (
            <button
              key={part.id}
              type="button"
              onClick={() => setSelected(part.id)}
              className="font-at shrink-0 rounded-full border border-slate-300 bg-white/80 px-3 py-1 text-sm font-semibold uppercase tracking-wide text-slate-700 backdrop-blur"
            >
              {part.name}
            </button>
          ))}
        </nav>
      )}

      {/* Bottom bar: run / restore, speed, skip, flows */}
      {!selectedPart && !intro && (
        <div className="at-chrome pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] z-20 flex flex-col items-center gap-2 px-4">
          <div className="pointer-events-auto flex items-center justify-center gap-1.5 sm:gap-2 md:gap-3">
            {snap.mode === "standby" || snap.mode === "stopping" ? (
              <button
                type="button"
                onClick={startRun}
                className="font-at flex shrink-0 items-center gap-2 rounded-full bg-[var(--bk-accent)] px-4 py-2 sm:px-5 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-[var(--bk-accent-hover)]"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
                </svg>
                {/* One row has to fit a phone */}
                <span>
                  <span className="hidden sm:inline">Simulate </span>blackout
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRun}
                className="font-at flex shrink-0 items-center gap-2 rounded-full border border-[#9d8cff] bg-[#9d8cff] px-4 py-2 sm:px-5 text-sm font-bold uppercase tracking-widest text-[#120d2b] shadow-[0_0_18px_rgba(157,140,255,0.5)]"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                  <path d="M12 3v9M6.3 7.5a8 8 0 1 0 11.4 0" />
                </svg>
                <span>
                  Restore<span className="hidden sm:inline"> grid</span>
                </span>
              </button>
            )}
            {starting && (
              <button
                type="button"
                onClick={skipStart}
                aria-label="Skip to running"
                title="Skip to running"
                className="font-at rounded-full border border-slate-300 bg-white/80 px-3 py-2 text-sm font-bold uppercase tracking-widest text-slate-700 hover:border-slate-900"
              >
                <span className="hidden sm:inline">Skip </span>⇥
              </button>
            )}
            <div role="group" aria-label="Simulation speed" className="flex overflow-hidden rounded-full border border-slate-300 bg-white/80">
              {RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRate(r)}
                  aria-pressed={rate === r}
                  className={`font-at px-2 py-2 text-sm font-bold tabular-nums sm:px-2.5 transition-colors ${
                    rate === r ? "bg-slate-900 text-white" : "text-slate-700 hover:text-slate-900"
                  }`}
                >
                  ×{r}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowFlows((on) => !on)}
              aria-pressed={showFlows}
              title={showFlows ? "Hide the flows" : "Show the flows"}
              className={`font-at flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-bold uppercase tracking-widest transition-colors ${
                showFlows ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white/80 text-slate-700 hover:border-slate-900"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M3 8h11a3 3 0 1 0-3-3M3 16h15a3 3 0 1 1-3 3M3 12h18" strokeDasharray={showFlows ? "0" : "2 3"} />
              </svg>
              <span className="hidden md:inline">Flows</span>
            </button>
          </div>
          <p className="hidden text-xs uppercase tracking-widest text-slate-500 md:block">
            {running
              ? "Click any part to see what it's doing now"
              : "Click a part to see what it does · simulate a station blackout to start the unit"}
          </p>
        </div>
      )}

      {selectedPart && (
        <PlantPartPanel
          def={def}
          part={selectedPart}
          index={selectedIndex}
          total={PARTS.length}
          status={partStatus(selectedPart.id, snap)}
          running={running}
          onClose={close}
          onStep={step}
        />
      )}

      {hoveredPart && cursor && hoveredPart.id !== selected && (
        <div
          className="pointer-events-none fixed z-40 rounded-md bg-slate-900 px-2.5 py-1 text-white shadow-lg"
          style={{ left: cursor.x + 16, top: cursor.y + 16 }}
        >
          <p className="font-at text-sm font-bold uppercase tracking-wide">{hoveredPart.name}</p>
          <p className="text-[11px] text-white/70">{running ? partStatus(hoveredPart.id, snap) : hoveredPart.kicker}</p>
        </div>
      )}

      {/* Under the parts list, clear of the centred controls */}
      <p className="at-chrome at-reveal pointer-events-none fixed bottom-6 left-8 z-10 hidden w-60 text-[10px] leading-snug text-slate-400 lg:block">
        Part roles read from the 3D model; figures from the NRC rules and public sources (turbine: GE LM2500 as a
        reference), not any specific plant. The run is an illustrative simulation.
      </p>

      {intro && <MatrixRain active={introDim} />}
      {intro && (
        <button
          type="button"
          onClick={() => {
            track("intro_skip", { bike: def.slug });
            setIntroSkipped(true);
          }}
          className="font-at fixed bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] left-1/2 z-30 -translate-x-1/2 rounded-full border border-[#6fffd2]/50 bg-black/30 px-5 py-1.5 text-sm font-semibold uppercase tracking-widest text-[#bfffea] backdrop-blur transition-colors hover:border-[#6fffd2] hover:text-white"
        >
          Skip intro
        </button>
      )}

      {!ready && <LoadingOverlay progress={progress} title={def.title} />}
    </main>
  );
}
