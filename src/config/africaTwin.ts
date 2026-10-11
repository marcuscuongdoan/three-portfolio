/**
 * Honda CRF1100L Africa Twin — exploded-view page content.
 *
 * Facts come from Honda UK's CRF1100L Africa Twin pages (2026 model year):
 * the specifications & price page and the overview page (see SOURCES). Text is
 * paraphrased; numbers are quoted as Honda lists them.
 *
 * Mesh grouping is based on the node names inside the GLB
 * (`public/models/bikes/africa_twin_textured.glb`). Model space: see
 * bikeShowroom.ts.
 */

import {
  type BikeDefinition,
  type BikePart,
  DEFAULT_EXPLODE,
  INTRO_TIMING,
} from "@/config/bikeShowroom";

const SOURCES = {
  specs: {
    label: "Honda UK — CRF1100L Africa Twin specifications & price",
    url: "https://www.honda.co.uk/motorcycles/range/adventure/crf1100l-africa-twin/specifications-and-price.html",
  },
  overview: {
    label: "Honda UK — CRF1100L Africa Twin overview",
    url: "https://www.honda.co.uk/motorcycles/range/adventure/crf1100l-africa-twin/overview.html",
  },
};

const BIKE_PARTS: BikePart[] = [
  {
    id: "engine",
    name: "Engine & transmission",
    kicker: "1084 cc parallel twin",
    nodes: ["misc_c*"],
    explode: [0, -0.5, 0.05],
    summary:
      "A liquid-cooled, 8-valve Unicam parallel twin with a 270° crank. Higher compression, revised valve timing and an updated intake and exhaust give 7% more torque, with the gains landing low and in the middle of the rev range.",
    specs: [
      ["Displacement", "1084 cc"],
      ["Type", "Liquid-cooled 4-stroke, 8-valve parallel twin, 270° crank, Unicam"],
      ["Max power", "75.0 kW @ 7,500 rpm"],
      ["Max torque", "112 Nm @ 5,500 rpm"],
      ["Compression ratio", "10.5:1"],
      ["Bore × stroke", "92.0 mm × 81.5 mm"],
      ["Fuel injection", "PGM-FI, 46 mm throttle bore"],
      ["Gearbox", "6-speed manual (assist/slipper clutch) or 6-speed DCT"],
    ],
    notes: [
      "DCT shifts automatically, with a trigger shifter for manual override.",
      "A G-switch reduces clutch slip off-road for better traction (DCT).",
    ],
    sources: ["specs", "overview"],
  },
  {
    id: "cooling",
    name: "Cooling",
    kicker: "Liquid-cooled",
    nodes: ["misc_a*"],
    explode: [0, 0.08, -0.42],
    summary:
      "The twin is liquid-cooled, with the radiator mounted ahead of the engine behind the front wheel.",
    specs: [
      ["Cooling", "Liquid-cooled"],
      ["Oil capacity", "4.8 L"],
    ],
    sources: ["specs"],
  },
  {
    id: "exhaust",
    name: "Exhaust",
    kicker: "Updated intake & exhaust",
    nodes: ["misc_b*"],
    explode: [0.42, -0.24, 0.18],
    summary:
      "The updated intake and exhaust are part of the engine changes that lift torque through the middle of the rev range.",
    specs: [
      ["Noise (manual)", "Lurban 75.1 dB · Lwot 80.1 dB"],
      ["Noise (DCT)", "Lurban 75.0 dB · Lwot 79.9 dB"],
      ["CO₂ (WMTC)", "114 g/km"],
      ["Fuel consumption", "20.5 km/L"],
    ],
    notes: ["The 3D model is fitted with an aftermarket-style silencer."],
    sources: ["specs", "overview"],
  },
  {
    id: "frame",
    name: "Frame & chassis",
    kicker: "Semi-double cradle",
    nodes: ["chassis.001", "chassis.002", "chassis.003", "chassis.004"],
    explode: [0, 0, 0],
    summary:
      "A lightweight steel semi-double cradle frame, paired with long-travel suspension for 250 mm of ground clearance.",
    specs: [
      ["Frame", "Steel semi-double cradle"],
      ["Wheelbase", "1,575 mm"],
      ["Caster / trail", "27.5° / 113 mm"],
      ["Turning radius", "2.6 m"],
      ["Ground clearance", "250 mm"],
      ["L × W × H", "2,330 × 960 × 1,485 mm"],
      ["Kerb weight", "231 kg · ES 233 kg · DCT ES 244 kg"],
    ],
    sources: ["specs", "overview"],
  },
  {
    id: "front-suspension",
    name: "Front suspension",
    kicker: "Showa 45 mm inverted fork",
    nodes: ["forks_l*"],
    explode: [0, 0.22, -0.4],
    summary:
      "Long-travel Showa suspension: a 45 mm cartridge-type inverted fork with 230 mm of stroke. ES models add Showa EERA electronic damping control.",
    specs: [
      ["Fork", "Showa 45 mm cartridge-type inverted telescopic"],
      ["Adjustment", "Dial-style preload, damping force adjustment"],
      ["Stroke", "230 mm"],
      ["ES / DCT ES", "Showa EERA — electronic compression & rebound damping"],
      ["EERA modes", "Mid, Hard, Soft, Off-Road, User"],
    ],
    sources: ["specs", "overview"],
  },
  {
    id: "rear-suspension",
    name: "Swingarm & rear shock",
    kicker: "CRF450R-inspired aluminium",
    nodes: ["swingarm*"],
    explode: [0, -0.36, 0.38],
    summary:
      "A monoblock aluminium swingarm inspired by the CRF450R, with Pro-Link and a fully adjustable Showa gas-charged shock giving 220 mm of wheel travel.",
    specs: [
      ["Swingarm", "Monoblock aluminium"],
      ["Linkage", "Pro-Link"],
      ["Damper", "Showa gas-charged, hydraulic preload & rebound adjustment"],
      ["Wheel travel", "220 mm"],
      ["ES / DCT ES", "Electronically controlled (Showa EERA), preload adjustable on the move"],
      ["Final drive", "O-ring sealed chain"],
    ],
    sources: ["specs", "overview"],
  },
  {
    id: "front-wheel",
    name: "Front wheel",
    kicker: "21-inch tubeless",
    nodes: ["wheel_lf*"],
    explode: [0, -0.16, -0.62],
    summary:
      "A 21-inch wire-spoke wheel with an aluminium rim, now tubeless for easy roadside repairs.",
    specs: [
      ["Rim", "21 M/C × 2.15, wire spoke, aluminium"],
      ["Tyre", "90/90-21 M/C 54H, tubeless"],
      ["Fitment", "Bridgestone Battlax AdventureCross Tourer AX41T or Metzeler Karoo Street"],
    ],
    sources: ["specs", "overview"],
  },
  {
    id: "rear-wheel",
    name: "Rear wheel",
    kicker: "18-inch tubeless",
    nodes: ["wheel_lr*"],
    explode: [0, -0.16, 0.68],
    summary:
      "An 18-inch wire-spoke rear wheel with an aluminium rim, tubeless like the front.",
    specs: [
      ["Rim", "18 M/C × 4.00, wire spoke, aluminium"],
      ["Tyre", "150/70-R18 M/C 70H, tubeless"],
      ["Fitment", "Bridgestone Battlax AdventureCross Tourer AX41T or Metzeler Karoo Street"],
    ],
    sources: ["specs", "overview"],
  },
  {
    id: "brakes",
    focusBoost: 0.25,
    name: "Brakes & ABS",
    kicker: "Dual 310 mm discs",
    nodes: ["bikedisc_f*", "bikedisc_r*"],
    explode: [0, 0, 0],
    explodeOverrides: [
      { nodes: ["bikedisc_f*"], explode: [0, -0.34, -0.92] },
      { nodes: ["bikedisc_r*"], explode: [0, -0.34, 0.98] },
    ],
    summary:
      "Dual 310 mm wave floating discs up front and a 256 mm wave disc at the rear, with 2-channel cornering ABS that can be switched between on- and off-road modes.",
    specs: [
      ["Front", "310 mm dual wave floating discs, aluminium hub, radial 4-piston calipers"],
      ["Rear", "256 mm wave disc, 2-piston caliper, sintered metal pads"],
      ["ABS", "2-channel with IMU, selectable ON-road / OFF-road mode"],
    ],
    sources: ["specs", "overview"],
  },
  {
    id: "cockpit",
    name: "TFT & electronics",
    kicker: "6.5-inch touchscreen",
    nodes: ["chassis", "chassis.005", "chassis.008", "chassis.009"],
    explode: [0, 0.34, -0.22],
    summary:
      "A fully customisable 6.5-inch colour TFT touchscreen with Apple CarPlay and Android Auto, running the riding modes and the IMU-based rider aids.",
    specs: [
      ["Display", "6.5-inch TFT touch panel"],
      ["Connectivity", "Bluetooth audio, Apple CarPlay / Android Auto (wired)"],
      ["Riding modes", "Urban, Tour, Gravel, Off-Road, User"],
      ["Traction", "7-level Honda Selectable Torque Control (ES / DCT ES)"],
      ["Wheelie control", "3-level (ES / DCT ES)"],
      ["IMU", "6-axis (ES / DCT ES)"],
      ["Cruise control", "Standard"],
      ["Sockets", "USB Type-A 1.5 A; 12 V on ES"],
    ],
    sources: ["specs", "overview"],
  },
  {
    id: "windscreen",
    name: "Windscreen",
    kicker: "5-position adjustable",
    nodes: ["misc_d*"],
    explode: [0, 0.42, -0.34],
    summary:
      "The screen adjusts through 5 positions, from maximum forward visibility to maximum wind protection.",
    specs: [["Adjustment", "5 positions"]],
    sources: ["overview"],
  },
  {
    id: "bodywork",
    name: "Tank & bodywork",
    kicker: "18.8 L fuel tank",
    nodes: [
      "bodyshell.001",
      "bodyshell.002",
      "bodyshell.003",
      "bodyshell.004",
      "bodyshell.005",
      "bodyshell.006",
      "bodyshell.007",
      "bodyshell.008",
      "bodyshell.009",
      "bodyshell.010",
    ],
    explode: [0, 0.26, -0.04],
    summary:
      "The fuel tank and side panels carry the Tricolour livery. The 18.8 L tank and 20.5 km/L consumption work out to roughly 385 km per tank.",
    specs: [
      ["Fuel tank", "18.8 L"],
      ["Fuel consumption", "20.5 km/L"],
      ["Range (calculated)", "≈ 385 km"],
    ],
    sources: ["specs"],
  },
  {
    id: "seat",
    name: "Seat",
    kicker: "850 / 870 mm",
    nodes: ["bodyshell"],
    explode: [0, 0.5, 0.22],
    summary:
      "The rider's seat adjusts between two heights, with low and comfort seats available as options.",
    specs: [
      ["Seat height", "850 / 870 mm (adjustable)"],
      ["Low seat option", "825 mm"],
      ["Comfort seat option", "885 mm"],
    ],
    sources: ["specs", "overview"],
  },
  {
    id: "controls",
    name: "Handlebars & controls",
    kicker: "Heated grips on ES",
    nodes: ["handlebars*", "misc_e*", "misc_f*"],
    explode: [0, 0.56, -0.08],
    summary:
      "Wide bars with handguards. Cruise control is standard; ES models add heated grips, and DCT models a trigger shifter for manual gear changes.",
    specs: [
      ["Cruise control", "Standard"],
      ["Heated grips", "Standard on ES"],
      ["Clutch operation", "Cable"],
      ["DCT", "Trigger shifter for manual override"],
    ],
    sources: ["specs", "overview"],
  },
  {
    id: "lighting",
    focusBoost: 0.25,
    name: "Lighting & electrics",
    kicker: "Full LED",
    nodes: ["headlight_*", "indicator_*", "taillight_*", "chassis.006", "chassis.007"],
    explode: [0, 0, 0],
    explodeOverrides: [
      { nodes: ["headlight_*", "indicator_lf*", "indicator_rf*"], explode: [0, 0.14, -0.62] },
      { nodes: ["taillight_*", "indicator_lr*", "indicator_rr*", "chassis.006", "chassis.007"], explode: [0, 0.16, 0.56] },
    ],
    summary:
      "LED headlights and taillight with daytime running lights, auto-cancelling indicators and an emergency stop signal, powered by a lithium-ion battery.",
    specs: [
      ["Headlight / taillight", "LED"],
      ["Daytime running lights", "Yes"],
      ["Indicators", "Auto-cancelling"],
      ["Emergency stop signal", "Yes"],
      ["Battery", "12 V 6 Ah Li-ion"],
      ["Security", "Immobiliser"],
    ],
    sources: ["specs"],
  },
  {
    id: "accessories",
    name: "Touring accessories",
    kicker: "Adventure Pack",
    nodes: ["twin_touring*", "extralight_*"],
    explode: [0, 0.12, 0.3],
    summary:
      "The model is shown with touring accessories — crash bars, a rear rack and auxiliary lights. Honda UK lists the 2026 range with a complimentary Adventure Pack.",
    specs: [
      ["Africa Twin", "£13,399 with Adventure Pack"],
      ["Africa Twin ES", "£14,899 with Adventure Pack"],
      ["Africa Twin DCT ES", "£15,999 with Adventure Pack"],
    ],
    sources: ["specs"],
  },
];

export const AFRICA_TWIN: BikeDefinition = {
  slug: "africa-twin",
  path: "/africa-twin",
  brand: "Honda",
  modelLine: "Honda CRF1100L",
  title: "Africa Twin",
  year: "2026",
  tagline: "Adventure Roads",
  model: "/models/bikes/africa_twin_textured.glb",
  // The collision hull, and a copy of the radiator parts parked at the origin
  hiddenNodes: ["africat.col", "twin_forks*"],
  parts: BIKE_PARTS,
  sources: SOURCES,
  credit: { name: "Honda UK", source: "specs" },
  heroSpecs: [
    ["1084 cc", "Parallel twin"],
    ["75.0 kW", "@ 7,500 rpm"],
    ["112 Nm", "@ 5,500 rpm"],
    ["230 / 220 mm", "Suspension travel"],
    ["21″ / 18″", "Tubeless wheels"],
  ],
  explode: DEFAULT_EXPLODE,
  lights: {
    glow: [
      { nodes: ["headlight_*"], color: "#fff4dc", intensity: 6 },
      { nodes: ["extralight_*", "twin_touring.001"], color: "#fff0c8", intensity: 5 },
      { nodes: ["taillight_*"], color: "#ff2424", intensity: 5 },
    ],
    lampMaterial: /headlight|lights|foglight|glass/i,
    headlights: [
      [-0.08, 0.45, -0.8],
      [0.08, 0.45, -0.8],
    ],
    beamDirection: [0, -0.22, -1],
  },
  ride: {
    wheelNodes: ["wheel_lf*", "wheel_lr*"],
    // The calipers share the disc nodes but don't spin
    discNodes: ["bikedisc_*"],
    discMaterial: /discbrake/i,
    spin: 11,
    exhaustOutlet: [0.21, 0.24, 0.96],
    rearContact: [0, -0.56, 0.86],
  },
  intro: { ...INTRO_TIMING, zFront: -1.2, zBack: 1.25 },
  // 270° parallel twin: uneven 270 / 450° firing — the V-twin-like thump
  sound: {
    firing: [0, 270],
    idleRpm: 1150,
    cruiseRpm: 5000,
    peakRpm: 6800,
    // 2-into-1 under the engine, long silencer
    headers: [0.72, 0.78],
    main: 0.95,
    tone: 900,
    body: 95,
    window: 230,
    variability: 0.2,
    pops: false,
  },
  camera: {
    fov: 35,
    position: [4.5, 1.95, -3.4],
    target: [0, 0.75, 0],
  },
  theme: {
    dark: false,
    accent: "#e4002b",
    accentHover: "#c00024",
    accent2: "#1f3a93",
    stripes: ["#e4002b", "#ffffff", "#1f3a93"],
    studio: { day: "#e8eaed", night: "#121419" },
    garage: "light",
  },
};
