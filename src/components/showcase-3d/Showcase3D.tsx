"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Canvas } from "@react-three/fiber";
import { ProjectsMenu } from "@/components/ProjectSheet";
import { track } from "@/lib/analytics";
import { CAMERA_SHOTS, INTRO_CAMERA, MODEL_SHOTS, ROLE_LABEL, SHOWCASE_INFO, SHOWCASE_MODELS } from "@/config/showcase3d";
import { loadShowcaseModels, type FileProgress, type ModelLibrary } from "./loadModels";
import ShowcaseScene from "./ShowcaseScene";
import { FX_LIST, FX_PRESETS, fuelBadgeEls, INITIAL_SHOWCASE, useShowcase, type Focus, type FollowTarget, type FxId } from "./store";

const MB = 1024 * 1024;
const fmtMB = (bytes: number) => `${(bytes / MB).toFixed(bytes < MB ? 2 : 1)} MB`;
const fmtK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${Math.round(n)}`);

const ROLE_COLOR: Record<string, string> = {
  environment: "#7cc4ff",
  parked: "#b9a6ff",
  traffic: "#ffb35c",
  refuel: "#ffd35c",
  rider: "#ff8fa3",
  train: "#6ee7c0",
};

const FOLLOWS: { target: Exclude<FollowTarget, { file: string }>; label: string }[] = [
  { target: "fuel", label: "Fuel stop car" },
  { target: "car", label: "Road car" },
  { target: "bike", label: "Motorbike" },
  { target: "train", label: "Subway train" },
];

const PHONE = "(max-width: 640px)";
const subscribePhone = (onChange: () => void) => {
  const mq = window.matchMedia(PHONE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};

type ProgressMap = Record<string, FileProgress>;

function sameFocus(a: Focus, b: Focus) {
  if (a.kind !== b.kind) return false;
  if (a.kind === "shot" && b.kind === "shot") return a.id === b.id;
  if (a.kind === "follow" && b.kind === "follow") {
    if (typeof a.target === "string" || typeof b.target === "string") return a.target === b.target;
    return a.target.file === b.target.file;
  }
  return false;
}

function useModelLoading() {
  const [progress, setProgress] = useState<ProgressMap>({});
  const [library, setLibrary] = useState<ModelLibrary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<ProgressMap>({});
  const frame = useRef(0);

  useEffect(() => {
    const abort = new AbortController();
    // Chunks land far faster than frames; flush them once per frame
    const flush = () => {
      frame.current = 0;
      const batch = pending.current;
      pending.current = {};
      setProgress((p) => ({ ...p, ...batch }));
    };
    const t0 = performance.now();
    loadShowcaseModels((file, p) => {
      pending.current[file] = p;
      if (!frame.current) frame.current = requestAnimationFrame(flush);
    }, abort.signal)
      .then((lib) => {
        if (abort.signal.aborted) return;
        setLibrary(lib);
        track("showcase_models_loaded", {
          models: Object.keys(lib).length,
          seconds: Math.round((performance.now() - t0) / 100) / 10,
        });
      })
      .catch((e: unknown) => {
        if (abort.signal.aborted) return;
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        track("showcase_load_error", { message: message.slice(0, 100) });
      });
    return () => {
      abort.abort();
      cancelAnimationFrame(frame.current);
    };
  }, []);

  return { progress, library, error };
}

function StatusIcon({ p }: { p?: FileProgress }) {
  if (p?.status === "ready")
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-emerald-300" fill="none" stroke="currentColor" strokeWidth={2.2}>
        <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (p?.status === "error") return <span className="text-xs text-rose-400">!</span>;
  if (p?.status === "parsing")
    return <span className="block h-3 w-3 animate-spin rounded-full border-2 border-sky-300/30 border-t-sky-300" />;
  return <span className={`block h-2 w-2 rounded-full ${p ? "animate-pulse bg-amber-300" : "bg-white/25"}`} />;
}

function ModelPanel({
  progress,
  ready,
  elapsed,
  open,
  onToggle,
}: {
  progress: ProgressMap;
  ready: boolean;
  elapsed: number;
  open: boolean;
  onToggle: () => void;
}) {
  const live = useShowcase((s) => s.live);
  const focus = useShowcase((s) => s.focus);
  const setFocus = useShowcase((s) => s.setFocus);
  const files = Object.values(progress);
  const loaded = files.reduce((a, p) => a + p.loaded, 0);
  const total = SHOWCASE_MODELS.reduce((a, m) => a + (progress[m.file]?.total ?? m.bytes), 0);
  const done = files.filter((p) => p.status === "ready").length;
  const triangles = files.reduce((a, p) => a + p.triangles, 0);
  const pct = total ? (loaded / total) * 100 : 0;

  const pick = (file: string) => {
    const shot = MODEL_SHOTS[file];
    setFocus(shot ? { kind: "shot", id: shot } : { kind: "follow", target: { file } });
  };

  return (
    <aside
      className={`pointer-events-auto absolute left-3 top-[4.5rem] z-20 flex max-h-[calc(100dvh-10.5rem)] w-[min(20rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d1320]/80 text-white shadow-2xl backdrop-blur-md transition-transform duration-500 sm:top-20 ${
        open ? "translate-x-0" : "-translate-x-[calc(100%+1rem)]"
      }`}
    >
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide">
            Models <span className="text-white/45">· {done}/{SHOWCASE_MODELS.length}</span>
          </h2>
          <button type="button" onClick={onToggle} className="rounded-md px-1.5 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Hide model list">
            ✕
          </button>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 via-emerald-300 to-amber-300 transition-[width] duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 font-mono text-[11px] text-white/55">
          {fmtMB(loaded)} / {fmtMB(total)} · {(elapsed / 1000).toFixed(2)} s
          {ready && ` · ${fmtK(triangles)} tris`}
        </p>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {SHOWCASE_MODELS.map((m) => {
          const p = progress[m.file];
          const filePct = p ? (p.loaded / Math.max(1, p.total)) * 100 : 0;
          const shot = MODEL_SHOTS[m.file];
          const target: Focus = shot ? { kind: "shot", id: shot } : { kind: "follow", target: { file: m.file } };
          const active = live && sameFocus(focus, target);
          return (
            <li key={m.file}>
              <button
                type="button"
                disabled={!live}
                onClick={() => pick(m.file)}
                className={`group w-full rounded-xl px-2.5 py-2 text-left transition enabled:hover:bg-white/[0.07] disabled:cursor-default ${
                  active ? "bg-white/10 ring-1 ring-white/20" : ""
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    <StatusIcon p={p} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-medium">{m.label}</span>
                      <span className="shrink-0 font-mono text-[10px] text-white/45">
                        {p?.status === "ready" ? `${fmtK(p.triangles)} tris` : fmtMB(p?.total ?? m.bytes)}
                      </span>
                    </span>
                    <span className="flex items-center justify-between gap-2 text-[10.5px] text-white/40">
                      <span className="truncate font-mono">{m.file}</span>
                      <span className="shrink-0" style={{ color: ROLE_COLOR[m.role] }}>
                        {ROLE_LABEL[m.role]}
                      </span>
                    </span>
                  </span>
                </div>
                {p?.status !== "ready" && (
                  <div className="ml-6 mt-1.5 h-0.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-amber-300 transition-[width] duration-150" style={{ width: `${filePct}%` }} />
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {live && <p className="border-t border-white/10 px-4 py-2 text-[11px] text-white/45">Pick a model to fly to it or ride along.</p>}
    </aside>
  );
}

function Pill({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-amber-300/70 bg-amber-300/20 text-amber-100"
          : "border-white/15 bg-white/5 text-white/80 hover:border-white/35 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function ControlBar({ fxOpen, onFx }: { fxOpen: boolean; onFx: () => void }) {
  const focus = useShowcase((s) => s.focus);
  const setFocus = useShowcase((s) => s.setFocus);
  const cutaway = useShowcase((s) => s.cutaway);
  const setCutaway = useShowcase((s) => s.setCutaway);
  const lightMode = useShowcase((s) => s.lightMode);
  const setLightMode = useShowcase((s) => s.setLightMode);
  const clock = useShowcase((s) => s.clock);
  const isNight = useShowcase((s) => s.isNight);

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-3 z-20 flex justify-center px-3">
      <div className="flex max-w-full flex-col gap-2 rounded-2xl border border-white/10 bg-[#0d1320]/80 p-2 shadow-2xl backdrop-blur-md">
        <div className="flex gap-1.5 overflow-x-auto">
          <span className="self-center px-1.5 text-[10px] uppercase tracking-widest text-white/40">Camera</span>
          {CAMERA_SHOTS.map((s) => (
            <Pill key={s.id} active={sameFocus(focus, { kind: "shot", id: s.id })} onClick={() => setFocus({ kind: "shot", id: s.id })}>
              {s.label}
            </Pill>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          <span className="self-center px-1.5 text-[10px] uppercase tracking-widest text-white/40">Follow</span>
          {FOLLOWS.map((f) => (
            <Pill
              key={f.target}
              active={sameFocus(focus, { kind: "follow", target: f.target })}
              onClick={() => setFocus({ kind: "follow", target: f.target })}
            >
              {f.label}
            </Pill>
          ))}
          <span className="mx-1 w-px shrink-0 self-stretch bg-white/10" />
          <Pill active={cutaway} onClick={() => setCutaway(!cutaway)}>
            Underground x-ray
          </Pill>
          <Pill active={fxOpen} onClick={onFx}>
            FX
          </Pill>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="self-center px-1.5 text-[10px] uppercase tracking-widest text-white/40">Light</span>
          {(["auto", "day", "night"] as const).map((m) => (
            <Pill key={m} active={lightMode === m} onClick={() => setLightMode(m)}>
              {m === "auto" ? "Auto cycle" : m === "day" ? "Day" : "Night"}
            </Pill>
          ))}
          <span className="ml-1 flex shrink-0 items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 font-mono text-xs text-white/80">
            {isNight ? (
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-indigo-200" fill="currentColor">
                <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-amber-300" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <circle cx="12" cy="12" r="4" fill="currentColor" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            )}
            {clock || "--:--"}
          </span>
        </div>
      </div>
    </div>
  );
}

function FxPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const fx = useShowcase((s) => s.fx);
  const toggleFx = useShowcase((s) => s.toggleFx);
  const setFxPreset = useShowcase((s) => s.setFxPreset);
  const on = FX_LIST.filter((f) => fx[f.id]).length;
  const activePreset = FX_PRESETS.find((p) => FX_LIST.every((f) => p.fx[f.id] === fx[f.id]))?.id;

  return (
    <aside
      className={`pointer-events-auto absolute right-3 top-[4.5rem] z-20 flex max-h-[calc(100dvh-12.5rem)] w-[min(18rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d1320]/85 text-white shadow-2xl backdrop-blur-md transition-all duration-300 sm:top-20 ${
        open ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-[calc(100%+1rem)] opacity-0"
      }`}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold">
          Post-processing <span className="text-white/45">· {on}/{FX_LIST.length}</span>
        </h2>
        <button type="button" onClick={onClose} className="rounded-md px-1.5 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Close effects">
          ✕
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 border-b border-white/10 px-3 py-2.5">
        {FX_PRESETS.map((p) => (
          <Pill key={p.id} active={activePreset === p.id} onClick={() => setFxPreset(p.fx)}>
            {p.label}
          </Pill>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {(["Cinematic", "Stylize"] as const).map((group) => (
          <section key={group} className="mb-1">
            <h3 className="px-2 pb-1 pt-1.5 text-[10px] uppercase tracking-widest text-white/40">{group}</h3>
            {FX_LIST.filter((f) => f.group === group).map((f) => (
              <FxToggle key={f.id} id={f.id} label={f.label} on={fx[f.id]} onToggle={toggleFx} />
            ))}
          </section>
        ))}
      </div>
    </aside>
  );
}

function FxToggle({ id, label, on, onToggle }: { id: FxId; label: string; on: boolean; onToggle: (id: FxId) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onToggle(id)}
      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-white/[0.06]"
    >
      <span className={on ? "text-white" : "text-white/55"}>{label}</span>
      <span className={`relative h-4 w-7 rounded-full transition-colors ${on ? "bg-amber-300/80" : "bg-white/15"}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${on ? "left-3.5" : "left-0.5"}`} />
      </span>
    </button>
  );
}

// Positioned every frame by the scene, over the car at each pump
function FuelBadges() {
  return (
    <>
      {[0, 1].map((i) => (
        <div
          key={i}
          ref={(el) => {
            fuelBadgeEls[i] = el;
          }}
          className="pointer-events-none absolute left-0 top-0 z-10 w-28 rounded-lg border border-amber-300/40 bg-black/70 px-2 py-1.5 text-[11px] text-amber-100 opacity-0 shadow-lg backdrop-blur transition-opacity duration-300"
        >
          <div className="flex items-baseline justify-between">
            <span className="uppercase tracking-wider text-amber-300/80">Fuel</span>
            <span>
              <span data-litres className="font-mono text-sm text-white">
                0.0
              </span>{" "}
              L
            </span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/15">
            <div data-fill className="h-full bg-gradient-to-r from-amber-400 to-lime-300" style={{ width: "0%" }} />
          </div>
        </div>
      ))}
    </>
  );
}

function AboutCard({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const totalMB = SHOWCASE_MODELS.reduce((a, m) => a + m.bytes, 0) / MB;
  const stats: [string, string][] = [
    [String(SHOWCASE_MODELS.length), "GLB models"],
    [`${totalMB.toFixed(1)} MB`, "streamed"],
    [String(FX_LIST.length), "post effects"],
  ];

  return (
    <div
      className={`absolute inset-0 z-40 flex items-center justify-center p-4 transition-opacity duration-300 ${
        open ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="showcase-about-title"
        className={`relative max-h-[calc(100dvh-2rem)] w-[min(30rem,100%)] overflow-y-auto rounded-2xl border border-white/10 bg-[#0d1320]/95 p-5 text-white shadow-2xl transition-transform duration-300 ${
          open ? "translate-y-0 scale-100" : "translate-y-3 scale-[0.98]"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-300/90">About this scene</p>
            <h2 id="showcase-about-title" className="mt-1.5 text-xl font-semibold leading-snug">
              {SHOWCASE_INFO.tagline}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close about" className="rounded-md px-1.5 text-white/60 hover:bg-white/10 hover:text-white">
            ✕
          </button>
        </div>
        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-white/75">
          {SHOWCASE_INFO.scene.map((line) => (
            <li key={line} className="flex gap-2.5">
              <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-300/80" />
              {line}
            </li>
          ))}
        </ul>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {stats.map(([value, label]) => (
            <div key={label} className="rounded-xl bg-white/5 px-2 py-2.5">
              <p className="font-mono text-lg text-white">{value}</p>
              <p className="text-[11px] text-white/45">{label}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[10px] uppercase tracking-widest text-white/40">Try</p>
        <ul className="mt-1.5 space-y-1 text-[13px] text-white/60">
          {SHOWCASE_INFO.tips.map((tip) => (
            <li key={tip}>→ {tip}</li>
          ))}
        </ul>
        <p className="mt-4 border-t border-white/10 pt-3 text-[11px] text-white/40">Three.js · React Three Fiber · postprocessing</p>
      </section>
    </div>
  );
}

function LoadingCenter({ pct, done, failed }: { pct: number; done: boolean; failed: string | null }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center transition-opacity duration-700 ${
        done ? "opacity-0" : "opacity-100"
      }`}
    >
      <p className="font-mono text-6xl font-light tabular-nums text-white drop-shadow-[0_0_24px_rgba(124,196,255,0.6)] sm:text-7xl">
        {Math.floor(pct)}
        <span className="text-3xl text-white/50">%</span>
      </p>
      <p className="mt-2 text-xs uppercase tracking-[0.35em] text-sky-200/70">
        {failed ? `Failed: ${failed}` : pct >= 100 ? "Building the world" : "Streaming models"}
      </p>
    </div>
  );
}

export default function Showcase3D() {
  const { progress, library, error } = useModelLoading();
  const live = useShowcase((s) => s.live);
  const trainStatus = useShowcase((s) => s.trainStatus);
  // null until the visitor toggles it; phones hide it once the intro is over
  const [panelPref, setPanelPref] = useState<boolean | null>(null);
  const isPhone = useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches, () => false);
  const panelOpen = panelPref ?? !(live && isPhone);
  const [elapsed, setElapsed] = useState(0);
  const [fxOpen, setFxOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const started = useRef(0);

  // Wall-clock for the loading readout; stops when the last file is parsed
  useEffect(() => {
    if (!started.current) started.current = performance.now();
    if (library || error) return;
    let raf = 0;
    const tick = () => {
      setElapsed(performance.now() - started.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [library, error]);

  // A fresh visit starts from the intro, not wherever the last one left off
  useEffect(() => {
    useShowcase.setState(INITIAL_SHOWCASE);
  }, []);

  const loaded = Object.values(progress).reduce((a, p) => a + p.loaded, 0);
  const total = SHOWCASE_MODELS.reduce((a, m) => a + (progress[m.file]?.total ?? m.bytes), 0);
  const pct = library ? 100 : Math.min(99.9, (loaded / total) * 100);

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#0a1024] text-white">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: INTRO_CAMERA.position, fov: 42, near: 0.1, far: 900 }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <ShowcaseScene library={library} />
      </Canvas>

      <LoadingCenter pct={pct} done={!!library} failed={error} />
      <FuelBadges />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPanelPref(!panelOpen)}
            aria-label={panelOpen ? "Hide model list" : "Show model list"}
            aria-expanded={panelOpen}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-[#0d1320]/80 backdrop-blur-md hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" strokeLinejoin="round" />
              <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="rounded-xl border border-white/10 bg-[#0d1320]/70 px-3 py-1.5 backdrop-blur-md">
            <h1 className="text-sm font-semibold leading-tight sm:text-base">3D Showcase</h1>
            <p className="text-[11px] leading-tight text-white/55">{SHOWCASE_INFO.tagline}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!aboutOpen) track("showcase_about_open");
              setAboutOpen(!aboutOpen);
            }}
            aria-label="About this scene"
            aria-expanded={aboutOpen}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border backdrop-blur-md transition hover:bg-white/10 ${
              aboutOpen ? "border-amber-300/60 bg-amber-300/15 text-amber-100" : "border-white/15 bg-[#0d1320]/80"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5M12 8h.01" />
            </svg>
          </button>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          {trainStatus && (
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-300/30 bg-[#0d1320]/80 px-3 py-1.5 text-xs text-emerald-100 backdrop-blur-md sm:flex">
              <span className={`h-1.5 w-1.5 rounded-full ${trainStatus === "At platform" ? "bg-emerald-300" : "animate-pulse bg-amber-300"}`} />
              Subway · {trainStatus}
            </span>
          )}
          <Link href="/" className="rounded-full border border-white/15 bg-[#0d1320]/80 px-3 py-1.5 text-xs backdrop-blur-md hover:bg-white/10">
            Portfolio
          </Link>
          <ProjectsMenu className="rounded-full border border-white/15 bg-[#0d1320]/80 px-3 py-1.5 text-xs backdrop-blur-md hover:bg-white/10">
            Projects
          </ProjectsMenu>
        </div>
      </header>

      <AboutCard open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <div className="pointer-events-none absolute inset-0 z-20">
        <ModelPanel progress={progress} ready={!!library} elapsed={elapsed} open={panelOpen} onToggle={() => setPanelPref(false)} />
        <div
          className={`absolute inset-0 transition-all duration-700 ${live ? "translate-y-0 opacity-100" : "invisible translate-y-6 opacity-0"}`}
        >
          <ControlBar fxOpen={fxOpen} onFx={() => setFxOpen((o) => !o)} />
          <FxPanel open={fxOpen} onClose={() => setFxOpen(false)} />
        </div>
      </div>
    </main>
  );
}
