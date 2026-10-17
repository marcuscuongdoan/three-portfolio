// /khoc-block — portrait lit to "Khóc Blóck" (Phùng Khánh Linh), second chorus to `stopAt`.
// Times are seconds into the track; `offset` shifts them all onto the YouTube
// audio. In `npm run dev`, press K on the shouted "Khóc" to measure the offset,
// or nudge it with [ and ].

// Official audio on the artist's own channel, played through the YouTube embed
export const KHOC_BLOCK_YOUTUBE_ID = "dpOyG5BFBeY";
export const KHOC_BLOCK_PORTRAIT = "/khoc-block/portrait.webp";

export const KHOC_BLOCK_TIMING = {
  // Seconds the YouTube audio runs ahead of these cue times
  offset: 0,
  // Where playback starts: just before the second chorus
  chorusStart: 114.87,
  // The second chorus shouts "Khóc, Blóck" twice; every word flashes, shows
  // itself and lights one area. Shifted from the hand-tuned first-chorus times
  // (54 / 55.37 / 60 / 61.48) by the gap between the choruses in the synced
  // lyrics: +62.37s for the first shout, +61.61s for the second
  hits: [
    { at: 115.55, word: "KHÓC", spot: "shoulder" },
    { at: 117.01, word: "BLÓCK", spot: "crown" },
    { at: 121.61, word: "KHÓC", spot: "hand" },
    { at: 123.09, word: "BLÓCK", spot: "face" },
  ],
  // After the last flash the whole portrait brightens gradually: it starts
  // evenDelay seconds after the last hit (once its strobe has died) and takes evenRamp
  evenDelay: 0.5,
  evenRamp: 4,
  // Seconds a hit's title flash stays on screen
  flashHold: 1.1,
  // Where the music stops (end of the second chorus); null plays to the end of the track
  stopAt: 142 as number | null,
  // Seconds the volume fades down before stopAt
  fadeOut: 1.5,
  // Track length, for the silent fallback when the player can't load
  duration: 186,
} as const;

// Areas the hits light, as fractions of the portrait (x from the left, y from the top)
export const KHOC_BLOCK_SPOTS = [
  { id: "shoulder", x: 0.17, y: 0.45, radius: 0.32 },
  { id: "crown", x: 0.37, y: 0.15, radius: 0.3 },
  { id: "hand", x: 0.8, y: 0.74, radius: 0.28 },
  { id: "face", x: 0.45, y: 0.31, radius: 0.24 },
] as const;
