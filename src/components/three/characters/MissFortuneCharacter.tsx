"use client";

import { Suspense, useEffect, useState } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import CharacterScene, {
  CharacterConfig,
  CharacterSceneCallbacks,
} from "@/components/three/CharacterScene";
import {
  MISS_FORTUNE_ANIMATIONS,
  MISS_FORTUNE_MODELS,
} from "@/config/missFortune";
import { useWorld3DStore } from "@/store/useWorld3DStore";
import { applySkin } from "@/lib/skinSwap";

const A = MISS_FORTUNE_ANIMATIONS;

const MISS_FORTUNE_CONFIG: CharacterConfig = {
  aliases: {
    // Every config key works directly, e.g. playCharacterAnimation("spell4G2Loop")
    ...Object.fromEntries(
      Object.entries(A).map(([key, anim]) => [key.toLowerCase(), anim.clip]),
    ),
    // Names the shared page sections ask for (same API as the bot)
    idle: A.idle1.clip,
    walk: A.run.clip,
    walking: A.run.clip,
    typing: A.idle2.clip,
    coding: A.idle2.clip,
    "entering-code": A.idle2.clip,
    enteringcode: A.idle2.clip,
    cheering: A.laugh.clip,
    agree: A.laugh.clip,
  },
  idleClip: A.idle1.clip,
  spawn: [{ clip: A.respawn.clip, fadeIn: 0.2, fadeOut: 0.5 }],
  headBoneName: "Head",
  scale: 1.2,
  rotation: [0, Math.PI * 0.15, 0],
};

// Rendered as the skin's Suspense fallback: flags the download in the store
function SkinLoading() {
  const setModelSwapping = useWorld3DStore((s) => s.setModelSwapping);
  useEffect(() => {
    setModelSwapping(true);
    return () => setModelSwapping(false);
  }, [setModelSwapping]);
  return null;
}

function Skin({ rig, modelPath }: { rig: THREE.Object3D; modelPath: string }) {
  const { scene } = useGLTF(modelPath);
  useEffect(() => {
    applySkin(rig, scene);
  }, [rig, scene]);
  return null;
}

interface MissFortuneCharacterProps extends CharacterSceneCallbacks {
  modelPath?: string;
}

export default function MissFortuneCharacter({
  modelPath = MISS_FORTUNE_MODELS.base,
  ...callbacks
}: MissFortuneCharacterProps) {
  // The first skin loaded is the rig: its skeleton and clips drive every skin,
  // so later skin changes only swap meshes (no remount, no respawn replay)
  const [rigPath] = useState(modelPath);
  const { scene: rig, animations } = useGLTF(rigPath);

  return (
    <>
      <CharacterScene
        model={rig}
        clips={animations}
        config={MISS_FORTUNE_CONFIG}
        {...callbacks}
      />
      {/* Own boundary so a downloading skin never hides the current one */}
      <Suspense fallback={<SkinLoading />}>
        <Skin rig={rig} modelPath={modelPath} />
      </Suspense>
    </>
  );
}
