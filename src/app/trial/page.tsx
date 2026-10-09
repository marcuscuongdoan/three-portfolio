"use client";

import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Canvas } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import TrialScene from "@/components/trial/TrialScene";
import TrialLegendPanel from "@/components/trial/TrialLegendPanel";
import {
  isDaytime,
  LEGENDS,
  LegendId,
  TimeOfDay,
  TRIAL_CAMERA,
  TRIAL_INTRO,
} from "@/config/trial";

const INITIAL_SKINS: Record<LegendId, number> = {
  "miss-fortune": 0,
  ezreal: 0,
  kayle: 0,
};

// Local clock, re-read every minute; null on the server so nothing renders
// with a guessed time of day
const subscribeClock = (onChange: () => void) => {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
};
const readClock = (): TimeOfDay => (isDaytime() ? "day" : "night");
const readServerClock = (): TimeOfDay | null => null;

// Only covers the first load — later skin downloads show in the panel instead
function LoadingOverlay({ progress }: { progress: number }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#1a1230]">
      <p className="font-lol text-2xl trial-gold-text">Gathering legends…</p>
      <div className="mt-4 h-1.5 w-56 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-[#c58a1c] to-[#f8d26a] transition-[width] duration-300"
          style={{ width: `${Math.round(progress)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-white/50">{Math.round(progress)}%</p>
    </div>
  );
}

function TimeToggle({ value, onChange }: { value: TimeOfDay; onChange: (v: TimeOfDay) => void }) {
  const isDay = value === "day";
  return (
    <button
      type="button"
      onClick={() => onChange(isDay ? "night" : "day")}
      aria-label={isDay ? "Switch to night" : "Switch to day"}
      title={isDay ? "Switch to night" : "Switch to day"}
      className="relative flex h-8 w-16 items-center rounded-full border border-[#c8a04a]/70 bg-black/40 px-1 transition-colors hover:border-[#f8d26a]"
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full shadow-md transition-all duration-300 ${
          isDay ? "translate-x-8 bg-[#ffd75e] text-[#8a5a00]" : "translate-x-0 bg-[#3a2c6e] text-[#e6ddff]"
        }`}
      >
        {isDay ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <circle cx="12" cy="12" r="4" fill="currentColor" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
          </svg>
        )}
      </span>
    </button>
  );
}

export default function TrialPage() {
  const [hoveredId, setHoveredId] = useState<LegendId | null>(null);
  const [focusedId, setFocusedId] = useState<LegendId | null>(null);
  const [skins, setSkins] = useState(INITIAL_SKINS);
  const [skinLoading, setSkinLoading] = useState<Partial<Record<LegendId, boolean>>>({});

  // First load: overlay until every GLB is in, then the legends spawn
  const { active, progress } = useProgress();
  const [ready, setReady] = useState(false);
  if (!ready && !active && progress >= 100) setReady(true);

  // Labels and HUD wait for the intro camera to land
  const [introDone, setIntroDone] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => setIntroDone(true), TRIAL_INTRO.durationMs);
    return () => clearTimeout(id);
  }, [ready]);

  // Coming back to the tab replays the entrance
  const [spawnRound, setSpawnRound] = useState(0);
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") setSpawnRound((round) => round + 1);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Follows the local clock until the visitor flips the toggle
  const clockTime = useSyncExternalStore(subscribeClock, readClock, readServerClock);
  const [timeOverride, setTimeOverride] = useState<TimeOfDay | null>(null);
  const timeOfDay = timeOverride ?? clockTime;

  // The cursor crossing the hit capsule's edge fires out → over in quick
  // succession; debounce the clear so the outline doesn't flicker
  const hoverClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleHover = useCallback((id: LegendId | null) => {
    if (hoverClearTimer.current) {
      clearTimeout(hoverClearTimer.current);
      hoverClearTimer.current = null;
    }
    if (id) {
      setHoveredId(id);
      return;
    }
    hoverClearTimer.current = setTimeout(() => {
      hoverClearTimer.current = null;
      setHoveredId(null);
    }, 80);
  }, []);

  const handleSelect = useCallback((id: LegendId) => {
    setHoveredId(null);
    setFocusedId(id);
  }, []);

  const handleBack = useCallback(() => setFocusedId(null), []);

  const handleSkinLoading = useCallback((id: LegendId, loading: boolean) => {
    setSkinLoading((prev) => (prev[id] === loading ? prev : { ...prev, [id]: loading }));
  }, []);

  useEffect(
    () => () => {
      if (hoverClearTimer.current) clearTimeout(hoverClearTimer.current);
    },
    [],
  );

  // Esc behaves like the Back button
  useEffect(() => {
    if (!focusedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusedId, handleBack]);

  useEffect(() => {
    document.body.style.cursor = hoveredId && !focusedId ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hoveredId, focusedId]);

  const focused = focusedId ? LEGENDS[focusedId] : null;
  const hovered = hoveredId ? LEGENDS[hoveredId] : null;

  // overflow-clip, not overflow-hidden: a hidden overflow is still a scroll
  // container, and focusing a button scrolled it — shifting the canvas up and
  // pushing the bottom buttons out of view
  return (
    <main className="fixed inset-0 overflow-clip select-none">
      {/* Mounted once the local time is known, so the camp never flashes the wrong sky */}
      {timeOfDay && (
        <Canvas
          shadows
          dpr={[1, 1.75]}
          camera={{ fov: TRIAL_CAMERA.fov, near: 0.1, far: 200, position: TRIAL_INTRO.startPosition }}
          gl={{ antialias: false, powerPreference: "high-performance" }}
          onPointerMissed={() => handleHover(null)}
        >
          <color attach="background" args={["#1a1230"]} />
          <Suspense fallback={null}>
            <TrialScene
              hoveredId={hoveredId}
              focusedId={focusedId}
              skins={skins}
              timeOfDay={timeOfDay}
              ready={ready}
              introDone={introDone}
              spawnRound={spawnRound}
              onHover={handleHover}
              onSelect={handleSelect}
              onSkinLoading={handleSkinLoading}
            />
          </Suspense>
        </Canvas>
      )}

      {/* Top menu bar */}
      <header className="trial-topbar fixed inset-x-0 top-0 z-20 grid h-14 grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-8">
        <span className="font-lol text-xl sm:text-2xl font-black tracking-wide trial-gold-text">
          Legends Trial
        </span>
        <span className="hidden sm:block font-lol text-sm tracking-[0.3em] uppercase text-[#f8e7b5]/80">
          {focused ? focused.skin.name : "Choose your legend"}
        </span>
        <div className="flex justify-end">
          {timeOfDay && <TimeToggle value={timeOfDay} onChange={setTimeOverride} />}
        </div>
      </header>

      {focused ? (
        <>
          <TrialLegendPanel
            legend={focused}
            skinIndex={skins[focused.id]}
            skinLoading={!!skinLoading[focused.id]}
            onSkinChange={(index) => setSkins((prev) => ({ ...prev, [focused.id]: index }))}
          />
          <button
            type="button"
            onClick={handleBack}
            className="trial-button trial-fade-in fixed z-30 top-[68px] left-4 px-6 py-1.5 text-sm sm:top-auto sm:bottom-[calc(env(safe-area-inset-bottom)+2.5rem)] sm:left-8 sm:px-8 sm:py-2 sm:text-base"
          >
            Back
          </button>
        </>
      ) : (
        <>
          {/* Hovered legend's name, like the client's campfire nameplate */}
          <div
            className={`pointer-events-none fixed transition-opacity duration-700 ${introDone ? "opacity-100" : "opacity-0"} inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] sm:bottom-[calc(env(safe-area-inset-bottom)+2.5rem)] z-20 flex flex-col items-center gap-1`}
          >
            <p
              key={hovered?.id ?? "none"}
              className="trial-fade-in font-lol text-3xl sm:text-4xl font-bold trial-gold-text"
            >
              {hovered ? hovered.name : " "}
            </p>
            <p className="text-xs sm:text-sm tracking-widest uppercase text-white/70 trial-shadow-text">
              {hovered ? hovered.title : "Click a legend to inspect"}
            </p>
          </div>
          <Link
            href="/"
            className="trial-button fixed z-30 bottom-[calc(env(safe-area-inset-bottom)+2.5rem)] left-4 sm:left-8 px-6 py-2 text-sm"
          >
            Portfolio
          </Link>
        </>
      )}

      {!ready && <LoadingOverlay progress={progress} />}
    </main>
  );
}
