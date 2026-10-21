import { create } from "zustand";
import { track } from "@/lib/analytics";

export type FollowTarget = "train" | "fuel" | "bike" | "car" | { file: string };

export type Focus = { kind: "shot"; id: string } | { kind: "follow"; target: FollowTarget };

export type LightMode = "auto" | "day" | "night";

export type FxId =
  | "ao"
  | "godrays"
  | "lensflare"
  | "bloom"
  | "tiltshift"
  | "dof"
  | "grade"
  | "chroma"
  | "vignette"
  | "grain"
  | "smaa"
  | "sepia"
  | "mono"
  | "colordepth"
  | "dotscreen"
  | "pixel"
  | "scanline"
  | "glitch"
  | "ascii"
  | "water";

export interface FxDef {
  id: FxId;
  label: string;
  group: "Cinematic" | "Stylize";
}

export const FX_LIST: FxDef[] = [
  { id: "ao", label: "Ambient occlusion", group: "Cinematic" },
  { id: "godrays", label: "God rays", group: "Cinematic" },
  { id: "lensflare", label: "Lens flare", group: "Cinematic" },
  { id: "bloom", label: "Bloom", group: "Cinematic" },
  { id: "tiltshift", label: "Tilt-shift", group: "Cinematic" },
  { id: "dof", label: "Depth of field", group: "Cinematic" },
  { id: "grade", label: "Color grade", group: "Cinematic" },
  { id: "chroma", label: "Chromatic aberration", group: "Cinematic" },
  { id: "vignette", label: "Vignette", group: "Cinematic" },
  { id: "grain", label: "Film grain", group: "Cinematic" },
  { id: "smaa", label: "SMAA", group: "Cinematic" },
  { id: "sepia", label: "Sepia", group: "Stylize" },
  { id: "mono", label: "Monochrome", group: "Stylize" },
  { id: "colordepth", label: "Retro palette", group: "Stylize" },
  { id: "dotscreen", label: "Dot screen", group: "Stylize" },
  { id: "pixel", label: "Pixelate", group: "Stylize" },
  { id: "scanline", label: "Scanlines", group: "Stylize" },
  { id: "glitch", label: "Glitch", group: "Stylize" },
  { id: "ascii", label: "ASCII", group: "Stylize" },
  { id: "water", label: "Underwater", group: "Stylize" },
];

const preset = (on: FxId[]) => Object.fromEntries(FX_LIST.map((f) => [f.id, on.includes(f.id)])) as Record<FxId, boolean>;

export const FX_PRESETS: { id: string; label: string; fx: Record<FxId, boolean> }[] = [
  {
    id: "cinematic",
    label: "Cinematic",
    fx: preset(["ao", "godrays", "lensflare", "bloom", "tiltshift", "grade", "chroma", "vignette"]),
  },
  { id: "miniature", label: "Miniature", fx: preset(["ao", "bloom", "tiltshift", "grade", "vignette"]) },
  { id: "retro", label: "Retro TV", fx: preset(["bloom", "colordepth", "scanline", "chroma", "vignette", "grain", "glitch"]) },
  // Every effect that still leaves a readable picture when stacked together
  {
    id: "everything",
    label: "Everything",
    fx: preset([...FX_LIST.filter((f) => f.group === "Cinematic").map((f) => f.id), "scanline", "glitch", "water"]),
  },
  { id: "comic", label: "Comic", fx: preset(["ao", "bloom", "dotscreen", "colordepth", "vignette", "smaa"]) },
  { id: "terminal", label: "Terminal", fx: preset(["bloom", "ascii", "scanline"]) },
  { id: "off", label: "Off", fx: preset([]) },
];

interface ShowcaseState {
  focus: Focus;
  // Bumped on every pick so choosing the same shot again re-runs the move
  focusNonce: number;
  cutaway: boolean;
  lightMode: LightMode;
  // In-world time as "HH:MM", refreshed every few game minutes
  clock: string;
  isNight: boolean;
  fx: Record<FxId, boolean>;
  // Set by the scene once the intro has finished building the world
  live: boolean;
  trainStatus: string;
  setFocus: (focus: Focus) => void;
  setCutaway: (on: boolean) => void;
  setLightMode: (mode: LightMode) => void;
  setClock: (clock: string, isNight: boolean) => void;
  toggleFx: (id: FxId) => void;
  setFxPreset: (fx: Record<FxId, boolean>) => void;
  setLive: (on: boolean) => void;
  setTrainStatus: (status: string) => void;
}

export const INITIAL_SHOWCASE = {
  focus: { kind: "shot", id: "overview" } as Focus,
  cutaway: false,
  lightMode: "auto" as LightMode,
  clock: "",
  isNight: false,
  fx: FX_PRESETS[0]!.fx,
  live: false,
  trainStatus: "",
};

export const useShowcase = create<ShowcaseState>((set) => ({
  ...INITIAL_SHOWCASE,
  focusNonce: 0,
  setFocus: (focus) => {
    const target =
      focus.kind === "shot" ? focus.id : typeof focus.target === "string" ? focus.target : focus.target.file;
    track(focus.kind === "shot" ? "showcase_camera" : "showcase_follow", { target });
    set((s) => ({ focus, focusNonce: s.focusNonce + 1 }));
  },
  setCutaway: (cutaway) => {
    track("showcase_xray", { on: cutaway });
    set({ cutaway });
  },
  setLightMode: (lightMode) => {
    track("showcase_light", { mode: lightMode });
    set({ lightMode });
  },
  setClock: (clock, isNight) => set({ clock, isNight }),
  toggleFx: (id) =>
    set((s) => {
      track("showcase_fx", { effect: id, on: !s.fx[id] });
      return { fx: { ...s.fx, [id]: !s.fx[id] } };
    }),
  setFxPreset: (fx) => {
    track("showcase_fx_preset", { preset: FX_PRESETS.find((p) => p.fx === fx)?.id ?? "custom" });
    set({ fx });
  },
  setLive: (live) => set({ live }),
  setTrainStatus: (trainStatus) => set({ trainStatus }),
}));

// The fuel badges are plain DOM over the canvas; the scene moves them each
// frame without going through React
export const fuelBadgeEls: (HTMLDivElement | null)[] = [];
