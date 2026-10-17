"use client";

import { useEffect, useRef, useState } from "react";
import { startMusic, stopMusic } from "@/components/owl-world/music";
import { useOwlWorld } from "@/components/owl-world/owlStore";
import { saveHighQuality } from "@/components/owl-world/quality";
import { setThemeChoice, THEMES, type ThemeChoice, useNearestTheme, useSeasonalTheme, useThemeChoice } from "@/themes";

const MUSIC_KEY = "owl-music";

function savedMusic() {
  try {
    return window.localStorage.getItem(MUSIC_KEY) === "on";
  } catch {
    return false;
  }
}

/**
 * Music on/off. Off by default; a visitor who turned it on gets it back on
 * their first click or key next time (audio can only start from a gesture)
 */
function useMusic() {
  const [on, setOn] = useState(false);
  // Drops the wait for a first gesture, once the visitor decides themselves
  const cancelWait = useRef<() => void>(() => {});

  useEffect(() => {
    if (!savedMusic()) return;
    const begin = (e: Event) => {
      // A click on the controls decides for itself
      if ((e.target as Element | null)?.closest?.("[data-scene-controls]")) return;
      startMusic();
      setOn(true);
      remove();
    };
    const remove = () => {
      window.removeEventListener("pointerdown", begin);
      window.removeEventListener("keydown", begin);
    };
    window.addEventListener("pointerdown", begin);
    window.addEventListener("keydown", begin);
    cancelWait.current = remove;
    return () => {
      remove();
      stopMusic();
    };
  }, []);

  const toggle = () => {
    cancelWait.current();
    const next = !on;
    setOn(next);
    if (next) startMusic();
    else stopMusic();
    try {
      window.localStorage.setItem(MUSIC_KEY, next ? "on" : "off");
    } catch {}
  };
  return [on, toggle] as const;
}

function useHighQuality() {
  const high = useOwlWorld((s) => s.highQuality) === true;
  const toggle = () => {
    saveHighQuality(!high);
    useOwlWorld.getState().setHighQuality(!high);
  };
  return [high, toggle] as const;
}

const round =
  "owl-glass pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-moon-100 transition hover:text-moon-50 active:scale-95";

function MusicIcon({ on }: { on: boolean }) {
  return on ? (
    <span aria-hidden className="flex h-4 items-end gap-[3px]">
      {[0, 0.25, 0.5, 0.15].map((delay) => (
        <span key={delay} className="owl-eq w-[3px] rounded-full bg-lantern" style={{ animationDelay: `${-delay * 4}s` }} />
      ))}
    </span>
  ) : (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

function Switch({ label, hint, on, onToggle }: { label: string; hint?: string; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onToggle} className="flex min-h-11 w-full items-center justify-between gap-4 rounded-xl px-3 text-left hover:bg-white/10">
      <span>
        <span className="block text-sm font-medium text-moon-50">{label}</span>
        {hint && <span className="block text-xs text-moon-400">{hint}</span>}
      </span>
      <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${on ? "bg-lantern" : "bg-white/15"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-moon-50 shadow transition-transform ${on ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}

/** Close a menu on a tap or click anywhere outside it */
function useCloseAway(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open, close]);
  return ref;
}

/** The seasonal themes to pick from: auto (the nearest event), each one, or none */
function ThemeOptions({ onPick }: { onPick?: () => void }) {
  const choice = useThemeChoice();
  const nearest = useNearestTheme();
  const rows: { id: ThemeChoice; icon: string; label: string; hint?: string }[] = [
    { id: "auto", icon: "✨", label: "Auto", hint: nearest ? `Nearest event: ${nearest.name}` : undefined },
    ...THEMES.map((t) => ({ id: t.id, icon: t.icon, label: t.name })),
    { id: "off", icon: "🌙", label: "Off", hint: "Just the moonlit garden" },
  ];
  return (
    <div role="radiogroup" aria-label="Seasonal theme">
      {rows.map((r) => (
        <button
          key={r.id}
          type="button"
          role="radio"
          aria-checked={choice === r.id}
          onClick={() => {
            setThemeChoice(r.id);
            onPick?.();
          }}
          className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-1 text-left hover:bg-white/10"
        >
          <span aria-hidden className="w-5 text-center text-base">
            {r.icon}
          </span>
          <span className="flex-1">
            <span className="block text-sm font-medium text-moon-50">{r.label}</span>
            {r.hint && <span className="block text-xs text-moon-400">{r.hint}</span>}
          </span>
          {choice === r.id && <span aria-hidden className="h-2 w-2 rounded-full bg-lantern" />}
        </button>
      ))}
    </div>
  );
}

/** Wider screens: a button showing the theme in force, opening the picker */
function ThemeButton() {
  const theme = useSeasonalTheme();
  const [open, setOpen] = useState(false);
  const ref = useCloseAway(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Seasonal theme"
        title={theme ? `Theme: ${theme.name}` : "Theme: off"}
        className={`${round} text-lg`}
      >
        <span aria-hidden className={theme ? "" : "opacity-60 grayscale"}>
          {theme?.icon ?? "🌙"}
        </span>
      </button>
      {open && (
        <div className="owl-glass pointer-events-auto absolute right-0 top-full mt-2 w-60 rounded-2xl p-1.5">
          <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-moon-400">Theme</p>
          <ThemeOptions onPick={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

/** Theme, music and quality: buttons on wider screens, a small menu on phones */
export default function SceneControls() {
  const [music, toggleMusic] = useMusic();
  const [high, toggleHigh] = useHighQuality();
  const [open, setOpen] = useState(false);
  const menu = useCloseAway(open, () => setOpen(false));

  return (
    <div data-scene-controls className="flex gap-2">
      <div className="hidden gap-2 sm:flex">
        <ThemeButton />
        <button type="button" onClick={toggleMusic} aria-pressed={music} aria-label="Background music" title={music ? "Music off" : "Music on"} className={round}>
          <MusicIcon on={music} />
        </button>
        <button
          type="button"
          onClick={toggleHigh}
          aria-pressed={high}
          aria-label="High quality graphics"
          title={high ? "High quality: on (reloads the scene)" : "High quality: off (reloads the scene)"}
          className={`${round} text-xs font-bold tracking-wide ${high ? "!bg-lantern !text-ink" : ""}`}
        >
          HQ
        </button>
      </div>

      <div ref={menu} className="relative sm:hidden">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Settings" className={round}>
          {music ? (
            <MusicIcon on />
          ) : (
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
              <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
              <circle cx="16" cy="7" r="2" />
              <circle cx="10" cy="17" r="2" />
            </svg>
          )}
        </button>
        {open && (
          <div className="owl-glass pointer-events-auto absolute right-0 top-full mt-2 w-60 rounded-2xl p-1.5">
            <Switch label="Music" on={music} onToggle={toggleMusic} />
            <Switch label="High quality" hint="Sharper, with shadows and glow. Reloads the scene" on={high} onToggle={toggleHigh} />
            <p className="mt-1 border-t border-white/10 px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-moon-400">Theme</p>
            <ThemeOptions />
          </div>
        )}
      </div>
    </div>
  );
}
