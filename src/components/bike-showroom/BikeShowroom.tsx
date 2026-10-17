"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import Link from "next/link";
import { ProjectsMenu } from "@/components/ProjectSheet";
import ProjectsIcon from "@/components/ProjectsIcon";
import { Canvas } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import BikeScene from "@/components/bike-showroom/BikeScene";
import PartPanel from "@/components/bike-showroom/PartPanel";
import MatrixRain from "@/components/bike-showroom/MatrixRain";
import { BikeProvider } from "@/components/bike-showroom/BikeContext";
import { getShowroomAudio } from "@/components/bike-showroom/showroomAudio";
import type { BikeDefinition } from "@/config/bikeShowroom";

type PartId = string;

// How long the ride scenery gets to clear before the bike splits apart
const RIDE_CLEAR_MS = 300;
// The visitor's sound choice, remembered across visits (a convenience only)
const SOUND_KEY = "bike-showroom-sound";
const readSoundPref = () => {
  try {
    return localStorage.getItem(SOUND_KEY) === "1";
  } catch {
    return false;
  }
};
// The visitor's colour choice per bike (a convenience only)
const liveryKey = (slug: string) => `bike-showroom-livery:${slug}`;
const readLivery = (slug: string) => {
  try {
    return localStorage.getItem(liveryKey(slug));
  } catch {
    return null;
  }
};
const writeLivery = (slug: string, id: string) => {
  try {
    localStorage.setItem(liveryKey(slug), id);
  } catch {
    // Storage blocked: just don't remember
  }
};
// Swatch fill: the main colour with the others as diagonal bands
const swatchFill = (colours: string[]) => {
  const [a, b = a, c = b] = colours;
  return `linear-gradient(135deg, ${a} 0 52%, ${b} 52% 76%, ${c} 76% 100%)`;
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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#121419]">
      <p className="font-at text-3xl font-bold uppercase italic text-white">{title}</p>
      <div className="mt-4 h-1 w-56 overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full bg-[#6fffd2] transition-[width] duration-300"
          style={{ width: `${Math.round(progress)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">{Math.round(progress)}%</p>
    </div>
  );
}

/**
 * Interactive showroom for one bike (see BikeDefinition): the 3D scene, the
 * header with headline specs, the parts list, the part panel, the bottom
 * controls (explode, lights, ride, scene) and the hologram intro.
 */
export default function BikeShowroom({ bike: def }: { bike: BikeDefinition }) {
  const BIKE_PARTS = def.parts;
  const [hovered, setHovered] = useState<PartId | null>(null);
  const [selected, setSelected] = useState<PartId | null>(null);
  // Clicking the bike takes it apart; hovering only outlines parts
  const [explodedState, setExploded] = useState(false);
  const exploded = explodedState || selected !== null;
  // Zooming in also spreads the parts; past a point that counts as apart
  const [zoomExploded, setZoomExploded] = useState(false);
  const apart = exploded || zoomExploded;
  // Bumped to send the camera back to the overview
  const [resetKey, setResetKey] = useState(0);
  // The bike's lights; the studio goes dark while they're on. Assembled
  // only: taking the bike apart switches them off until it's back together
  const [lightsOn, setLightsOn] = useState(false);
  const lightsActive = lightsOn && !apart;
  // Ride simulation, also assembled-only
  const [rideOn, setRideOn] = useState(false);
  // Exploding mid-ride first holds the ride (the scenery clears), then splits
  // the bike; reassembling resumes the ride
  const [rideHold, setRideHold] = useState(false);
  const riding = rideOn && !apart && !rideHold;
  // Showroom garage / ride scenery behind the bike; off = plain studio
  const [backdropOn, setBackdropOn] = useState(true);
  // Colour scheme, and whether the colour picker is open
  const LIVERIES = def.paint.liveries;
  const [livery, setLivery] = useState(LIVERIES[0]!.id);
  const [paintOpen, setPaintOpen] = useState(false);
  const currentLivery = LIVERIES.find((l) => l.id === livery) ?? LIVERIES[0]!;
  const chooseLivery = useCallback(
    (id: string) => {
      setLivery(id);
      writeLivery(def.slug, id);
      track("livery_change", { bike: def.slug, livery: id });
    },
    [def.slug],
  );
  // Synthesised sound (intro + engine), off by default
  const [soundOn, setSoundOn] = useState(false);
  const toggleSound = useCallback(() => {
    const next = !soundOn;
    // Inside the click: browsers only start audio from a user gesture
    getShowroomAudio().setEnabled(next);
    writeSoundPref(next);
    track("sound_toggle", { bike: def.slug, on: next });
    setSoundOn(next);
  }, [soundOn, def.slug]);
  // Sound was on last visit: turn it back on at the first interaction (it
  // can't start before one)
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
  // Hologram intro: runs once loading finishes, unless the visitor prefers
  // reduced motion. `introDark` covers the part before the scan brings the
  // studio lights back; `introRunning` the whole thing
  const [introSkipped, setIntroSkipped] = useState(false);
  const [introDark, setIntroDark] = useState(true);
  const [introRunning, setIntroRunning] = useState(true);
  if (!ready && !active && progress >= 100) {
    setReady(true);
    // The colour picked last visit (client only: storage isn't there on the
    // server render)
    const saved = readLivery(def.slug);
    if (saved && LIVERIES.some((l) => l.id === saved)) setLivery(saved);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setIntroSkipped(true);
  }
  // Phases come from the scene's own clock, so the UI stays in sync with it
  const handleIntroReveal = useCallback(() => setIntroDark(false), []);
  const handleIntroDone = useCallback(() => setIntroRunning(false), []);
  // Header text sharpens with the model: written straight to a CSS variable
  // every frame instead of through React state
  const mainRef = useRef<HTMLElement>(null);
  const handleIntroProgress = useCallback((progress: number) => {
    mainRef.current?.style.setProperty("--at-intro", progress.toFixed(3));
  }, []);
  const intro = ready && !introSkipped && introRunning;
  const introDim = ready && !introSkipped && introDark;

  // Pointer-out fires when crossing gaps between meshes; debounce the clear
  // so the outline doesn't flicker
  const partTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const introRef = useRef(intro);
  useEffect(() => {
    introRef.current = intro;
  });
  const handleHoverPart = useCallback((id: PartId | null) => {
    if (id && introRef.current) return;
    if (partTimer.current) clearTimeout(partTimer.current);
    partTimer.current = null;
    if (id) setHovered(id);
    else partTimer.current = setTimeout(() => setHovered(null), 80);
  }, []);
  useEffect(
    () => () => {
      if (partTimer.current) clearTimeout(partTimer.current);
    },
    [],
  );

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    [],
  );
  // Run `split` (anything that takes the bike apart) — after the ride scenery
  // has cleared, if a ride is on
  const ridingRef = useRef(riding);
  useEffect(() => {
    ridingRef.current = riding;
  });
  const afterRideClears = useCallback((split: () => void) => {
    if (!ridingRef.current) {
      split();
      return;
    }
    setRideHold(true);
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      split();
      setRideHold(false);
    }, RIDE_CLEAR_MS);
  }, []);
  const explode = useCallback(() => afterRideClears(() => setExploded(true)), [afterRideClears]);

  const handleSelect = useCallback(
    (id: PartId) =>
      afterRideClears(() => {
        setExploded(true);
        setSelected(id);
      }),
    [afterRideClears],
  );
  // First click takes the bike apart; once apart, a click opens the part
  const handleClickPart = useCallback(
    (id: PartId) => {
      if (intro) return;
      if (apart) setSelected(id);
      else explode();
    },
    [apart, intro, explode],
  );
  // Closing the panel keeps the bike apart, ready for the next part
  const handleClose = useCallback(() => setSelected(null), []);
  // Also zooms back out, which collapses any zoom spread
  const assemble = useCallback(() => {
    setSelected(null);
    setExploded(false);
    setResetKey((k) => k + 1);
  }, []);
  // Empty space steps back: close the panel, then reassemble
  const handleMissed = useCallback(() => {
    handleHoverPart(null);
    if (selected) setSelected(null);
    else if (apart) assemble();
  }, [selected, apart, assemble, handleHoverPart]);
  // Analytics: one event per part opened (click, list or arrow keys), and per
  // explode / reassemble (button, click or zoom)
  useEffect(() => {
    if (selected) track("part_open", { bike: def.slug, part: selected });
  }, [selected, def.slug]);
  const wasApart = useRef(false);
  useEffect(() => {
    if (apart === wasApart.current) return;
    wasApart.current = apart;
    track(apart ? "bike_explode" : "bike_assemble", {
      bike: def.slug,
      via: zoomExploded && !exploded ? "zoom" : "click",
    });
  }, [apart, exploded, zoomExploded, def.slug]);

  const step = useCallback(
    (delta: number) => {
      setSelected((current) => {
        const i = BIKE_PARTS.findIndex((p) => p.id === current);
        return BIKE_PARTS[(i + delta + BIKE_PARTS.length) % BIKE_PARTS.length]!.id;
      });
    },
    [BIKE_PARTS],
  );

  // Esc closes the panel; arrows step through parts while it's open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (introRef.current) return;
      if (e.key === "Escape") {
        setPaintOpen(false);
        if (selected) setSelected(null);
        else if (apart) assemble();
      }
      if (!selected) return;
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, apart, assemble, step]);

  // Name tag that follows the cursor over a part
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);

  const credit = def.sources[def.credit.source];
  const selectedIndex = BIKE_PARTS.findIndex((p) => p.id === selected);
  const selectedPart = selectedIndex >= 0 ? BIKE_PARTS[selectedIndex] : null;
  const hoveredPart = BIKE_PARTS.find((p) => p.id === hovered) ?? null;

  return (
    <BikeProvider value={def}>
    {/* overflow-clip, not overflow-hidden: a hidden overflow is still a
        scroll container that focusing a button can scroll */}
    <main
      ref={mainRef}
      className={`fixed inset-0 overflow-clip select-none transition-colors duration-700 ${
        def.theme.dark || lightsActive || introDim || !ready
          ? "at-dark bg-[var(--bk-night)]"
          : "bg-[var(--bk-day)]"
      }`}
      onPointerMove={(e) => setCursor({ x: e.clientX, y: e.clientY })}
      onPointerLeave={() => setCursor(null)}
    >
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{
          fov: def.camera.fov,
          near: 0.05,
          far: 100,
          position: def.camera.position,
        }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        // Nothing reaches the scene until the intro is over
        style={{ pointerEvents: intro ? "none" : "auto" }}
        // The intro's scan reveals the bike through a clipping plane
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true;
        }}
        onPointerMissed={handleMissed}
      >
        <Suspense fallback={null}>
          <BikeScene
            exploded={exploded}
            apart={apart}
            lightsOn={lightsActive}
            riding={riding}
            backdrop={backdropOn}
            livery={livery}
            introActive={ready}
            introSkipped={introSkipped}
            introRunning={intro}
            onIntroReveal={handleIntroReveal}
            onIntroDone={handleIntroDone}
            onIntroProgress={handleIntroProgress}
            resetKey={resetKey}
            onZoomExplode={setZoomExploded}
            hovered={hovered}
            selected={selected}
            onHoverPart={handleHoverPart}
            onClickPart={handleClickPart}
          />
        </Suspense>
      </Canvas>

      {/* Header */}
      <header className="at-chrome at-reveal pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-4 md:p-8">
        <div>
          <p className="font-at text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 md:text-sm">
            {def.modelLine} · {def.year}
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
                <dt className="font-at text-2xl font-bold italic text-slate-900">
                  {value}
                </dt>
                <dd className="text-xs uppercase tracking-wider text-slate-500">
                  {label}
                </dd>
              </div>
            ))}
          </dl>
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

      {/* Sound toggle: outside the header, which is faded out during the
          intro — the intro has sound too */}
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
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
          {soundOn ? (
            <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
          ) : (
            <path d="M17 9l5 6M22 9l-5 6" />
          )}
        </svg>
      </button>
      </div>

      {/* Parts list — desktop */}
      {!intro && (
      <nav
        aria-label="Parts"
        className="at-chrome at-scroll fixed left-8 top-1/2 z-20 hidden max-h-[56vh] w-56 -translate-y-[40%] overflow-y-auto pr-2 lg:block"
      >
        <ol className="space-y-0.5">
          {BIKE_PARTS.map((part, i) => {
            const isActive = part.id === selected;
            const isHover = part.id === hovered;
            return (
              <li key={part.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(part.id)}
                  onPointerEnter={() => handleHoverPart(part.id)}
                  onPointerLeave={() => handleHoverPart(null)}
                  className={`group flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : isHover
                        ? "bg-white text-slate-900"
                        : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span
                    className={`font-at text-xs font-semibold tabular-nums ${isActive ? "text-[var(--bk-accent-light)]" : "text-[var(--bk-accent)]"}`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-at text-[15px] font-semibold uppercase tracking-wide">
                    {part.name}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      )}

      {/* Parts chips — mobile / tablet */}
      {!selectedPart && !intro && !paintOpen && (
        <nav
          aria-label="Parts"
          className="at-chrome at-scroll fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-20 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden"
        >
          {BIKE_PARTS.map((part) => (
            <button
              key={part.id}
              type="button"
              onClick={() => handleSelect(part.id)}
              className="font-at shrink-0 rounded-full border border-slate-300 bg-white/80 px-3 py-1 text-sm font-semibold uppercase tracking-wide text-slate-700 backdrop-blur"
            >
              {part.name}
            </button>
          ))}
        </nav>
      )}

      {/* Colour picker: the maker's current colours */}
      {paintOpen && !apart && !selectedPart && !intro && (
        <div
          id="bike-colours"
          role="group"
          aria-label="Colours"
          className="at-chrome at-panel fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-30 mx-auto max-w-md rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-xl backdrop-blur md:inset-x-auto md:bottom-auto md:right-8 md:top-1/2 md:w-72 md:-translate-y-1/2"
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-at text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Colour
            </p>
            <a
              href={def.sources[def.paint.source]?.url}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-slate-400 underline"
            >
              {def.brand} colours
            </a>
          </div>
          <p className="font-at mt-1 text-xl font-bold uppercase italic leading-tight text-slate-900">
            {currentLivery.name}
          </p>
          <p className="h-4 text-xs text-slate-500">{currentLivery.note ?? `${def.title} ${def.year}`}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {LIVERIES.map((l) => {
              const isActive = l.id === livery;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => chooseLivery(l.id)}
                  aria-pressed={isActive}
                  aria-label={l.note ? `${l.name} (${l.note})` : l.name}
                  title={l.note ? `${l.name} · ${l.note}` : l.name}
                  // An outline, not a ring: its offset gap stays see-through
                  // on both the light and the dark panel
                  className={`h-10 w-10 rounded-full ring-1 ring-slate-400/50 transition-transform hover:scale-110 ${
                    isActive ? "outline-2 outline-offset-2 outline-[var(--bk-accent)]" : ""
                  }`}
                  style={{ background: swatchFill(l.swatch) }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom bar: hint + explode toggle */}
      {!selectedPart && !intro && (
        <div className="at-chrome fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] z-20 flex flex-col items-center gap-2 px-4">
          <div className="flex items-center gap-2 md:gap-3">
            <button
              type="button"
              onClick={() => (apart ? assemble() : explode())}
              aria-pressed={apart}
              className={`font-at rounded-full px-5 py-2 text-sm font-bold uppercase tracking-widest transition-colors ${
                apart
                  ? "bg-slate-900 text-white"
                  : "bg-[var(--bk-accent)] text-white hover:bg-[var(--bk-accent-hover)]"
              }`}
            >
              {apart ? "Assemble" : "Explode"}
            </button>
            {!apart && (
              <button
                type="button"
                onClick={() => {
                  track("lights_toggle", { bike: def.slug, on: !lightsOn });
                  setLightsOn((on) => !on);
                }}
                aria-pressed={lightsOn}
                aria-label={
                  lightsOn ? "Turn the lights off" : "Turn the lights on"
                }
                className={`font-at flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-bold uppercase tracking-widest transition-colors sm:px-4 ${
                  lightsOn
                    ? "border-[#ffd27a] bg-[#ffd27a] text-[#1a1408] shadow-[0_0_18px_rgba(255,210,122,0.6)]"
                    : "border-slate-300 bg-white/80 text-slate-700 hover:border-slate-900"
                }`}
              >
                {/* Headlight icon: lamp with beam lines */}
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                >
                  <path
                    d="M10 6a6 6 0 0 0 0 12z"
                    fill={lightsOn ? "currentColor" : "none"}
                  />
                  <path
                    d="M14 8h7M14 12h7M14 16h7"
                    opacity={lightsOn ? 1 : 0.35}
                  />
                </svg>
                {/* Icon only on phones: five buttons have to fit one row */}
                <span className="hidden sm:inline">Lights</span>
              </button>
            )}
            {!apart && (
              <button
                type="button"
                onClick={() => {
                  track(rideOn ? "ride_stop" : "ride_start", { bike: def.slug, scene: backdropOn });
                  setRideOn((on) => !on);
                }}
                aria-pressed={rideOn}
                aria-label={rideOn ? "Stop the ride" : "Simulate riding"}
                className={`font-at flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-bold uppercase tracking-widest transition-colors sm:px-4 ${
                  rideOn
                    ? "border-[var(--bk-accent-2)] bg-[var(--bk-accent-2)] text-white shadow-[0_0_18px_var(--bk-accent-2-glow)]"
                    : "border-slate-300 bg-white/80 text-slate-700 hover:border-slate-900"
                }`}
              >
                {/* Wheel icon, spinning while riding */}
                <svg
                  viewBox="0 0 24 24"
                  className={`h-4 w-4 ${rideOn ? "animate-spin" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" opacity={0.6} />
                </svg>
                <span className="hidden sm:inline">{rideOn ? "Stop" : "Ride"}</span>
              </button>
            )}
            {!apart && (
              <button
                type="button"
                onClick={() => {
                  track("scene_toggle", { bike: def.slug, on: !backdropOn });
                  setBackdropOn((on) => !on);
                }}
                aria-pressed={backdropOn}
                aria-label={backdropOn ? "Hide the background" : "Show the background"}
                title={backdropOn ? "Hide the background" : "Show the background"}
                className={`font-at flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-bold uppercase tracking-widest transition-colors md:px-4 ${
                  backdropOn
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white/80 text-slate-700 hover:border-slate-900"
                }`}
              >
                {/* Landscape icon: a framed scene, struck through when off */}
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 16l5-5 4 4 3-3 6 6" />
                  {!backdropOn && <path d="M4 4l16 16" />}
                </svg>
                <span className="hidden md:inline">Scene</span>
              </button>
            )}
            {!apart && (
              <button
                type="button"
                onClick={() => setPaintOpen((open) => !open)}
                aria-expanded={paintOpen}
                aria-controls="bike-colours"
                aria-label={`Colour: ${currentLivery.name}`}
                title={`Colour: ${currentLivery.name}`}
                className={`font-at flex items-center gap-2 rounded-full border px-2.5 py-2 text-sm font-bold uppercase tracking-widest transition-colors md:px-4 ${
                  paintOpen
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white/80 text-slate-700 hover:border-slate-900"
                }`}
              >
                <span
                  aria-hidden
                  className="h-4 w-4 rounded-full ring-1 ring-black/20"
                  style={{ background: swatchFill(currentLivery.swatch) }}
                />
                <span className="hidden md:inline">Colour</span>
              </button>
            )}
            <p className="hidden text-xs uppercase tracking-widest text-slate-500 md:block">
              {apart
                ? "Click a part for details · scroll to spread further · click empty space to reassemble"
                : `Click or scroll into the ${def.noun ?? "bike"} to take it apart`}
            </p>
          </div>
        </div>
      )}

      {selectedPart && (
        <PartPanel
          part={selectedPart}
          index={selectedIndex}
          total={BIKE_PARTS.length}
          onClose={handleClose}
          onStep={step}
        />
      )}

      {/* Cursor name tag */}
      {hoveredPart && cursor && hoveredPart.id !== selected && (
        <div
          className="pointer-events-none fixed z-40 rounded-md bg-slate-900 px-2.5 py-1 text-white shadow-lg"
          style={{ left: cursor.x + 16, top: cursor.y + 16 }}
        >
          <p className="font-at text-sm font-bold uppercase tracking-wide">
            {hoveredPart.name}
          </p>
          <p className="text-[11px] text-white/70">
            {apart ? hoveredPart.kicker : `Click to take the ${def.noun ?? "bike"} apart`}
          </p>
        </div>
      )}

      <p className="at-chrome at-reveal pointer-events-none fixed bottom-2 right-3 z-10 hidden text-[10px] text-slate-400 md:block">
        Specs:{" "}
        <a
          href={credit?.url}
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto underline"
        >
          {def.credit.name}
        </a>{" "}
        ({def.year} model) · fan project, not affiliated with {def.brand}
        {def.modelCredit && (
          <>
            {" · 3D model: "}
            <a
              href={def.modelCredit.url}
              target="_blank"
              rel="noreferrer"
              className="pointer-events-auto underline"
            >
              “{def.modelCredit.title}” by {def.modelCredit.author}
            </a>{" "}
            ({def.modelCredit.license})
          </>
        )}
      </p>

      {/* Hologram intro: digital rain until the scan, and a way out */}
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
    </BikeProvider>
  );
}
