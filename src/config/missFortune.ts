/**
 * Gun Goddess Miss Fortune — model + animation config.
 *
 * The 4 skin variants share the same rig (1 skin, 179 nodes) and the exact
 * same 42 animation clips, so every clip below works on every variant.
 *
 * `clip` is the raw AnimationClip name inside the GLB (use it with
 * useAnimations / mixer.clipAction). `duration` is in seconds, read from the
 * GLB. `loop` is inferred from the clip name — verify in-scene before relying on it.
 */

export const MISS_FORTUNE_MODELS = {
  base: "/models/miss_fortune/gun_goddess_miss_fortune_base.glb",
  purple: "/models/miss_fortune/gun_goddess_miss_fortune_purple.glb",
  red: "/models/miss_fortune/gun_goddess_miss_fortune_red.glb",
  yellow: "/models/miss_fortune/gun_goddess_miss_fortune_yellow.glb",
} as const;

export type MissFortuneVariant = keyof typeof MISS_FORTUNE_MODELS;

// Display info for the skin picker
export const MISS_FORTUNE_SKINS: Record<
  MissFortuneVariant,
  { label: string; swatch: string }
> = {
  base: { label: "Base", swatch: "#1E2A47" },
  purple: { label: "Purple", swatch: "#7C3AED" },
  red: { label: "Red", swatch: "#DC2626" },
  yellow: { label: "Yellow", swatch: "#EAB308" },
};

export type MissFortuneAnimationCategory =
  | "idle"
  | "locomotion"
  | "combat"
  | "spell"
  | "emote"
  | "state";

export interface MissFortuneAnimation {
  clip: string;
  duration: number;
  loop: boolean;
  category: MissFortuneAnimationCategory;
}

export const MISS_FORTUNE_ANIMATIONS = {
  // Idle
  idle1: { clip: "Idle1_Base", duration: 1.667, loop: true, category: "idle" },
  idle2: { clip: "Idle2_Base", duration: 4.0, loop: true, category: "idle" },
  idle3: { clip: "missfortune_skin16_idle3.anm", duration: 3.333, loop: true, category: "idle" },
  idleIn: { clip: "Idle_In", duration: 3.333, loop: false, category: "idle" },
  idleIn2: { clip: "Idle_In2", duration: 0.667, loop: false, category: "idle" },

  // Locomotion
  run: { clip: "Run", duration: 0.8, loop: true, category: "locomotion" },
  run2: { clip: "Run2", duration: 1.0, loop: true, category: "locomotion" },
  runIn: { clip: "Run_In", duration: 1.167, loop: false, category: "locomotion" },
  runIn2: { clip: "Run_In2", duration: 1.267, loop: false, category: "locomotion" },
  runW2: { clip: "Run_W2", duration: 2.667, loop: true, category: "locomotion" },
  runW2In: { clip: "Run_W2_in", duration: 0.6, loop: false, category: "locomotion" },
  runHomeguard: { clip: "Run_Homeguard", duration: 1.967, loop: true, category: "locomotion" },
  runHomeguardIn: { clip: "Run_Homeguard_IN", duration: 1.333, loop: false, category: "locomotion" },

  // Combat
  attack1: { clip: "Attack1", duration: 2.667, loop: false, category: "combat" },
  attack2: { clip: "Attack2", duration: 2.667, loop: false, category: "combat" },
  crit: { clip: "Crit", duration: 2.667, loop: false, category: "combat" },
  equip: { clip: "Equip", duration: 2.0, loop: false, category: "combat" },

  // Spells
  spell1: { clip: "Spell1", duration: 1.333, loop: false, category: "spell" },
  spell3: { clip: "Spell3", duration: 1.333, loop: false, category: "spell" },
  spell4Windup: { clip: "Spell4_Windup", duration: 0.333, loop: false, category: "spell" },
  spell4Loop: { clip: "Spell4_Loop", duration: 1.067, loop: true, category: "spell" },
  spell4ToIdle: { clip: "missfortune_skin16_spell4_to_idle.anm", duration: 1.5, loop: false, category: "spell" },
  spell4G1Windup: { clip: "missfortune_skin16_spell4_G1_windup.anm", duration: 0.333, loop: false, category: "spell" },
  spell4G1Loop: { clip: "missfortune_skin16_spell4_G1_loop.anm", duration: 1.067, loop: true, category: "spell" },
  spell4G1ToIdle: { clip: "missfortune_skin16_spell4_G1_transtoIDLE.anm", duration: 0.867, loop: false, category: "spell" },
  spell4G2Windup: { clip: "missfortune_skin16_spell4_G2_windup.anm", duration: 0.333, loop: false, category: "spell" },
  spell4G2Loop: { clip: "missfortune_skin16_spell4_G2_loop.anm", duration: 2.0, loop: true, category: "spell" },
  spell4G2ToIdle: { clip: "missfortune_skin16_spell4_G2_transtoidle.anm", duration: 1.133, loop: false, category: "spell" },
  spell4G3Windup: { clip: "missfortune_skin16_spell4_G3_windup.anm", duration: 0.233, loop: false, category: "spell" },
  spell4G3Loop: { clip: "missfortune_skin16_spell4_G3_loop.anm", duration: 1.067, loop: true, category: "spell" },
  spell4G3ToIdle: { clip: "missfortune_skin16_spell4_G3_transtoidle.anm", duration: 1.067, loop: false, category: "spell" },
  channelIn: { clip: "Channel_In", duration: 0.333, loop: false, category: "spell" },
  channel: { clip: "Channel", duration: 0.667, loop: true, category: "spell" },

  // Emotes
  danceIn: { clip: "Dance_In", duration: 0.833, loop: false, category: "emote" },
  dance: { clip: "Dance", duration: 7.8, loop: true, category: "emote" },
  joke: { clip: "Joke", duration: 8.367, loop: false, category: "emote" },
  laugh: { clip: "Laugh", duration: 4.867, loop: false, category: "emote" },
  taunt: { clip: "Taunt", duration: 5.167, loop: false, category: "emote" },

  // State
  recall: { clip: "Recall", duration: 8.667, loop: false, category: "state" },
  recallWinddown: { clip: "Recall_Winddown", duration: 4.433, loop: false, category: "state" },
  respawn: { clip: "Respawn", duration: 4.433, loop: false, category: "state" },
  death: { clip: "Death", duration: 4.033, loop: false, category: "state" },
} as const satisfies Record<string, MissFortuneAnimation>;

export type MissFortuneAnimationKey = keyof typeof MISS_FORTUNE_ANIMATIONS;
