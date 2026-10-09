"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useFBX } from "@react-three/drei";
import CharacterScene, {
  CharacterConfig,
  CharacterSceneCallbacks,
} from "@/components/three/CharacterScene";

export const BOT_MODEL_PATH = "/models/bot.fbx";

const ANIMATION_FILES = {
  idle: "/models/idle.fbx",
  walking: "/models/walking.fbx",
  cheering: "/models/cheering.fbx",
  falling: "/models/falling.fbx",
  "falling-impact": "/models/falling-impact.fbx",
  "standing-up": "/models/standing-up.fbx",
  "entering-code": "/models/entering-code.fbx",
} as const;

const BOT_CONFIG: CharacterConfig = {
  // Aliases accepted by playCharacterAnimation (kept from the old World3D API)
  aliases: {
    idle: "idle",
    walk: "walking",
    walking: "walking",
    run: "walking",
    cheering: "cheering",
    agree: "cheering",
    falling: "falling",
    "falling-impact": "falling-impact",
    impact: "falling-impact",
    "standing-up": "standing-up",
    standup: "standing-up",
    "entering-code": "entering-code",
    enteringcode: "entering-code",
    typing: "entering-code",
    coding: "entering-code",
  },
  idleClip: "idle",
  // falling -> impact -> standing-up (2.5x) -> idle
  spawn: [
    { clip: "falling", loop: true, fadeIn: 0.3, fadeOut: 0.4, advanceAfterMs: 800 },
    { clip: "falling-impact", fadeIn: 0.4, fadeOut: 0.3 },
    { clip: "standing-up", timeScale: 2.5, fadeIn: 0.3, fadeOut: 0.5, holdMs: 300 },
  ],
  scale: 0.01,
  rotation: [0, Math.PI * 0.15, 0],
  addEmissive: true,
};

interface BotCharacterProps extends CharacterSceneCallbacks {
  modelPath?: string;
}

export default function BotCharacter({
  modelPath = BOT_MODEL_PATH,
  ...callbacks
}: BotCharacterProps) {
  // Load base model + animation clips (drei caches loads across remounts)
  const model = useFBX(modelPath);
  const idleFbx = useFBX(ANIMATION_FILES.idle);
  const walkingFbx = useFBX(ANIMATION_FILES.walking);
  const cheeringFbx = useFBX(ANIMATION_FILES.cheering);
  const fallingFbx = useFBX(ANIMATION_FILES.falling);
  const fallingImpactFbx = useFBX(ANIMATION_FILES["falling-impact"]);
  const standingUpFbx = useFBX(ANIMATION_FILES["standing-up"]);
  const enteringCodeFbx = useFBX(ANIMATION_FILES["entering-code"]);

  const clips = useMemo(() => {
    const sources: [string, THREE.Group][] = [
      ["idle", idleFbx],
      ["walking", walkingFbx],
      ["cheering", cheeringFbx],
      ["falling", fallingFbx],
      ["falling-impact", fallingImpactFbx],
      ["standing-up", standingUpFbx],
      ["entering-code", enteringCodeFbx],
    ];
    return sources.flatMap(([name, fbx]) => {
      const clip = fbx.animations[0];
      if (!clip) {
        console.warn(`No animation clip found for '${name}'`);
        return [];
      }
      const renamed = clip.clone();
      renamed.name = name;
      return [renamed];
    });
  }, [
    idleFbx,
    walkingFbx,
    cheeringFbx,
    fallingFbx,
    fallingImpactFbx,
    standingUpFbx,
    enteringCodeFbx,
  ]);

  return (
    <CharacterScene model={model} clips={clips} config={BOT_CONFIG} {...callbacks} />
  );
}

// Preload character + animations so navigation feels instant
useFBX.preload(BOT_MODEL_PATH);
Object.values(ANIMATION_FILES).forEach((path) => useFBX.preload(path));
