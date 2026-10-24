import { create } from "zustand";
import {
  COLOR_SWATCHES,
  DEFAULT_EXPO_NAME,
  SLOT_BY_ID,
  SLOTS,
  TEMPLATES,
  TIER_INFO,
  type BoothColors,
  type Shot,
  type TemplateId,
  type Tier,
} from "@/config/expodia";

export const STORAGE_KEY = "expodia:v1";
const LOG_LIMIT = 40;

export interface BoothConfig {
  template: TemplateId;
  colors: BoothColors;
  // surface key → JPEG data URL
  images: Record<string, string>;
  updatedAt: number;
}

export interface ChangeEntry {
  id: number;
  at: number;
  slot: string;
  text: string;
  // Changes with the same key in a short window replace each other, so
  // dragging a colour picker leaves one line instead of fifty
  key?: string;
}

interface Saved {
  expoName: string;
  booths: Record<string, BoothConfig>;
  log: ChangeEntry[];
}

export type DockTab = "booth" | "expo" | "changes";

interface ExpodiaState extends Saved {
  hydrated: boolean;
  // True when this visit started without a saved config and got sample booths
  seeded: boolean;
  storageError: string | null;
  selected: string | null;
  hovered: string | null;
  dockOpen: boolean;
  dockTab: DockTab;
  flyTo: (Shot & { n: number }) | null;
  uploadRequest: { slot: string; surface: string; n: number } | null;

  hydrate: () => void;
  select: (slot: string | null, opts?: { fly?: boolean; panel?: boolean }) => void;
  setHovered: (slot: string | null) => void;
  setDock: (open: boolean, tab?: DockTab) => void;
  fly: (shot: Shot) => void;
  place: (slot: string, template: TemplateId) => void;
  remove: (slot: string) => void;
  setColor: (slot: string, key: keyof BoothColors, hex: string) => void;
  resetColors: (slot: string) => void;
  setImage: (slot: string, surface: string, label: string, dataUrl: string | null) => void;
  requestUpload: (slot: string, surface: string) => void;
  setExpoName: (name: string) => void;
  randomize: () => void;
  resetAll: () => void;
}

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]!;

function shuffle<T>(list: T[]) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const SAMPLE_COUNT: Record<Tier, number> = { Basic: 6, Pro: 4, Premium: 2 };

// A handful of booths in random slots, random models and colours, no pictures
function sampleBooths(): Record<string, BoothConfig> {
  const booths: Record<string, BoothConfig> = {};
  const now = Date.now();
  for (const tier of Object.keys(SAMPLE_COUNT) as Tier[]) {
    const slots = shuffle(SLOTS.filter((s) => s.tier === tier)).slice(0, SAMPLE_COUNT[tier]);
    for (const s of slots) {
      const template = pick(TIER_INFO[tier].templates);
      const base = TEMPLATES[template].colors;
      booths[s.id] = {
        template,
        colors: { ...base, primary: Math.random() < 0.35 ? base.primary : pick(COLOR_SWATCHES.slice(0, 9)) },
        images: {},
        updatedAt: now,
      };
    }
  }
  return booths;
}

function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<Saved>;
    if (!data || typeof data !== "object" || !data.booths) return null;
    // Drop anything that no longer matches the catalogue
    const booths: Record<string, BoothConfig> = {};
    for (const [slot, b] of Object.entries(data.booths)) {
      if (SLOT_BY_ID[slot] && b && TEMPLATES[b.template]) booths[slot] = { ...b, images: b.images ?? {} };
    }
    return {
      expoName: typeof data.expoName === "string" && data.expoName.trim() ? data.expoName : DEFAULT_EXPO_NAME,
      booths,
      log: Array.isArray(data.log) ? data.log.slice(0, LOG_LIMIT) : [],
    };
  } catch {
    return null;
  }
}

let logId = 0;

export const useExpodia = create<ExpodiaState>((set, get) => {
  const addLog = (log: ChangeEntry[], slot: string, text: string, key?: string): ChangeEntry[] => {
    const at = Date.now();
    const top = log[0];
    if (key && top?.key === key && at - top.at < 8000) return [{ ...top, at, text }, ...log.slice(1)];
    return [{ id: at * 100 + (logId++ % 100), at, slot, text, key }, ...log].slice(0, LOG_LIMIT);
  };

  const updateBooth = (slot: string, patch: (b: BoothConfig) => Partial<BoothConfig>, text: string, key?: string) => {
    const b = get().booths[slot];
    if (!b) return;
    set((s) => ({
      booths: { ...s.booths, [slot]: { ...b, ...patch(b), updatedAt: Date.now() } },
      log: addLog(s.log, slot, text, key),
    }));
  };

  return {
    expoName: DEFAULT_EXPO_NAME,
    booths: {},
    log: [],
    hydrated: false,
    seeded: false,
    storageError: null,
    selected: null,
    hovered: null,
    dockOpen: true,
    dockTab: "booth",
    flyTo: null,
    uploadRequest: null,

    hydrate: () => {
      if (get().hydrated) return;
      const saved = readSaved();
      if (saved) {
        set({ ...saved, hydrated: true });
        return;
      }
      const booths = sampleBooths();
      set({
        booths,
        hydrated: true,
        seeded: true,
        log: [{ id: 0, at: Date.now(), slot: "", text: `Expo opened with ${Object.keys(booths).length} sample booths` }],
      });
    },

    select: (slot, opts = {}) => {
      const shot = slot ? SLOT_BY_ID[slot]?.camera : null;
      // Picking a slot brings the booth tab up, even from a collapsed dock
      const show = slot && opts.panel !== false;
      set((s) => ({
        selected: slot,
        dockOpen: show ? true : s.dockOpen,
        dockTab: show ? "booth" : s.dockTab,
        flyTo: shot && opts.fly !== false ? { ...shot, n: (s.flyTo?.n ?? 0) + 1 } : s.flyTo,
      }));
    },
    setHovered: (slot) => {
      if (get().hovered !== slot) set({ hovered: slot });
    },
    setDock: (open, tab) => set((s) => ({ dockOpen: open, dockTab: tab ?? s.dockTab })),
    fly: (shot) => set((s) => ({ flyTo: { ...shot, n: (s.flyTo?.n ?? 0) + 1 } })),

    place: (slot, template) => {
      const prev = get().booths[slot];
      if (prev?.template === template) return;
      const t = TEMPLATES[template];
      // Switching models keeps the visitor's colours and any pictures that
      // still have a surface on the new model
      const booth: BoothConfig = prev
        ? { ...prev, template, images: Object.fromEntries(Object.entries(prev.images).filter(([k]) => /^(Logo|Image)_/.test(k) || Number(k.slice(-2)) <= t.products)), updatedAt: Date.now() }
        : { template, colors: { ...t.colors }, images: {}, updatedAt: Date.now() };
      set((s) => ({
        booths: { ...s.booths, [slot]: booth },
        log: addLog(s.log, slot, prev ? `Switched to ${t.tier} · ${t.name}` : `Booth placed: ${t.tier} · ${t.name}`),
      }));
    },

    remove: (slot) => {
      if (!get().booths[slot]) return;
      set((s) => {
        const booths = { ...s.booths };
        delete booths[slot];
        return { booths, log: addLog(s.log, slot, "Booth removed") };
      });
    },

    setColor: (slot, key, hex) =>
      updateBooth(slot, (b) => ({ colors: { ...b.colors, [key]: hex } }), `${key[0]!.toUpperCase()}${key.slice(1)} colour → ${hex}`, `${slot}:color:${key}`),

    resetColors: (slot) => updateBooth(slot, (b) => ({ colors: { ...TEMPLATES[b.template].colors } }), "Colours reset to model defaults"),

    setImage: (slot, surface, label, dataUrl) =>
      updateBooth(
        slot,
        (b) => {
          const images = { ...b.images };
          if (dataUrl) images[surface] = dataUrl;
          else delete images[surface];
          return { images };
        },
        dataUrl ? `${label} image added` : `${label} image removed`,
      ),

    requestUpload: (slot, surface) => set((s) => ({ uploadRequest: { slot, surface, n: (s.uploadRequest?.n ?? 0) + 1 } })),

    setExpoName: (name) => set((s) => ({ expoName: name, log: addLog(s.log, "", `Expo renamed to “${name}”`, "name") })),

    randomize: () => {
      const booths = sampleBooths();
      set((s) => ({ booths, selected: null, log: addLog(s.log, "", `Shuffled: ${Object.keys(booths).length} new sample booths`) }));
    },

    resetAll: () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // storage blocked: nothing to clear
      }
      set({ expoName: DEFAULT_EXPO_NAME, booths: {}, log: [], selected: null, seeded: false, hydrated: false });
      get().hydrate();
    },
  };
});

// Writes the saved part of the store back to localStorage, batched so a
// colour drag costs one write per pause rather than one per frame
export function startPersisting() {
  let timer = 0;
  let last: Saved | null = null;
  const write = () => {
    timer = 0;
    const { expoName, booths, log, hydrated } = useExpodia.getState();
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ expoName, booths, log }));
      if (useExpodia.getState().storageError) useExpodia.setState({ storageError: null });
    } catch (e) {
      const quota = e instanceof DOMException && (e.name === "QuotaExceededError" || e.code === 22);
      useExpodia.setState({
        storageError: quota ? "Browser storage is full — remove a few images to keep saving." : "Browser storage is blocked, changes won't be kept.",
      });
    }
  };
  const unsub = useExpodia.subscribe((s) => {
    const next = { expoName: s.expoName, booths: s.booths, log: s.log };
    if (last && last.expoName === next.expoName && last.booths === next.booths && last.log === next.log) return;
    last = next;
    if (!timer) timer = window.setTimeout(write, 250);
  });
  // The sample booths of a first visit are saved straight away, so a reload
  // shows the same expo
  if (useExpodia.getState().seeded) timer = window.setTimeout(write, 250);
  return () => {
    unsub();
    if (timer) {
      clearTimeout(timer);
      write();
    }
  };
}

// Aspect ratio (width / height) of each picture surface, measured from the
// GLBs when they load, so uploads can be cropped to fit
export const surfaceAspect: Partial<Record<TemplateId, Record<string, number>>> = {};

export function storageBytes(state: Pick<Saved, "expoName" | "booths" | "log">) {
  // Browsers cap localStorage by UTF-16 code units (~5M), not bytes
  return JSON.stringify({ expoName: state.expoName, booths: state.booths, log: state.log }).length + STORAGE_KEY.length;
}
