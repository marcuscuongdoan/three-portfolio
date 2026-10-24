// Layout and booth catalogue for /expodia. Slot positions come from
// public/expodia/slots.json (exported alongside expo.glb, metres, Y up);
// each booth GLB faces +X in its own space.
import slotsFile from "../../public/expodia/slots.json";

export const EXPODIA_DIR = "/expodia";
export const EXPO_FILE = `${EXPODIA_DIR}/expo.glb`;
export const HDRI_FILE = `${EXPODIA_DIR}/${slotsFile.environment_hdri}`;
export const DEFAULT_EXPO_NAME = "Expodia 2026";

export type Tier = "Basic" | "Pro" | "Premium";
export const TIERS: Tier[] = ["Basic", "Pro", "Premium"];

export type TemplateId =
  | "Booth_Basic_T01"
  | "Booth_Basic_T02"
  | "Booth_Pro_T01"
  | "Booth_Pro_T02"
  | "Booth_Pre_T01"
  | "Booth_Pre_T02";

export interface BoothColors {
  primary: string;
  secondary: string;
  glow: string;
}

export interface TemplateInfo {
  id: TemplateId;
  tier: Tier;
  name: string;
  products: number;
  video: boolean;
  // The materials' own colours (sRGB), used until the visitor picks others
  colors: BoothColors;
}

export const TEMPLATES: Record<TemplateId, TemplateInfo> = {
  Booth_Basic_T01: { id: "Booth_Basic_T01", tier: "Basic", name: "Corner Kiosk", products: 3, video: false, colors: { primary: "#3f89e1", secondary: "#f6f7f9", glow: "#7cf3ff" } },
  Booth_Basic_T02: { id: "Booth_Basic_T02", tier: "Basic", name: "Open Stand", products: 3, video: false, colors: { primary: "#00c4bc", secondary: "#f9f9fc", glow: "#ffc46c" } },
  Booth_Pro_T01: { id: "Booth_Pro_T01", tier: "Pro", name: "Media Wall", products: 5, video: true, colors: { primary: "#ed893f", secondary: "#f6f7f9", glow: "#7cf3ff" } },
  Booth_Pro_T02: { id: "Booth_Pro_T02", tier: "Pro", name: "Ring Pavilion", products: 5, video: true, colors: { primary: "#b359e1", secondary: "#f7f7fa", glow: "#ffc46c" } },
  Booth_Pre_T01: { id: "Booth_Pre_T01", tier: "Premium", name: "Glass Showroom", products: 8, video: true, colors: { primary: "#a059da", secondary: "#f3f3f6", glow: "#ffc46c" } },
  Booth_Pre_T02: { id: "Booth_Pre_T02", tier: "Premium", name: "Halo Tower", products: 8, video: true, colors: { primary: "#00aacb", secondary: "#f9f9fc", glow: "#7cf3ff" } },
};

export const TEMPLATE_IDS = Object.keys(TEMPLATES) as TemplateId[];
export const templateFile = (id: TemplateId) => `${EXPODIA_DIR}/${id}.glb`;

export const TIER_INFO: Record<Tier, { rank: number; color: string; footprint: number; templates: [TemplateId, TemplateId] }> = {
  Basic: { rank: 0, color: "#5ec2ff", footprint: 8, templates: ["Booth_Basic_T01", "Booth_Basic_T02"] },
  Pro: { rank: 1, color: "#ffb84d", footprint: 11, templates: ["Booth_Pro_T01", "Booth_Pro_T02"] },
  Premium: { rank: 2, color: "#d78bff", footprint: 13, templates: ["Booth_Pre_T01", "Booth_Pre_T02"] },
};

// A booth only fits a slot of its own tier or a bigger one
export const fitsSlot = (booth: Tier, slot: Tier) => TIER_INFO[booth].rank <= TIER_INFO[slot].rank;

export interface Shot {
  position: [number, number, number];
  target: [number, number, number];
}

export interface Slot {
  id: string;
  tier: Tier;
  footprint: number;
  position: [number, number, number];
  rotationY: number;
  camera: Shot;
}

export const SLOTS: Slot[] = slotsFile.slots.map((s) => ({
  id: s.id,
  tier: s.tier as Tier,
  footprint: s.footprint_m[0]!,
  position: s.position as [number, number, number],
  rotationY: s.rotation_y_rad,
  camera: { position: s.camera.position as [number, number, number], target: s.camera.target as [number, number, number] },
}));

export const SLOT_BY_ID = Object.fromEntries(SLOTS.map((s) => [s.id, s])) as Record<string, Slot>;

// "Booth_Pro_007" → "Pro 07"
export const slotLabel = (id: string) => {
  const s = SLOT_BY_ID[id];
  const n = id.match(/(\d+)$/)?.[1] ?? "";
  return `${s?.tier ?? ""} ${n.slice(-2)}`.trim();
};

export const OVERVIEW_SHOT: Shot = { position: [215, 150, 215], target: [0, 8, 0] };

// Surfaces a visitor can put a picture on. Keys match the GLB node names
// (<template>__<key>__Display).
export interface Surface {
  key: string;
  label: string;
}

export function surfacesOf(id: TemplateId): Surface[] {
  const t = TEMPLATES[id];
  const products = Array.from({ length: t.products }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return { key: `Product_${n}`, label: `Product ${i + 1}` };
  });
  return [{ key: "Logo_01", label: "Logo" }, { key: "Image_01", label: "Banner 1" }, { key: "Image_02", label: "Banner 2" }, ...products];
}

// Traffic borrowed from /3d-showcase. Measured on expo.glb: the paving
// between the Pro (r 122) and Basic (r 168) rings is clear at r 141 and
// r 149 (a tree line runs down r 145), and the four avenues on the X and Z
// axes are clear from the plaza (r 88) out to the gate portals (r 212).
export const TRAFFIC = {
  dir: "/3d-showcase",
  groundY: 0.62,
  // Drive on the right: heading toward +angle (X turning to Z) keeps the
  // inner lane on your right, so that lane runs +angle and the outer one −angle
  ring: [
    { radius: 141, dir: 1 as const, count: 7 },
    { radius: 149, dir: -1 as const, count: 7 },
  ],
  avenue: {
    // Gate angles (atan2(z, x)): Gate_01 +X, Main Gate +Z, Gate_03 −X, Gate_02 −Z
    angles: [0, Math.PI / 2, Math.PI, -Math.PI / 2],
    perAvenue: 2,
    laneOffset: 3.5,
    gateR: 211,
    // U-turn around the plaza's glow ring
    turnR: 100,
    dwell: [3, 6] as [number, number],
    respawn: [4, 12] as [number, number],
  },
  // Where an avenue crosses the ring road, measured on the avenue (radius)
  // and on the ring (half-width either side of the avenue's centre line)
  crossing: { r0: 134, r1: 156, halfWidth: 7.5, lookAhead: 40 },
  cars: ["sedan80.glb", "wagon80.glb", "pickup80.glb", "van80.glb", "hatch80.glb", "car.glb", "convertible.glb", "mini_ev.glb"],
  bikes: [
    { file: "motorbike_cub_red.glb", rider: "rider_cub.glb" },
    { file: "motorbike_cub_blue.glb", rider: "rider_cub.glb" },
    { file: "motorbike_cub_teal.glb", rider: "rider_cub.glb" },
    { file: "motorbike_cruiser_black.glb", rider: "rider_cruiser.glb" },
    { file: "motorbike_cruiser_red.glb", rider: "rider_cruiser.glb" },
  ],
};

export const COLOR_SWATCHES = [
  "#e5484d", "#f76b15", "#ffc53d", "#46a758", "#12a594", "#00a2c7",
  "#3e63dd", "#6e56cf", "#d6409f", "#1c2024", "#8b8d98", "#f9f9fb",
];
