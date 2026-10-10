"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Canvas } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import BikeScene from "@/components/africa-twin/BikeScene";
import PartPanel from "@/components/africa-twin/PartPanel";
import {
  AFRICA_TWIN_CAMERA,
  BIKE_PARTS,
  HERO_SPECS,
  PartId,
  SOURCES,
} from "@/config/africaTwin";

function LoadingOverlay({ progress }: { progress: number }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#e8eaed]">
      <p className="font-at text-3xl font-bold uppercase italic text-slate-900">Africa Twin</p>
      <div className="mt-4 h-1 w-56 overflow-hidden rounded-full bg-slate-300">
        <div
          className="h-full bg-[#e4002b] transition-[width] duration-300"
          style={{ width: `${Math.round(progress)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">{Math.round(progress)}%</p>
    </div>
  );
}

export default function AfricaTwinPage() {
  const [hovered, setHovered] = useState<PartId | null>(null);
  const [selected, setSelected] = useState<PartId | null>(null);
  // Clicking the bike takes it apart; hovering only outlines parts
  const [explodedState, setExploded] = useState(false);
  const exploded = explodedState || selected !== null;

  const { active, progress } = useProgress();
  const [ready, setReady] = useState(false);
  if (!ready && !active && progress >= 100) setReady(true);

  // Pointer-out fires when crossing gaps between meshes; debounce the clear
  // so the outline doesn't flicker
  const partTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleHoverPart = useCallback((id: PartId | null) => {
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

  const handleSelect = useCallback((id: PartId) => {
    setExploded(true);
    setSelected(id);
  }, []);
  // First click takes the bike apart; once apart, a click opens the part
  const handleClickPart = useCallback(
    (id: PartId) => {
      if (exploded) setSelected(id);
      else setExploded(true);
    },
    [exploded],
  );
  // Closing the panel keeps the bike apart, ready for the next part
  const handleClose = useCallback(() => setSelected(null), []);
  const assemble = useCallback(() => {
    setSelected(null);
    setExploded(false);
  }, []);
  // Empty space steps back: close the panel, then reassemble
  const handleMissed = useCallback(() => {
    handleHoverPart(null);
    if (selected) setSelected(null);
    else setExploded(false);
  }, [selected, handleHoverPart]);
  const step = useCallback((delta: number) => {
    setSelected((current) => {
      const i = BIKE_PARTS.findIndex((p) => p.id === current);
      return BIKE_PARTS[(i + delta + BIKE_PARTS.length) % BIKE_PARTS.length]!.id;
    });
  }, []);

  // Esc closes the panel; arrows step through parts while it's open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selected) setSelected(null);
        else setExploded(false);
      }
      if (!selected) return;
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, step]);

  // Name tag that follows the cursor over a part
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);

  const selectedIndex = BIKE_PARTS.findIndex((p) => p.id === selected);
  const selectedPart = selectedIndex >= 0 ? BIKE_PARTS[selectedIndex] : null;
  const hoveredPart = BIKE_PARTS.find((p) => p.id === hovered) ?? null;

  return (
    // overflow-clip, not overflow-hidden: a hidden overflow is still a scroll
    // container that focusing a button can scroll
    <main
      className="fixed inset-0 overflow-clip select-none bg-[#e8eaed]"
      onPointerMove={(e) => setCursor({ x: e.clientX, y: e.clientY })}
      onPointerLeave={() => setCursor(null)}
    >
      <Canvas
        dpr={[1, 1.75]}
        camera={{ fov: AFRICA_TWIN_CAMERA.fov, near: 0.05, far: 100, position: AFRICA_TWIN_CAMERA.position }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        onPointerMissed={handleMissed}
      >
        <Suspense fallback={null}>
          <BikeScene
            exploded={exploded}
            hovered={hovered}
            selected={selected}
            onHoverPart={handleHoverPart}
            onClickPart={handleClickPart}
          />
        </Suspense>
      </Canvas>

      {/* Header */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-4 md:p-8">
        <div>
          <p className="font-at text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 md:text-sm">
            Honda CRF1100L · 2026
          </p>
          <h1 className="font-at text-4xl font-extrabold uppercase italic leading-[0.9] text-slate-900 md:text-6xl">
            Africa Twin
          </h1>
          <div className="mt-2 flex h-1 w-28 overflow-hidden md:w-40">
            <span className="flex-1 bg-[#e4002b]" />
            <span className="flex-1 bg-white" />
            <span className="flex-1 bg-[#1f3a93]" />
          </div>
          <dl className="mt-4 hidden gap-6 lg:flex">
            {HERO_SPECS.map(([value, label]) => (
              <div key={label}>
                <dt className="font-at text-2xl font-bold italic text-slate-900">{value}</dt>
                <dd className="text-xs uppercase tracking-wider text-slate-500">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <Link
          href="/"
          className="pointer-events-auto font-at rounded-full border border-slate-300 bg-white/70 px-4 py-1.5 text-sm font-semibold uppercase tracking-wider text-slate-700 backdrop-blur transition-colors hover:border-slate-900 hover:text-slate-900"
        >
          ← Portfolio
        </Link>
      </header>

      {/* Parts list — desktop */}
      <nav
        aria-label="Parts"
        className="at-scroll fixed left-8 top-1/2 z-20 hidden max-h-[56vh] w-56 -translate-y-[40%] overflow-y-auto pr-2 lg:block"
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
                    isActive ? "bg-slate-900 text-white" : isHover ? "bg-white text-slate-900" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span
                    className={`font-at text-xs font-semibold tabular-nums ${isActive ? "text-[#ff5a73]" : "text-[#e4002b]"}`}
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

      {/* Parts chips — mobile / tablet */}
      {!selectedPart && (
        <nav
          aria-label="Parts"
          className="at-scroll fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-20 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden"
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

      {/* Bottom bar: hint + explode toggle */}
      {!selectedPart && (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] z-20 flex flex-col items-center gap-2 px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => (exploded ? assemble() : setExploded(true))}
              aria-pressed={exploded}
              className={`font-at rounded-full px-5 py-2 text-sm font-bold uppercase tracking-widest transition-colors ${
                exploded ? "bg-slate-900 text-white" : "bg-[#e4002b] text-white hover:bg-[#c00024]"
              }`}
            >
              {exploded ? "Assemble" : "Explode"}
            </button>
            <p className="hidden text-xs uppercase tracking-widest text-slate-500 md:block">
              {exploded
                ? "Click a part for details · click empty space to reassemble"
                : "Click the bike to take it apart"}
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
          <p className="font-at text-sm font-bold uppercase tracking-wide">{hoveredPart.name}</p>
          <p className="text-[11px] text-white/70">
            {exploded ? hoveredPart.kicker : "Click to take the bike apart"}
          </p>
        </div>
      )}

      <p className="pointer-events-none fixed bottom-2 right-3 z-10 hidden text-[10px] text-slate-400 md:block">
        Specs:{" "}
        <a href={SOURCES.specs.url} target="_blank" rel="noreferrer" className="pointer-events-auto underline">
          Honda UK
        </a>{" "}
        (2026 model) · fan project, not affiliated with Honda
      </p>

      {!ready && <LoadingOverlay progress={progress} />}
    </main>
  );
}
