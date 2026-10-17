import type { ComponentType, LazyExoticComponent } from "react";

/** [month 1–12, day 1–31] */
export type MonthDay = readonly [month: number, day: number];

/**
 * A seasonal dressing for the owl homepage. Everything but the dates is
 * optional: a theme can just recolour the UI, just add things to the 3D
 * scene, or both. The components are lazy, so only the theme in force is
 * downloaded.
 */
export interface SeasonalTheme {
  id: string;
  /** In the theme picker */
  name: string;
  icon: string;
  /** The day itself in a given year; null for a year it doesn't know (moving feasts) */
  day: (year: number) => MonthDay | null;
  /** Days after the day it still counts as on, before the next event takes over */
  lasts: number;
  /** Put on the page's <main>: CSS variable overrides and the like (see globals.css: --lantern) */
  className?: string;
  /** Text on the home panel */
  copy?: { homeKicker?: string };
  /** Mounted inside the R3F canvas */
  Scene?: LazyExoticComponent<ComponentType>;
  /** Mounted over the page, outside the canvas */
  Overlay?: LazyExoticComponent<ComponentType>;
}
