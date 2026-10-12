/**
 * Mercedes-AMG G 63 (W463, 2016 model year) — exploded-view page content.
 *
 * Facts come from eMercedesBenz's report on the September 2015 G-Class update
 * (the G 63's new 420 kW, the drivetrain, the AMG colour package) and
 * paultan.org's specification sheet for the 2016 G 63 (see SOURCES). Text is
 * paraphrased; numbers are quoted as listed.
 *
 * The GLB (`public/models/cars/mercedes_g63_amg.glb`, Draco-compressed) is
 * built from `G63.glb` by scripts/build-g63-glb.js: scaled to the 2,850 mm
 * wheelbase, turned to model space (front -Z) and split into part nodes
 * (hood*, front*, door_fl / fr / rl / rr*, tailgate*, wheel_lf / rf / lr /
 * rr*, disc_*, caliper_*, headlight_*, body*). Model space: see
 * bikeShowroom.ts.
 */

import {
  type BikeDefinition,
  type BikePart,
  DEFAULT_EXPLODE,
  INTRO_TIMING,
} from "@/config/bikeShowroom";

const SOURCES = {
  update: {
    label: "eMercedesBenz — The legend lives on: the Mercedes-Benz G-Class (September 2015 update)",
    url: "https://emercedesbenz.com/autos/mercedes-benz/g-class/the-legend-lives-on-the-mercedes-benz-g-class/",
  },
  specs: {
    label: "paultan.org — Mercedes-AMG G 63 (W463 facelift, 2016) specifications",
    url: "https://paultan.org/research/mercedes-benz/amg-g-class/w463-facelift/g-63--2016/",
  },
};

const PARTS: BikePart[] = [
  {
    id: "engine",
    name: "Bonnet & V8",
    kicker: "5.5 L V8 biturbo",
    nodes: ["hood*"],
    explode: [0, 0.75, -0.35],
    summary:
      "Under the flat bonnet sits AMG's 5.5-litre twin-turbo V8. The September 2015 update raised it from 400 kW (544 hp) to 420 kW (571 hp), with 760 Nm of torque.",
    specs: [
      ["Engine", "V8, twin-turbo, 32-valve DOHC, direct injection"],
      ["Displacement", "5,461 cc"],
      ["Bore × stroke", "98 × 90.5 mm"],
      ["Compression ratio", "10.0 : 1"],
      ["Maximum power", "420 kW (571 hp) @ 5,500 rpm"],
      ["Maximum torque", "760 Nm @ 1,750 rpm"],
      ["Transmission", "AMG SpeedShift Plus 7G-Tronic, 7-speed automatic"],
      ["0–100 km/h", "5.4 s"],
      ["Top speed", "210 km/h"],
      ["Fuel consumption", "13.8 L/100 km · CO₂ 322 g/km"],
    ],
    notes: ["Before the 2015 update the G 63 made 400 kW (544 hp)."],
    sources: ["update", "specs"],
  },
  {
    id: "front",
    name: "Grille & front bumper",
    kicker: "Detachable bumper",
    nodes: ["front*"],
    explode: [0, 0, -0.9],
    summary:
      "The upright radiator grille with the Mercedes star, flanked by the round headlamps, over a detachable front bumper. With the AMG colour package the bumpers stay obsidian black whatever the body colour.",
    specs: [
      ["Bumpers", "Detachable; obsidian black with the AMG colour package"],
      ["Length", "4,673 mm"],
    ],
    sources: ["update", "specs"],
  },
  {
    id: "doors",
    name: "Doors",
    kicker: "Five doors, five seats",
    nodes: ["door_*"],
    explode: [0, 0, 0],
    explodeOverrides: [
      { nodes: ["door_fl*"], explode: [-0.9, 0, -0.1] },
      { nodes: ["door_rl*"], explode: [-0.9, 0, 0.1] },
      { nodes: ["door_fr*"], explode: [0.9, 0, -0.1] },
      { nodes: ["door_rr*"], explode: [0.9, 0, 0.1] },
    ],
    focusBoost: 0.4,
    summary:
      "Four flat-skinned side doors. The door mirrors carry the turn indicators, and with the AMG colour package their housings stay obsidian black.",
    specs: [
      ["Doors / seats", "5 / 5"],
      ["Mirrors", "Turn indicators built in"],
    ],
    sources: ["update", "specs"],
  },
  {
    id: "tailgate",
    name: "Tailgate & spare wheel",
    kicker: "Full-size spare",
    nodes: ["tailgate*", "rear_bumper*"],
    explode: [0, 0.1, 0.9],
    explodeOverrides: [{ nodes: ["rear_bumper*"], explode: [0, -0.1, 0.75] }],
    summary:
      "The rear door carries a full-size spare wheel under its cover. With the AMG colour package the cover ring stays obsidian black.",
    specs: [
      ["Spare wheel", "Full size"],
      ["Boot space", "480 L"],
      ["Spare wheel cover ring", "Obsidian black with the AMG colour package"],
    ],
    sources: ["update", "specs"],
  },
  {
    id: "front-wheels",
    name: "Front wheels",
    kicker: "21″ alloys",
    nodes: ["wheel_lf*", "wheel_rf*"],
    explode: [0, 0, 0],
    explodeOverrides: [
      { nodes: ["wheel_lf*"], explode: [-0.7, 0, -0.2] },
      { nodes: ["wheel_rf*"], explode: [0.7, 0, -0.2] },
    ],
    focusBoost: 0.4,
    summary: "21-inch light-alloy wheels on 275/45 R21 tyres, the same size front and rear.",
    specs: [
      ["Wheels", "21″ alloy"],
      ["Tyres", "275/45 R21, Continental CrossContact"],
      ["Front suspension", "Live axle"],
    ],
    sources: ["specs"],
  },
  {
    id: "rear-wheels",
    name: "Rear wheels",
    kicker: "Permanent 4×4",
    nodes: ["wheel_lr*", "wheel_rr*"],
    explode: [0, 0, 0],
    explodeOverrides: [
      { nodes: ["wheel_lr*"], explode: [-0.7, 0, 0.2] },
      { nodes: ["wheel_rr*"], explode: [0.7, 0, 0.2] },
    ],
    focusBoost: 0.4,
    summary:
      "Driven like the fronts all the time: the G has permanent all-wheel drive, a low-range gearbox and three differential locks.",
    specs: [
      ["Wheels", "21″ alloy"],
      ["Tyres", "275/45 R21"],
      ["Rear suspension", "Live axle"],
      ["Drive", "Permanent all-wheel drive"],
    ],
    sources: ["update", "specs"],
  },
  {
    id: "brakes",
    name: "Brakes",
    kicker: "ABS, ASR, ESP",
    nodes: ["disc_*", "caliper_*"],
    explode: [0, 0, 0],
    explodeOverrides: [
      { nodes: ["disc_lf", "caliper_lf"], explode: [-0.45, 0, -0.3] },
      { nodes: ["disc_rf", "caliper_rf"], explode: [0.45, 0, -0.3] },
      { nodes: ["disc_lr", "caliper_lr"], explode: [-0.45, 0, 0.3] },
      { nodes: ["disc_rr", "caliper_rr"], explode: [0.45, 0, 0.3] },
    ],
    focusBoost: 0.25,
    summary:
      "Disc brakes all round behind the 21-inch wheels. The 2015 update retuned the ABS and ASR along with the ESP set-up and the shock absorbers.",
    specs: [
      ["Brakes", "Discs front and rear"],
      ["Assistance", "ABS, ASR, ESP® (retuned in 2015)"],
      ["Driver aids", "Blind spot assist, collision warning"],
    ],
    sources: ["update", "specs"],
  },
  {
    id: "lighting",
    name: "Lighting",
    kicker: "Bi-xenon, LED DRL",
    nodes: ["headlight_*", "indicator*", "taillight*"],
    explode: [0, 0.25, 0],
    explodeOverrides: [
      { nodes: ["headlight_*"], explode: [0, 0.1, -1.0] },
      { nodes: ["taillight*"], explode: [0, 0.1, 0.9] },
    ],
    focusBoost: 0.25,
    summary:
      "Round bi-xenon projector headlamps with LED daytime running lights in the bumper, the G's turn signals on top of the front wings, and rear fog lamps.",
    specs: [
      ["Headlamps", "Bi-xenon projector"],
      ["Daytime running lights", "LED"],
      ["Rear fog lamps", "Yes"],
      ["Mirror turn indicators", "Yes"],
    ],
    sources: ["specs"],
  },
  {
    id: "body",
    name: "Body & ladder frame",
    kicker: "Ladder-type frame",
    nodes: ["body*"],
    explode: [0, 0, 0],
    summary:
      "The body still sits on a ladder-type frame, with live axles front and rear and three differential locks that engage and disengage on the move.",
    specs: [
      ["Chassis", "Ladder-type frame, live axles"],
      ["Differential locks", "Three, switchable on the move"],
      ["Transfer case", "Low-range gearbox"],
      ["Steering", "Recirculating ball, hydraulic power assistance"],
      ["Wheelbase", "2,850 mm"],
      ["Length × width × height", "4,673 × 1,855 × 1,938 mm"],
      ["Weight", "2,550 kg"],
      ["Fuel tank", "96 L"],
    ],
    sources: ["update", "specs"],
  },
];

// AMG colour package (2015): paint for the body; the detachable parts stay
// obsidian black (M_Paint_Accent, never repainted)
const package_ = (id: string, name: string, color: string, metalness = 0.35) => ({
  id,
  name,
  note: "AMG colour package",
  swatch: [color, "#16181c", "#b3121b"],
  paint: { body: { color, metalness, roughness: 0.22, clearcoat: 1 } },
});

export const G63: BikeDefinition = {
  slug: "g63",
  path: "/g63",
  brand: "Mercedes-AMG",
  modelLine: "Mercedes-AMG G-Class",
  title: "G 63",
  year: "2016",
  tagline: "Stronger than time",
  noun: "car",
  stage: 2.25,
  model: "/models/cars/mercedes_g63_amg.glb",
  hiddenNodes: [],
  parts: PARTS,
  sources: SOURCES,
  credit: { name: "eMercedesBenz · paultan.org", source: "update" },
  heroSpecs: [
    ["5.5 L", "V8 biturbo"],
    ["420 kW", "571 hp @ 5,500 rpm"],
    ["760 Nm", "From 1,750 rpm"],
    ["5.4 s", "0–100 km/h"],
    ["3", "Differential locks"],
  ],
  explode: DEFAULT_EXPLODE,
  lights: {
    glow: [
      { nodes: ["headlight_lens", "headlight_drl"], color: "#f4f8ff", intensity: 6 },
      { nodes: ["taillight"], color: "#ff2424", intensity: 5 },
    ],
    lampMaterial: /^M_(Headlight_Lens|DRL|Taillight_Lens)$/,
    headlights: [
      [-0.58, 0.93, -2.2],
      [0.58, 0.93, -2.2],
    ],
    beamDirection: [0, -0.15, -1],
  },
  paint: {
    source: "update",
    slots: {
      body: { label: "Body", materials: ["M_Paint"] },
    },
    liveries: [
      {
        id: "obsidian-black",
        name: "Obsidian Black",
        swatch: ["#16181c", "#3a3c40", "#b3121b"],
        paint: { body: { color: "#16181c", metalness: 0.6, roughness: 0.28, clearcoat: 1 } },
      },
      package_("solar-beam", "Solar Beam", "#f2c200"),
      package_("alien-green", "Alien Green", "#78bf3c"),
      package_("galactic-beam", "Galactic Beam", "#5a3d99", 0.5),
      package_("sunset-beam", "Sunset Beam", "#f07a12"),
      package_("tomato-red", "Tomato Red", "#c8261d", 0.2),
    ],
  },
  ride: {
    wheelNodes: ["wheel_*"],
    discNodes: ["disc_*"],
    // A bigger wheel (0.42 m against a bike's 0.3) turns slower
    spin: 8,
    // Side pipe ahead of the right rear wheel
    exhaustOutlet: [0.92, 0.36, 0.78],
    rearContact: [0, 0, 1.293],
    // Live axles on coil springs: the body pitches between them
    suspension: {
      sag: [0.03, 0.034],
      bump: 0.006,
      frontAxle: [0, 0.417, -1.556],
      rearAxle: [0, 0.417, 1.293],
      unsprung: ["wheel_*", "disc_*", "caliper_*"],
      stretch: [],
      swingarm: [],
      pivot: [0, 0.417, 0],
    },
  },
  intro: { ...INTRO_TIMING, points: 70000, zFront: -2.4, zBack: 2.4 },
  // Cross-plane V8: a firing every 90°, the left and right banks' pulses
  // reaching the tailpipes unevenly — the AMG burble, with crackle on the
  // overrun
  sound: {
    firing: [0, 90, 180, 270, 360, 450, 540, 630],
    idleRpm: 700,
    cruiseRpm: 3600,
    peakRpm: 6000,
    headers: [0.62, 0.78, 0.66, 0.82, 0.7, 0.74, 0.6, 0.8],
    main: 1.6,
    tone: 650,
    body: 75,
    window: 120,
    variability: 0.14,
    pops: true,
  },
  camera: {
    fov: 35,
    position: [7.6, 3.15, -5.75],
    target: [0, 0.95, 0],
  },
  theme: {
    // AMG: black studio, AMG red, silver
    dark: true,
    accent: "#e21b2c",
    accentHover: "#c41424",
    accent2: "#9aa3ad",
    stripes: ["#e21b2c", "#9aa3ad", "#f5f5f5"],
    studio: { day: "#1a1c20", night: "#08090b" },
    garage: "dark",
  },
};
