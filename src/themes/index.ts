import { useSyncExternalStore } from "react";
import type { SeasonalTheme } from "@/themes/types";
import halloween from "@/themes/halloween";
import christmas from "@/themes/christmas";
import newYear from "@/themes/new-year";
import lunarNewYear from "@/themes/lunar-new-year";

export type { SeasonalTheme } from "@/themes/types";

/**
 * Seasonal themes for the homepage. To add one, make a folder beside these
 * with an index.ts default-exporting a SeasonalTheme, and list it here.
 *
 * The visitor picks one in the scene controls (saved in localStorage); left
 * on "auto", it's the event on now or, failing that, the next one coming.
 * `?theme=<id>` / `?theme=off` / `?theme=auto` picks for this visit only.
 */
export const THEMES: SeasonalTheme[] = [halloween, christmas, newYear, lunarNewYear];

export type ThemeChoice = "auto" | "off" | (string & {});

const DAY = 86_400_000;

/** The event on at `date`, else the soonest to come */
export function nearestTheme(date: Date) {
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  let best: SeasonalTheme | null = null;
  let bestIn = Infinity;
  for (const theme of THEMES) {
    for (const year of [date.getFullYear() - 1, date.getFullYear(), date.getFullYear() + 1]) {
      const day = theme.day(year);
      if (!day) continue;
      const start = Date.UTC(year, day[0] - 1, day[1]);
      if (start + theme.lasts * DAY < today) continue;
      // Negative while it's on
      const until = (start - today) / DAY;
      if (until < bestIn) {
        best = theme;
        bestIn = until;
      }
    }
  }
  return best ?? THEMES[0]!;
}

// ------------------------------------------------------------------ store

const KEY = "owl-theme";
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

const isChoice = (c: string | null): c is ThemeChoice => c === "auto" || c === "off" || THEMES.some((t) => t.id === c);

let choice: ThemeChoice | undefined;
function getChoice(): ThemeChoice {
  if (choice === undefined) {
    const forced = new URLSearchParams(window.location.search).get("theme");
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(KEY);
    } catch {}
    choice = isChoice(forced) ? forced : isChoice(saved) ? saved : "auto";
  }
  return choice;
}

export function setThemeChoice(next: ThemeChoice) {
  choice = next;
  try {
    window.localStorage.setItem(KEY, next);
  } catch {}
  listeners.forEach((l) => l());
}

// Settled once per visit: "auto" doesn't switch mid-flight at midnight
let nearest: SeasonalTheme | undefined;
const getNearest = () => (nearest ??= nearestTheme(new Date()));

function getTheme() {
  const c = getChoice();
  if (c === "off") return null;
  return THEMES.find((t) => t.id === c) ?? getNearest();
}

/** The theme in force; null on the server and when turned off */
export const useSeasonalTheme = () => useSyncExternalStore(subscribe, getTheme, () => null);
export const useThemeChoice = () => useSyncExternalStore(subscribe, getChoice, (): ThemeChoice => "auto");
/** What "auto" picks */
export const useNearestTheme = () => useSyncExternalStore(subscribe, getNearest, () => null);
