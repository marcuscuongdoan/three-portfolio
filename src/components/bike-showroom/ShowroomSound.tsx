"use client";

import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useBikeDef } from "@/components/bike-showroom/BikeContext";
import { peekShowroomAudio } from "@/components/bike-showroom/showroomAudio";

/**
 * Feeds the scene's clocks to the synthesised sound (see showroomAudio.ts):
 * the intro clock and the ride speed. Silent until the visitor turns sound
 * on — the page's toggle creates the AudioContext.
 */
export default function ShowroomSound({
  introClock,
  rideLevel,
  riding,
}: {
  introClock: React.RefObject<number>;
  rideLevel: React.RefObject<number>;
  riding: boolean;
}) {
  const { sound, intro } = useBikeDef();

  // Leaving the page silences everything
  useEffect(() => () => peekShowroomAudio()?.stopAll(), []);

  useFrame((_, delta) => {
    const audio = peekShowroomAudio();
    if (!audio?.isEnabled) return;
    const dt = Math.min(delta, 0.1);
    audio.updateIntro(introClock.current, intro, dt);
    audio.updateEngine(sound, riding, rideLevel.current, dt);
  });

  return null;
}
