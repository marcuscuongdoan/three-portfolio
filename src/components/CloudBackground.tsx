'use client';

import { motion } from 'framer-motion';
import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';

interface Cloud {
  id: number;
  image: string;
  top: number;
  size: number;
  duration: number;
  delay: number;
  repeat: number; // 0 for one-time, Infinity for continuous
}

interface CloudBackgroundProps {
  opacity?: number;
  maxClouds?: number;
  minDuration?: number;
  maxDuration?: number;
}

export interface CloudBackgroundRef {
  moreCloud: () => void;
  lessCloud: () => void;
  increaseSpeed: () => void;
  decreaseSpeed: () => void;
}

const CloudBackground = forwardRef<CloudBackgroundRef, CloudBackgroundProps>(
  function CloudBackground(
    {
      opacity = 1,
      maxClouds = 10,
      minDuration = 20,
      maxDuration = 40,
    },
    ref
  ) {
    const [clouds, setClouds] = useState<Cloud[]>([]);
    const [containerOpacity, setContainerOpacity] = useState(0); // Start invisible
    const [containerScale, setContainerScale] = useState(5); // Start zoomed in
    const cloudContainerRef = useRef<HTMLDivElement>(null);
    const cloudIdCounter = useRef(0);
    const minDurationRef = useRef(minDuration);
    const maxDurationRef = useRef(maxDuration);

    // Update refs when props change
    useEffect(() => {
      minDurationRef.current = minDuration;
      maxDurationRef.current = maxDuration;
    }, [minDuration, maxDuration]);

    // Generate random cloud
    const generateCloud = (repeat: number = Infinity): Cloud => {
      const cloudImages = ['/clouds/cloud1.png', '/clouds/cloud2.png'];
      
      return {
        id: cloudIdCounter.current++,
        image: cloudImages[Math.floor(Math.random() * cloudImages.length)],
        top: Math.random() * 80, // Random vertical position (0-80%)
        size: Math.random() * 500 + 400, // Random size between 400px and 900px
        duration: Math.random() * (maxDurationRef.current - minDurationRef.current) + minDurationRef.current,
        delay: Math.random() * 5, // Random initial delay
        repeat,
      };
    };

    // Add more clouds
    const moreCloud = () => {
      setClouds((prevClouds) => [...prevClouds, generateCloud(Infinity)]);
    };

    // Remove clouds
    const lessCloud = () => {
      setClouds((prevClouds) => {
        if (prevClouds.length > 0) {
          return prevClouds.slice(0, -1);
        }
        return prevClouds;
      });
    };

    // Increase cloud speed (reduce duration)
    const increaseSpeed = () => {
      setClouds((prevClouds) =>
        prevClouds.map((cloud) => ({
          ...cloud,
          duration: Math.max(5, cloud.duration * 0.8), // Reduce duration by 20%, minimum 5s
        }))
      );
    };

    // Decrease cloud speed (increase duration)
    const decreaseSpeed = () => {
      setClouds((prevClouds) =>
        prevClouds.map((cloud) => ({
          ...cloud,
          duration: Math.min(60, cloud.duration * 1.25), // Increase duration by 25%, maximum 60s
        }))
      );
    };

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      moreCloud,
      lessCloud,
      increaseSpeed,
      decreaseSpeed,
    }));

    // Fade container opacity and scale after 1 second
    useEffect(() => {
      const timer = setTimeout(() => {
        setContainerOpacity(1);
        setContainerScale(1); // Scale back to normal
      }, 1000); // Wait 1 second, then animate
      
      return () => clearTimeout(timer);
    }, []);

    // Handle window resize to ensure clouds animate correctly
    useEffect(() => {
      const handleResize = () => {
        // Force a re-render of cloud positions on resize
        setClouds((prevClouds) => [...prevClouds]);
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Initialize with burst effect that fills screen quickly
    useEffect(() => {
      const burstClouds: Cloud[] = [];
      const cloudImages = ['/clouds/cloud1.png', '/clouds/cloud2.png'];
      const burstCount = 50; // Many clouds for full screen coverage
      
      // Generate burst clouds that start at different positions across the screen
      for (let i = 0; i < burstCount; i++) {
        const baseDuration = Math.random() * (maxDurationRef.current - minDurationRef.current) + minDurationRef.current;
        // Progressive speed: first clouds fast, gradually slower
        const speedMultiplier = 0.1 + (i / burstCount) * 0.9; // 0.1 to 1.0
        const duration = baseDuration * speedMultiplier;
        
        // Spread clouds across the screen horizontally at start (left side)
        const startX = -Math.random() * 120; // -120 to 0% of screen width (some off-screen left)
        
        burstClouds.push({
          id: cloudIdCounter.current++,
          image: cloudImages[Math.floor(Math.random() * cloudImages.length)],
          top: Math.random() * 80,
          size: Math.random() * 500 + 400,
          duration,
          delay: Math.random() * 0.1, // Very quick start
          repeat: 0, // One-time animation
          startX, // Custom property to track start position
        } as any);
      }
      
      setClouds(burstClouds);

      // After 3 seconds, add normal repeating clouds
      const normalTimer = setTimeout(() => {
        const normalClouds: Cloud[] = [];
        for (let i = 0; i < maxClouds; i++) {
          normalClouds.push(generateCloud(Infinity));
        }
        setClouds((prev) => [...prev, ...normalClouds]);
      }, 3000);

      return () => clearTimeout(normalTimer);
    }, []);

    // Update clouds when maxClouds prop changes after initial mount
    useEffect(() => {
      const timer = setTimeout(() => {
        if (clouds.length > 0) {
          // Keep burst clouds, update only infinite repeat clouds
          const burstClouds = clouds.filter(c => c.repeat === 0);
          const normalClouds: Cloud[] = [];
          for (let i = 0; i < maxClouds; i++) {
            normalClouds.push(generateCloud(Infinity));
          }
          setClouds([...burstClouds, ...normalClouds]);
        }
      });

      return () => clearTimeout(timer);
    }, [maxClouds]);

    // Update CSS variable for opacity without re-rendering
    useEffect(() => {
      if (cloudContainerRef.current) {
        cloudContainerRef.current.style.setProperty('--cloud-opacity', opacity.toString());
      }
    }, [opacity]);

    return (
      <div
        ref={cloudContainerRef}
        className="fixed inset-0 bg-black overflow-hidden pointer-events-none"
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
            initial={{ x: (cloud as any).startX !== undefined ? `${(cloud as any).startX}vw` : '-100%' }}
            animate={{ x: '100vw' }}
            transition={{
              duration: cloud.duration,
              delay: cloud.delay,
              repeat: cloud.repeat,
              ease: 'linear',
            }}
          >
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
);

export default CloudBackground;
