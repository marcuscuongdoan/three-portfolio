'use client';

import { motion } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';

const CLOUD_IMAGES = ['/clouds/cloud1.webp', '/clouds/cloud2.webp'];

interface Cloud {
  id: number;
  image: string;
  top: number;
  size: number;
  duration: number;
  delay: number;
  repeat: number; // 0 for one-time, Infinity for continuous
  startX?: number; // Custom start position (vw) for burst clouds
}

interface CloudBackgroundProps {
  opacity?: number;
  maxClouds?: number;
  minDuration?: number;
  maxDuration?: number;
}

export default function CloudBackground({
  opacity = 1,
  maxClouds = 10,
  minDuration = 20,
  maxDuration = 40,
}: CloudBackgroundProps) {
  const [clouds, setClouds] = useState<Cloud[]>([]);
  const [containerOpacity, setContainerOpacity] = useState(0); // Start invisible
  const [containerScale, setContainerScale] = useState(5); // Start zoomed in
  const cloudContainerRef = useRef<HTMLDivElement>(null);
  const cloudIdCounter = useRef(0);
  const minDurationRef = useRef(minDuration);
  const maxDurationRef = useRef(maxDuration);
  const hasInitialized = useRef(false);

  // Update refs when props change
  useEffect(() => {
    minDurationRef.current = minDuration;
    maxDurationRef.current = maxDuration;
  }, [minDuration, maxDuration]);

  // Fade container opacity and scale after 1 second
  useEffect(() => {
    const timer = setTimeout(() => {
      setContainerOpacity(1);
      setContainerScale(1); // Scale back to normal
    }, 1000); // Wait 1 second, then animate

    return () => clearTimeout(timer);
  }, []);

  // Initial burst + repeating clouds; adapts when maxClouds changes
  useEffect(() => {
    const randomDuration = () =>
      Math.random() * (maxDurationRef.current - minDurationRef.current) +
      minDurationRef.current;

    const randomImage = () =>
      CLOUD_IMAGES[Math.floor(Math.random() * CLOUD_IMAGES.length)] ??
      CLOUD_IMAGES[0] ??
      '';

    const generateCloud = (repeat: number): Cloud => ({
      id: cloudIdCounter.current++,
      image: randomImage(),
      top: Math.random() * 80, // Random vertical position (0-80%)
      size: Math.random() * 500 + 400, // Random size between 400px and 900px
      duration: randomDuration(),
      delay: Math.random() * 5, // Random initial delay
      repeat,
    });

    const makeNormalClouds = () =>
      Array.from({ length: maxClouds }, () => generateCloud(Infinity));

    if (hasInitialized.current) {
      // maxClouds changed after mount (e.g. mobile detection flipped):
      // trim burst clouds to the new budget and regenerate repeating ones
      setClouds((prev) => [
        ...prev.filter((c) => c.repeat === 0).slice(0, maxClouds),
        ...makeNormalClouds(),
      ]);
      return;
    }
    hasInitialized.current = true;

    // Burst effect that fills the screen quickly, capped by maxClouds so
    // low-power devices don't animate 50 large images at once
    const burstCount = Math.min(50, maxClouds);
    const burstClouds: Cloud[] = [];

    for (let i = 0; i < burstCount; i++) {
      // Progressive speed: first clouds fast, gradually slower
      const speedMultiplier = 0.1 + (i / burstCount) * 0.9; // 0.1 to 1.0

      burstClouds.push({
        id: cloudIdCounter.current++,
        image: randomImage(),
        top: Math.random() * 80,
        size: Math.random() * 500 + 400,
        duration: randomDuration() * speedMultiplier,
        delay: Math.random() * 0.1, // Very quick start
        repeat: 0, // One-time animation
        // Spread clouds across the screen horizontally at start (some off-screen left)
        startX: -Math.random() * 120,
      });
    }

    setClouds(burstClouds);

    // After 3 seconds, add normal repeating clouds
    const normalTimer = setTimeout(() => {
      setClouds((prev) => [...prev, ...makeNormalClouds()]);
    }, 3000);

    return () => clearTimeout(normalTimer);
  }, [maxClouds]);

  return (
    <div
      ref={cloudContainerRef}
      className="fixed inset-0 bg-background overflow-hidden pointer-events-none"
      style={{
        zIndex: 0,
        opacity: containerOpacity,
        transform: `scale(${containerScale})`,
        transition: 'opacity 0.5s ease-out, transform 1s ease-out',
        ['--cloud-opacity' as string]: opacity, // Use prop opacity for individual clouds
      }}
    >
      {clouds.map((cloud) => (
        <motion.div
          key={cloud.id}
          className="absolute"
          style={{
            top: `${cloud.top}%`,
            width: `${cloud.size}px`,
            height: `${cloud.size}px`,
            opacity: 'var(--cloud-opacity)',
          }}
          initial={{ x: cloud.startX !== undefined ? `${cloud.startX}vw` : '-100%' }}
          animate={{ x: '100vw' }}
          transition={{
            duration: cloud.duration,
            delay: cloud.delay,
            repeat: cloud.repeat,
            ease: 'linear',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative pre-optimized webp; next/image adds no value for dozens of animated instances */}
          <img
            src={cloud.image}
            alt=""
            className="w-full h-full object-contain"
            draggable={false}
          />
        </motion.div>
      ))}
    </div>
  );
}
