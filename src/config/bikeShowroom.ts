/**
 * Shared shape of a bike showroom page (/africa-twin, /mt-09, /r-ninet-pure): everything the
 * 3D scene and the page need to know about one bike — the GLB, how its meshes
 * group into parts, the facts shown for each part, where its lights and
 * exhaust are, and the page theme. One definition per bike lives next to this
 * file (africaTwin.ts, mt09.ts).
 *
 * Model space (every GLB): metres, +Y up, front of the bike towards -Z, the
 * right-hand side towards +X. Positions are before the ground lift (the scene
 * lifts the bike so its tyres sit on y = 0).
 */

import type { CSSProperties } from "react";
import type { EngineSound } from "@/components/bike-showroom/showroomAudio";

type Vec3 = [number, number, number];

export interface BikeSource {
  label: string;
  url: string;
}

export interface BikePart {
  id: string;
  name: string;
  kicker: string;
  // Node names (exact, or prefix when ending with "*") that belong to this
  // part. A mesh goes to the first part (in list order) that matches it
  nodes: string[];
  // How far the part moves out in the exploded view (model space, metres)
  explode: Vec3;
  // Per-node overrides, e.g. front and rear brakes moving in opposite directions
  explodeOverrides?: { nodes: string[]; explode: Vec3 }[];
  // Push while the part is open (default explode.selectedBoost). Parts split
  // front/rear stay close to their wheels instead, or the two halves end up
  // metres apart and too small to see once both are framed
  focusBoost?: number;
  summary: string;
  specs: [label: string, value: string][];
  notes?: string[];
  // Keys into BikeDefinition.sources
  sources: string[];
}

/**
 * How far parts spread. A part sits at `rest + explode × scale × spread`, where
 * spread is 0 assembled, 1 exploded (click), up to 1 + zoomExtra when zooming
 * in, and `focusSpread` while a part is open — that part also gets
 * `selectedBoost` so it pulls clear of the rest.
 */
export interface ExplodeSettings {
  scale: number;
  focusSpread: number;
  selectedBoost: number;
  // Zooming in spreads the parts: none at zoomStart × the overview distance,
  // fully exploded at zoomFull ×, then up to 1 + zoomExtra
  zoomStart: number;
  zoomFull: number;
  zoomExtra: number;
  // The overview camera backs off by this much while exploded
  explodedDolly: number;
}

export const DEFAULT_EXPLODE: ExplodeSettings = {
  scale: 1.5,
  focusSpread: 1.35,
  selectedBoost: 1.6,
  zoomStart: 0.9,
  zoomFull: 0.4,
  zoomExtra: 0.5,
  explodedDolly: 1.3,
};

/**
 * Lights toggle: which meshes glow (only their lens/lamp materials — not the
 * black housings). The glow is emissive, picked up by the bloom pass.
 */
export interface BikeLights {
  glow: { nodes: string[]; color: string; intensity: number }[];
  lampMaterial: RegExp;
  // Headlight beams: spotlights on the floor plus a soft visible cone
  headlights: Vec3[];
  beamDirection: Vec3;
}

/**
 * Suspension while riding: the sprung bike (frame, engine, bodywork, rider's
 * weight) sinks into its sag and rides over the road, while the wheels stay on
 * it. Every mesh not listed below is sprung.
 */
export interface BikeSuspension {
  // Sag at full ride speed, metres: front, rear
  sag: [number, number];
  // Road bumps at full speed, metres
  bump: number;
  // Wheel axles (bike space): the wheels stay put, the sprung bike pitches
  // between them
  frontAxle: Vec3;
  rearAxle: Vec3;
  // Follow the wheels: wheels, discs, calipers, fork sliders, front fender
  unsprung: string[];
  // Squash between the two (brake lines, shock): the bottom stays put, the
  // top follows the sprung bike
  stretch: string[];
  // Swing about `pivot` (on the frame) so the rear axle stays put
  swingarm: string[];
  pivot: Vec3;
}

/** Ride simulation: spinning wheels and discs, exhaust smoke, rear-tyre dust. */
export interface BikeRide {
  wheelNodes: string[];
  // Brake discs (and sprockets) that spin with the wheels — re-centred on
  // themselves first. Only meshes whose material matches `discMaterial`, if set
  discNodes: string[];
  discMaterial?: RegExp;
  // Wheel spin at full speed, rad/s (kept low enough not to strobe)
  spin: number;
  exhaustOutlet: Vec3;
  rearContact: Vec3;
  suspension: BikeSuspension;
}

/**
 * First-load intro, three front-to-back scan sweeps (seconds from the moment
 * loading finishes):
 * 1. scan — the scan edge passes over the bike, leaving a hologram point
 *    cloud behind it, with laser beams on the edge and digital rain behind;
 * 2. shape — the next sweep swaps the hologram for the bare shape (untextured
 *    clay);
 * 3. texture — the last sweep paints the real materials back on, as the
 *    studio lights come back up.
 */
export interface IntroSettings {
  points: number;
  // Model-space Z extent the sweeps run across (front is -Z)
  zFront: number;
  zBack: number;
  scanStart: number;
  scanEnd: number;
  shapeStart: number;
  shapeEnd: number;
  textureStart: number;
  textureEnd: number;
  end: number;
  // Particles settle into place this fast once the edge passes them, from
  // this offset (small: they condense rather than fly in)
  flight: number;
  fromOffset: Vec3;
  // HDR colour, so the bloom pass makes it glow
  color: Vec3;
}

export const INTRO_TIMING = {
  points: 45000,
  scanStart: 0.15,
  scanEnd: 2.55,
  shapeStart: 2.85,
  shapeEnd: 4.2,
  textureStart: 4.35,
  textureEnd: 5.7,
  end: 6.0,
  flight: 0.65,
  fromOffset: [0, 0.12, -0.35] as Vec3,
  color: [0.45, 1.0, 0.85] as Vec3,
};

export interface BikeCamera {
  fov: number;
  position: Vec3;
  target: Vec3;
}

/**
 * Page + scene look. Colours feed CSS variables (see bike-showroom.css) and
 * the studio backdrop.
 */
export interface BikeTheme {
  // Dark page chrome all the time (not only with the lights on)
  dark: boolean;
  // Primary accent: explode button, part numbers, scrollbars
  accent: string;
  accentHover: string;
  // Secondary accent: the ride button
  accent2: string;
  // The three-colour rule under the title and on the part panel
  stripes: [string, string, string];
  // Studio backdrop, lights off / on
  studio: { day: string; night: string };
  // Garage backdrop palette
  garage: "light" | "dark";
}

/**
 * Colour schemes. The GLB ships one paint job; a slot is a set of its
 * materials (by exact material name) that get repainted together — "body"
 * for the main panels, "rims" for the wheel rims, and so on.
 *
 * A paint slot takes a plain finish. A decal slot holds the graphics
 * (transparent textures with black and white artwork): the texture's dark
 * ink is redrawn in `ink`, the white in `light`, keeping its transparency.
 */
export interface PaintFinish {
  color: string;
  metalness?: number;
  roughness?: number;
  // Clear lacquer over the paint (physical materials only): 0 for matt
  clearcoat?: number;
}

export interface DecalFinish {
  ink: string;
  light: string;
}

export interface PaintSlot {
  label: string;
  materials: string[];
  decal?: boolean;
}

export interface BikeLivery {
  id: string;
  // Official colour name, as the maker sells it
  name: string;
  // Model / variant it's sold on, when it isn't the bike on the page itself
  note?: string;
  // Swatch colours, main colour first
  swatch: string[];
  // Finish per slot id (every slot): PaintFinish for paint, DecalFinish for
  // decal slots
  paint: Record<string, PaintFinish | DecalFinish>;
}

export interface BikePaint {
  slots: Record<string, PaintSlot>;
  // The first one is the default
  liveries: BikeLivery[];
  // Where the colour names come from: key into BikeDefinition.sources
  source: string;
}

export interface BikeDefinition {
  // Route, analytics and storage key
  slug: string;
  path: string;
  brand: string;
  // Model code line above the title, e.g. "Honda CRF1100L"
  modelLine: string;
  title: string;
  year: string;
  // Short line in the loading screen and the footer credit
  tagline: string;
  model: string;
  // Nodes in the GLB that are never shown (collision hulls, stray copies)
  hiddenNodes: string[];
  parts: BikePart[];
  sources: Record<string, BikeSource>;
  // Footer credit for the specs: short name + key into `sources`
  credit: { name: string; source: string };
  // The 3D model's author, when its licence asks for attribution
  modelCredit?: { title: string; author: string; url: string; license: string };
  heroSpecs: [value: string, label: string][];
  explode: ExplodeSettings;
  lights: BikeLights;
  paint: BikePaint;
  ride: BikeRide;
  intro: IntroSettings;
  // Synthesised engine for the ride (see showroomAudio.ts)
  sound: EngineSound;
  camera: BikeCamera;
  theme: BikeTheme;
}

// Camera-to-target distance of the overview
export const overviewDistance = (camera: BikeCamera) =>
  Math.hypot(
    camera.position[0] - camera.target[0],
    camera.position[1] - camera.target[1],
    camera.position[2] - camera.target[2],
  );

// GLTFLoader strips characters reserved by animation bindings from node names
// ("chassis.001" loads as "chassis001"), so compare names the same way
const sanitize = (name: string) => name.replace(/[[\].:/]/g, "");

export const matchesNode = (patterns: string[], name: string) => {
  const n = sanitize(name);
  return patterns.some((p) =>
    p.endsWith("*") ? n.startsWith(sanitize(p.slice(0, -1))) : n === sanitize(p),
  );
};

// Toward the sun in the ride world (unit vector): the key light moves here,
// the sky draws the sun here and every shadow in the world falls away from
// it. Front-right and above the overview camera, like the studio key light
export const SUN_DIRECTION: Vec3 = [0.706, 0.53, -0.471];

// CSS variables for a theme (see bike-showroom.css), set on the page root
export const showroomThemeStyle = (theme: BikeTheme) =>
  ({
    "--bk-day": theme.studio.day,
    "--bk-night": theme.studio.night,
    "--bk-accent": theme.accent,
    "--bk-accent-hover": theme.accentHover,
    "--bk-accent-2": theme.accent2,
    "--bk-stripe-1": theme.stripes[0],
    "--bk-stripe-2": theme.stripes[1],
    "--bk-stripe-3": theme.stripes[2],
  }) as CSSProperties;
