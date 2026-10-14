import { createContext, useContext } from "react";

/**
 * Render settings for the scene. The default is tuned for frame rate; "high
 * quality" (the toggle in the header) turns everything up, on any device.
 * Some of these can only be set when the WebGL context is made (antialias,
 * shadows, the number of lights), so the scene remounts when it changes.
 */
export interface Quality {
  high: boolean;
  shadows: boolean;
  // Bloom and tone mapping through the effect composer
  effects: boolean;
  multisampling: number;
  // The canvas' own MSAA: wasted when the composer renders off-screen
  antialias: boolean;
  dpr: [number, number];
  // Lower the resolution when the frame rate drops
  adaptiveDpr: boolean;
  // Refresh the moon's shadow every n frames
  moonShadowEvery: number;
  // Trees and bushes in the lanterns' shadows (six renders each)
  vegetationInLampShadows: boolean;
  // Small decorative point lights (the mailbox glow, the museum picture light);
  // every lit pixel pays for each light in the scene
  accentLights: boolean;
  owlUrl: string;
}

export const OWL_FULL_URL = "/models/owl_web.glb";
// Same model: 1024 WebP textures, resampled animation, meshopt geometry
export const OWL_LITE_URL = "/models/owl_lite.glb";

export function makeQuality(high: boolean, wide: boolean): Quality {
  if (high) {
    return {
      high,
      shadows: true,
      effects: true,
      multisampling: 4,
      antialias: false,
      dpr: [1, 2],
      adaptiveDpr: false,
      moonShadowEvery: 1,
      vegetationInLampShadows: true,
      accentLights: true,
      owlUrl: OWL_FULL_URL,
    };
  }
  // Phones skip shadows and the composer: the frame rate matters more
  return {
    high,
    shadows: wide,
    effects: wide,
    multisampling: 2,
    antialias: !wide,
    dpr: [1, 1.5],
    adaptiveDpr: true,
    moonShadowEvery: 2,
    vegetationInLampShadows: false,
    accentLights: false,
    owlUrl: OWL_LITE_URL,
  };
}

export const QualityContext = createContext<Quality>(makeQuality(false, true));
export const useQuality = () => useContext(QualityContext);

const KEY = "owl-quality";

export function savedHighQuality() {
  try {
    return window.localStorage.getItem(KEY) === "high";
  } catch {
    return false;
  }
}

export function saveHighQuality(high: boolean) {
  try {
    window.localStorage.setItem(KEY, high ? "high" : "auto");
  } catch {}
}
