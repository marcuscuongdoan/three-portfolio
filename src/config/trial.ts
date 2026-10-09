import { MISS_FORTUNE_MODELS } from "@/config/missFortune";

/**
 * Legends standing around the campfire on /trial.
 *
 * Every skin of a legend shares one rig (same bones + clips), so the first skin
 * is loaded as the rig and the others only swap meshes onto it.
 *
 * Facts: Riot's client data (via CommunityDragon) and the League of Legends wiki.
 * Thumbnails live in /public/trial — animated splashes for Pulsefire Ezreal and
 * Gun Goddess Miss Fortune, and Kayle's Divine Ascent ability clip (Aether Wing
 * Kayle has no animated splash).
 */

export type LegendId = "miss-fortune" | "ezreal" | "kayle";

export interface LegendSkin {
  label: string;
  // Small line under the label, e.g. the in-game unlock level
  caption: string;
  modelPath: string;
  swatch: string;
  // Played once when switching to this skin, then back to idle
  swapClip?: string;
}

export interface Legend {
  id: LegendId;
  name: string;
  title: string;
  region: string;
  roles: string[];
  accent: string;
  thumbnail: { video: string; poster: string; credit: string };
  lore: string;
  skin: {
    name: string;
    rarity: string;
    released: string;
    price: string;
    description: string;
    // Heading for the skin picker
    pickerLabel: string;
  };
  abilities: { key: "P" | "Q" | "W" | "E" | "R"; name: string }[];
  skins: LegendSkin[];
  idleClip: string;
  // Played once when the legend is focused, then back to idle
  focusClip: string;
  // Played once when the page finishes loading, then idle
  spawnClip: string;
}

export const LEGENDS: Record<LegendId, Legend> = {
  "miss-fortune": {
    id: "miss-fortune",
    name: "Miss Fortune",
    title: "the Bounty Hunter",
    region: "Bilgewater",
    roles: ["Marksman"],
    accent: "#e0457b",
    thumbnail: {
      video: "/trial/miss-fortune.webm",
      poster: "/trial/miss-fortune.jpg",
      credit: "Gun Goddess animated splash · Riot Games",
    },
    lore:
      "Sarah Fortune is a Bilgewater captain famed for her looks and feared for her ruthlessness. As a child she watched the reaver king Gangplank murder her family; years later she took her revenge by blowing up his flagship with him aboard.",
    skin: {
      name: "Gun Goddess Miss Fortune",
      rarity: "Ultimate",
      released: "22 Mar 2018",
      price: "2775 RP",
      description:
        "A legendary bounty hunter piloting the deadliest combat exosuit in known space. Four exosuits can be swapped at the fountain, each with its own weapons and effects.",
      pickerLabel: "Exosuit",
    },
    abilities: [
      { key: "P", name: "Love Tap" },
      { key: "Q", name: "Double Up" },
      { key: "W", name: "Strut" },
      { key: "E", name: "Make It Rain" },
      { key: "R", name: "Bullet Time" },
    ],
    skins: [
      {
        label: "Scarlet Fair",
        caption: "Default suit",
        modelPath: MISS_FORTUNE_MODELS.base,
        swatch: "#2b4a7a",
        swapClip: "Equip",
      },
      {
        label: "Zero Hour",
        caption: "Dark matter",
        modelPath: MISS_FORTUNE_MODELS.purple,
        swatch: "#7c3aed",
        swapClip: "Equip",
      },
      {
        label: "Starswarm",
        caption: "Sunborn swarm",
        modelPath: MISS_FORTUNE_MODELS.red,
        swatch: "#dc2626",
        swapClip: "Equip",
      },
      {
        label: "Royal Arms",
        caption: "Antimatter warheads",
        modelPath: MISS_FORTUNE_MODELS.yellow,
        swatch: "#eab308",
        swapClip: "Equip",
      },
    ],
    idleClip: "Idle1_Base",
    focusClip: "Taunt",
    spawnClip: "Respawn",
  },

  ezreal: {
    id: "ezreal",
    name: "Ezreal",
    title: "the Prodigal Explorer",
    region: "Piltover",
    roles: ["Marksman", "Mage"],
    accent: "#38bdf8",
    thumbnail: {
      video: "/trial/ezreal.webm",
      poster: "/trial/ezreal.jpg",
      credit: "Pulsefire Ezreal animated splash · Riot Games",
    },
    lore:
      "A dashing adventurer, unknowingly gifted in the magical arts, Ezreal raids long-lost catacombs, tangles with ancient curses and overcomes seemingly impossible odds with ease — improvising his way out of any situation, mostly on wit and his mystical Shuriman gauntlet.",
    skin: {
      name: "Pulsefire Ezreal",
      rarity: "Ultimate",
      released: "29 Jun 2012",
      price: "3250 RP",
      description:
        "A time-hopping explorer wanted by the Remembrancers. The first skin ever priced at 3250 RP — the Pulsefire armor upgrades every time Ezreal ranks up Trueshot Barrage.",
      pickerLabel: "Evolution",
    },
    abilities: [
      { key: "P", name: "Rising Spell Force" },
      { key: "Q", name: "Mystic Shot" },
      { key: "W", name: "Essence Flux" },
      { key: "E", name: "Arcane Shift" },
      { key: "R", name: "Trueshot Barrage" },
    ],
    skins: [
      {
        label: "Level 1",
        caption: "Base armor",
        modelPath: "/models/ezreal/pulsefire_ezreal.glb",
        swatch: "#64748b",
        swapClip: "Ezreal_Skin5_transform.anm",
      },
      {
        label: "Level 6",
        caption: "1st upgrade",
        modelPath: "/models/ezreal/pulsefire_ezreal_2nd.glb",
        swatch: "#0ea5e9",
        swapClip: "Ezreal_Skin5_transform.anm",
      },
      {
        label: "Level 11",
        caption: "2nd upgrade",
        modelPath: "/models/ezreal/pulsefire_ezreal_3rd.glb",
        swatch: "#6366f1",
        swapClip: "Ezreal_Skin5_transform.anm",
      },
      {
        label: "Final",
        caption: "Level 16 · max",
        modelPath: "/models/ezreal/pulsefire_ezreal_max.glb",
        swatch: "#facc15",
        swapClip: "Ezreal_Skin5_transform.anm",
      },
    ],
    idleClip: "Idle_Base",
    focusClip: "Laugh",
    spawnClip: "Respawn",
  },

  kayle: {
    id: "kayle",
    name: "Kayle",
    title: "the Righteous",
    region: "Demacia",
    roles: ["Fighter", "Marksman"],
    accent: "#fbbf24",
    thumbnail: {
      video: "/trial/kayle.webm",
      poster: "/trial/kayle.jpg",
      credit: "Divine Ascent ability preview · Riot Games",
    },
    lore:
      "Born to a Targonian Aspect at the height of the Rune Wars, Kayle honored her mother's legacy by fighting for justice on wings of divine flame. She and her twin sister Morgana protected Demacia for many years — until Kayle grew disillusioned with the failings of mortals.",
    skin: {
      name: "Aether Wing Kayle",
      rarity: "Legendary",
      released: "18 Jan 2013",
      price: "1820 RP",
      description:
        "Pilot of the X07-Gevurah combat exosuit and justicar of the Royal Space Military. Over the course of a game the exosuit grows in power with Kayle's Divine Ascent.",
      pickerLabel: "Ascension",
    },
    abilities: [
      { key: "P", name: "Divine Ascent" },
      { key: "Q", name: "Radiant Blast" },
      { key: "W", name: "Celestial Blessing" },
      { key: "E", name: "Starfire Spellblade" },
      { key: "R", name: "Divine Judgment" },
    ],
    skins: [
      {
        label: "Level 1",
        caption: "Base form",
        modelPath: "/models/kayle/aether_wing_kayle.glb",
        swatch: "#94a3b8",
        swapClip: "Idle_In",
      },
      {
        label: "Level 6",
        caption: "1st ascension",
        modelPath: "/models/kayle/aether_wing_kayle_2nd.glb",
        swatch: "#38bdf8",
        swapClip: "Evolve1",
      },
      {
        label: "Level 11",
        caption: "2nd ascension",
        modelPath: "/models/kayle/aether_wing_kayle_3rd.glb",
        swatch: "#f59e0b",
        swapClip: "Evolve2",
      },
      {
        label: "Final",
        caption: "Level 16 · transcendent",
        modelPath: "/models/kayle/aether_wing_kayle_final.glb",
        swatch: "#fde047",
        swapClip: "Evolve3",
      },
    ],
    idleClip: "Idle1_Base",
    focusClip: "Taunt",
    spawnClip: "Respawn",
  },
};

/** A spot around the campfire; `legend: null` is an empty slot. */
export interface TrialSlot {
  key: string;
  legend: LegendId | null;
  position: [number, number, number];
}

export const TRIAL_SLOTS: TrialSlot[] = [
  { key: "slot-1", legend: "miss-fortune", position: [-2.4, 0, 1.5] },
  { key: "slot-2", legend: "ezreal", position: [-0.95, 0, -0.7] },
  { key: "slot-3", legend: "kayle", position: [0.95, 0, -0.9] },
  { key: "slot-4", legend: null, position: [2.4, 0, 0.9] },
];

// First-load intro: the camera dives from high above the camp down to the
// overview, flying through a cloud bank on the way
export const TRIAL_INTRO = {
  durationMs: 3400,
  startPosition: [0, 18, 38] as [number, number, number],
  portraitStartPosition: [0, 22, 52] as [number, number, number],
  startLookAt: [0, 5, 0] as [number, number, number],
  // Legends start spawning this long into the intro (as the camera arrives)
  spawnDelayMs: 2300,
};

// Intro flight progress (0..1) for a raw time fraction; shared by the camera
// and the clouds so the clouds fade exactly as the camera passes them
export const introEase = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

// Gap between legends starting their spawn clip, in ms
export const TRIAL_SPAWN_STAGGER = 280;

// Every model is scaled to this height (world units) so framing is predictable
export const TRIAL_MODEL_HEIGHT = 1.8;

// Overview camera; on portrait screens it pulls further back to fit all 4
export const TRIAL_CAMERA = {
  fov: 40,
  position: [0, 2.3, 7.6] as [number, number, number],
  // Far enough back that all 4 slots (and their labels) fit a ~9:19 phone
  portraitPosition: [0, 6.5, 24] as [number, number, number],
  lookAt: [0, 1, 0] as [number, number, number],
  portraitLookAt: [0, 0.8, 0] as [number, number, number],
  // Distance from a focused legend
  focusDistance: 3.4,
  // Where a focused legend sits horizontally on landscape screens, in NDC
  // (-1 = left edge, 0 = centre); the content panel takes the right side
  focusScreenX: -0.42,
};

// Below `breakpoint` the focus view stacks: legend in the strip under the
// header, content panel across the bottom `panelFraction` of the screen
export const TRIAL_MOBILE = {
  breakpoint: 640, // Tailwind `sm`
  headerPx: 56, // h-14 top bar
  panelFraction: 0.56,
  // Share of the strip's height the legend fills
  modelFill: 0.82,
};

export const TRIAL_CAMPFIRE_POSITION: [number, number, number] = [0, 0, 1.6];

export type TimeOfDay = "day" | "night";

// Daytime by local clock, used until the visitor flips the toggle
export const isDaytime = (date = new Date()) => {
  const hour = date.getHours();
  return hour >= 6 && hour < 18;
};
