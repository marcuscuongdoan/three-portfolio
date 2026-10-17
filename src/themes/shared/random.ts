/** A small seeded PRNG, so scattered decorations land in the same places every visit */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Roughly where the camera sits at the home stop, for decorations to face
export const HOME_EYE = { x: 0.45, y: 3.3, z: 2 } as const;
