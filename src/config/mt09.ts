/**
 * Yamaha MT-09 SP — exploded-view page content.
 *
 * Facts come from Yamaha Motor Europe's UK MT-09 SP page (2024 model year,
 * Icon Performance): the feature descriptions and the Engine / Chassis /
 * Dimensions specification tabs. Text is paraphrased; numbers are quoted as
 * Yamaha lists them.
 *
 * Mesh grouping is based on the node names inside the GLB
 * (`public/models/bikes/yamaha_mt09_sp_textured.glb`) — the same naming
 * scheme as the Africa Twin, but the misc_* groups hold different parts here
 * (misc_e = engine, misc_c = Öhlins shock, misc_b = exhaust). A mesh goes to
 * the first part that matches it, so the brakes and wheels come before the
 * suspension (calipers and the chain live in forks_* / swingarm* nodes) and
 * the frame takes whatever misc_d is left. Model space: see bikeShowroom.ts.
 */

import {
  type BikeDefinition,
  type BikePart,
  DEFAULT_EXPLODE,
  INTRO_TIMING,
} from "@/config/bikeShowroom";

const SOURCES = {
  specs: {
    label: "Yamaha Motor Europe (UK) — MT-09 SP features & specifications",
    url: "https://www.yamaha-motor.eu/gb/en/motorcycles/hyper-naked/pdp/mt-09-sp/",
  },
  mt09: {
    label: "Yamaha Motor Europe (UK) — MT-09 colours",
    url: "https://www.yamaha-motor.eu/gb/en/motorcycles/hyper-naked/pdp/mt-09/",
  },
};

const PARTS: BikePart[] = [
  {
    id: "engine",
    name: "Engine",
    kicker: "890 cc CP3 triple",
    nodes: ["misc_e*", "misc_d004"],
    explode: [0, -0.45, 0.05],
    summary:
      "Yamaha's liquid-cooled CP3 in-line three in its latest EU5+ form: light and strong, with plenty of torque low in the rev range. Revised fuel injectors improve efficiency, while optimised gear ratios and a refined assist & slipper clutch are matched to its output.",
    specs: [
      ["Engine type", "4-stroke, liquid-cooled, DOHC, 4-valve, in-line three-cylinder"],
      ["Displacement", "890 cc"],
      ["Bore × stroke", "78.0 × 62.1 mm"],
      ["Compression ratio", "11.5 : 1"],
      ["Maximum power", "87.5 kW (119.0 PS) @ 10,000 rpm"],
      ["Maximum torque", "93.0 Nm (9.5 kgf-m) @ 7,000 rpm"],
      ["Fuel system", "Electronic fuel injection"],
      ["Clutch", "Wet, multiple disc (assist & slipper)"],
      ["Transmission", "Constant mesh, 6-speed"],
      ["Ignition / starter", "TCI / electric"],
    ],
    notes: [
      "Induction sound and exhaust note combine into the CP3's recognisable roar, which heightens the feeling of acceleration.",
      "TRACK modes offer a choice of two engine-brake management settings.",
    ],
    sources: ["specs"],
  },
  {
    id: "cooling",
    name: "Cooling",
    kicker: "Liquid-cooled",
    nodes: ["misc_d007", "misc_d001"],
    explode: [0, 0.05, -0.42],
    summary:
      "The triple is liquid-cooled, with the radiator mounted ahead of the engine and a wet-sump lubrication system.",
    specs: [
      ["Cooling", "Liquid-cooled"],
      ["Lubrication", "Wet sump"],
      ["Oil tank capacity", "3.50 L"],
    ],
    sources: ["specs"],
  },
  {
    id: "exhaust",
    name: "Exhaust",
    kicker: "EU5+",
    nodes: ["misc_b*"],
    explode: [0.42, -0.22, 0.25],
    summary:
      "The headers run beneath the engine to a compact silencer. Together with the tuned intake ducts, the exhaust note is the other half of the CP3's sound.",
    specs: [
      ["Emissions standard", "EU5+"],
      ["CO₂ emission", "116 g/km"],
      ["Fuel consumption", "5.0 L/100 km"],
    ],
    sources: ["specs"],
  },
  {
    id: "brakes",
    name: "Brakes & ABS",
    kicker: "Brembo Stylema",
    nodes: ["bikedisc_*", "forks_l002", "forks_l004", "forks_l007", "forks_l009", "swingarm004"],
    explode: [0.15, 0, 0],
    explodeOverrides: [
      { nodes: ["bikedisc_f", "forks_l002", "forks_l004", "forks_l007", "forks_l009"], explode: [0.12, 0, -0.5] },
      { nodes: ["bikedisc_r", "swingarm004"], explode: [0.18, 0, 0.5] },
    ],
    focusBoost: 0.25,
    summary:
      "Brembo Stylema monoblock calipers up front: slimmer pistons and pad area than conventional calipers, lighter and stiffer, with larger-diameter pistons for more braking force and a precise feel from the first touch of the lever.",
    specs: [
      ["Front brake", "Hydraulic dual disc, Ø 298 mm"],
      ["Front calipers", "Brembo Stylema monoblock"],
      ["Rear brake", "Hydraulic single disc, Ø 245 mm"],
      ["Brake Control", "Lean-sensitive, via the 6-axis IMU"],
    ],
    notes: [
      "A Back Slip Regulator (BSR) steadies the bike when the rear wheel locks under hard braking.",
      "In TRACK modes the level of brake control can be changed, and rear ABS switched off.",
    ],
    sources: ["specs"],
  },
  {
    id: "front-wheel",
    name: "Front wheel",
    kicker: "17″ cast",
    nodes: ["wheel_lf*"],
    explode: [0, 0, -0.62],
    summary:
      "A 17-inch cast wheel in the Icon Performance blue, on a 120/70 ZR17 radial tyre between the twin brake discs.",
    specs: [
      ["Front tyre", "120/70ZR17M/C (58W) tubeless"],
      ["Front brake", "Hydraulic dual disc, Ø 298 mm"],
    ],
    sources: ["specs"],
  },
  {
    id: "rear-wheel",
    name: "Rear wheel & drive",
    kicker: "180/55 ZR17",
    nodes: ["wheel_lr*", "misc_f", "swingarm001"],
    explode: [0, 0, 0.72],
    summary:
      "A 17-inch cast rear wheel on a 180-section radial tyre, driven by chain from the six-speed gearbox.",
    specs: [
      ["Rear tyre", "180/55ZR17M/C (73W) tubeless"],
      ["Final transmission", "Chain"],
      ["Rear brake", "Hydraulic single disc, Ø 245 mm"],
    ],
    sources: ["specs"],
  },
  {
    id: "front-suspension",
    name: "Front suspension",
    kicker: "41 mm KYB, DLC-coated",
    nodes: ["forks_l*", "forks_u003", "forks_u006"],
    explode: [0, 0.1, -0.48],
    summary:
      "SP-exclusive 41 mm KYB upside-down forks with a gold DLC coating and a higher spring rate for stability in spirited riding — fully adjustable for preload, rebound and compression damping.",
    specs: [
      ["Front suspension", "Upside-down telescopic fork, Ø 41 mm"],
      ["Front travel", "130 mm"],
      ["Adjustment", "Preload, rebound and compression damping"],
      ["Caster angle", "24°40′"],
      ["Trail", "108 mm"],
    ],
    sources: ["specs"],
  },
  {
    id: "rear-suspension",
    name: "Swingarm & Öhlins shock",
    kicker: "Fully adjustable",
    nodes: ["misc_c*", "swingarm*"],
    explode: [0, -0.22, 0.4],
    summary:
      "A fully adjustable Öhlins shock on a link suspension, with a remote preload adjuster for quick changes. The swingarm is brushed aluminium — part of the SP's premium finish.",
    specs: [
      ["Rear suspension", "Link suspension, swingarm"],
      ["Shock absorber", "Öhlins, fully adjustable"],
      ["Preload", "Remote adjuster"],
      ["Rear travel", "117 mm"],
      ["Swingarm", "Brushed aluminium"],
    ],
    sources: ["specs"],
  },
  {
    id: "cockpit",
    name: "TFT & electronics",
    kicker: "5″ TFT, 6-axis IMU",
    nodes: ["dials*", "misc_a", "1", "2", "3", "4", "5", "6", "n"],
    explode: [0, 0.42, -0.25],
    summary:
      "A full-colour 5-inch TFT with five themes, including the SP-only TRACK theme. Developed from the R1, the six-axis IMU runs the lean-sensitive rider aids: traction, slide and lift control, plus brake control.",
    specs: [
      ["Display", "Full-colour 5-inch TFT"],
      ["Themes", "Five, including TRACK"],
      ["Riding modes", "SPORT, STREET, RAIN + 2 custom + 4 TRACK"],
      ["Rider aids", "3-mode TCS, SCS, LIF, Brake Control, BSR"],
      ["Connectivity", "MyRide app (notifications, calls, music)"],
      ["Navigation", "Garmin StreetCross app"],
    ],
    notes: ["Calls and music need a Bluetooth headset linked to the bike (not included)."],
    sources: ["specs"],
  },
  {
    id: "windscreen",
    name: "Fly screen",
    kicker: "Genuine accessory",
    nodes: ["extra_2"],
    explode: [0, 0.35, -0.42],
    summary:
      "The small tinted screen above the headlight. Yamaha UK lists a Fly Screen among the MT-09's genuine accessories.",
    specs: [["Fly Screen (accessory)", "£59.00"]],
    sources: ["specs"],
  },
  {
    id: "controls",
    name: "Handlebars & Smart Key",
    kicker: "Keyless start",
    nodes: ["handlebars*", "extra_1*", "extra_2*", "forks_u001", "forks_u007"],
    explode: [0, 0.5, -0.05],
    summary:
      "The first Hyper Naked with Yamaha's Smart Key System: with the key in your pocket, press and turn the new switch to start — it also locks and unlocks the fuel cap. New integrated switchgear runs the menus, modes, connectivity and navigation.",
    specs: [
      ["Ignition", "Smart Key System"],
      ["Handlebar", "Lower, two positions"],
      ["Footrests", "Adjustable"],
      ["Indicators", "3-flash lane change, self-cancelling"],
    ],
    notes: [
      "Indicators cancel themselves after 15 seconds once the bike has covered more than 150 metres.",
    ],
    sources: ["specs"],
  },
  {
    id: "lighting",
    name: "Lighting",
    kicker: "LED, ESS",
    nodes: [
      "headlight_*",
      "extralight_*",
      "forks_u",
      "forks_u002",
      "forks_u004",
      "forks_u005",
      "brakelight_*",
      "taillight_*",
      "indicator_*",
      "bodyshell",
    ],
    explode: [0, 0.2, 0],
    explodeOverrides: [
      { nodes: ["brakelight_*", "taillight_*", "bodyshell"], explode: [0, 0.22, 0.5] },
      {
        nodes: ["headlight_*", "extralight_*", "forks_u", "forks_u002", "forks_u004", "forks_u005", "indicator_*"],
        explode: [0, 0.2, -0.55],
      },
    ],
    focusBoost: 0.25,
    summary:
      "The MT family's compact twin-eye LED face up front and a slim LED tail. Emergency Stop Signalling switches the hazard lights on when the system detects sudden braking.",
    specs: [
      ["Emergency Stop Signalling", "Hazards on under sudden braking"],
      ["Lane-change signal", "Soft click flashes three times"],
      ["Self-cancel", "After 15 s and 150 m"],
    ],
    sources: ["specs"],
  },
  {
    id: "bodywork",
    name: "Tank & bodywork",
    kicker: "Icon Performance",
    nodes: [
      "bodyshell002",
      "bodyshell003",
      "bodyshell004",
      "bodyshell005",
      "bodyshell006",
      "bodyshell007",
      "bodyshell009",
      "bodyshell010",
      "extra_4",
    ],
    explode: [0, 0.38, 0.04],
    summary:
      "The SP-only Icon Performance livery takes its colours from the R1M, Yamaha's most advanced production bike. Air-intake ducts accentuate the high-frequency induction sound, and an acoustic amplifier grille on top of the tank carries it to the rider.",
    specs: [
      ["Colour", "Icon Performance"],
      ["Fuel tank", "14 L"],
      ["Price (UK, OTR)", "From £11,614"],
    ],
    sources: ["specs"],
  },
  {
    id: "seat",
    name: "Seat",
    kicker: "825 mm",
    nodes: ["bodyshell001", "bodyshell008"],
    explode: [0, 0.55, 0.22],
    summary:
      "A new two-part seat gives more freedom of movement for different riding styles, part of the SP's refined, engaged riding position.",
    specs: [
      ["Seat height", "825 mm"],
      ["Seat", "Two-part"],
    ],
    sources: ["specs"],
  },
  {
    id: "frame",
    name: "Frame & chassis",
    kicker: "CF die-cast aluminium",
    nodes: ["chassis*", "misc_d*"],
    explode: [0, 0.3, 0],
    summary:
      "A compact controlled-filling (CF) die-cast aluminium frame — a modern take on the Deltabox layout — gives high stiffness for feedback and stability, with an optimised swingarm pivot and a light, slim chassis.",
    specs: [
      ["Frame", "Diamond, CF die-cast aluminium"],
      ["Wheelbase", "1,430 mm"],
      ["Length × width × height", "2,090 × 820 × 1,145 mm"],
      ["Ground clearance", "140 mm"],
      ["Wet weight", "194 kg (full oil and fuel)"],
    ],
    sources: ["specs"],
  },
];

export const MT09_SP: BikeDefinition = {
  slug: "mt-09",
  path: "/mt-09",
  brand: "Yamaha",
  modelLine: "Yamaha MT-09",
  title: "MT-09 SP",
  year: "2024",
  tagline: "Master of Darkness",
  model: "/models/bikes/yamaha_mt09_sp_textured.glb",
  // The collision hull
  hiddenNodes: ["phmt09.col"],
  parts: PARTS,
  sources: SOURCES,
  credit: { name: "Yamaha UK", source: "specs" },
  heroSpecs: [
    ["890 cc", "CP3 triple"],
    ["87.5 kW", "@ 10,000 rpm"],
    ["93.0 Nm", "@ 7,000 rpm"],
    ["130 / 117 mm", "KYB / Öhlins travel"],
    ["194 kg", "Wet weight"],
  ],
  explode: DEFAULT_EXPLODE,
  lights: {
    glow: [
      // DRLs and the headlight lens (forks_u)
      { nodes: ["headlight_*", "extralight_*", "forks_u"], color: "#eef4ff", intensity: 6 },
      // Tail lamp and its lens (bodyshell)
      { nodes: ["taillight_*", "brakelight_*", "bodyshell"], color: "#ff2424", intensity: 5 },
    ],
    // Lamp materials only: glass.001 is the lens glass (the fly screen is
    // glass1, and the indicators' "headlight" material must stay dark)
    lampMaterial: /^(drl|taillight|glass\.001)$/i,
    headlights: [
      [-0.06, 0.33, -0.78],
      [0.07, 0.33, -0.78],
    ],
    beamDirection: [0, -0.22, -1],
  },
  // The SP is sold in Icon Performance only; the other three are the current
  // MT-09 colours (Yamaha UK), shown on the SP's gold forks
  paint: {
    source: "specs",
    slots: {
      tank: { label: "Tank & tail", materials: ["vehicle_generic_smallspecmap [PRIMARY]"] },
      // Tank sides, scoops and front fender
      panels: { label: "Panels", materials: ["vehicle_generic_smallspecmap [SECONDARY]"] },
      pinstripes: { label: "Pinstripes", materials: ["blue"] },
      rims: { label: "Rims", materials: ["rim", "Material.018", "Material.019"] },
    },
    liveries: [
      {
        id: "icon-performance",
        name: "Icon Performance",
        swatch: ["#a9adb3", "#16171a", "#2a3fd0"],
        paint: {
          tank: { color: "#a9adb3", metalness: 0.85, roughness: 0.22, clearcoat: 1 },
          panels: { color: "#16171a", metalness: 0.5, roughness: 0.35, clearcoat: 1 },
          pinstripes: { color: "#2a3fd0", roughness: 0.3 },
          rims: { color: "#2236c4", metalness: 0.55, roughness: 0.3 },
        },
      },
      {
        id: "ice-storm",
        name: "Ice Storm",
        note: "MT-09 colour",
        swatch: ["#c3c7cc", "#1b1d21", "#2fa8e6"],
        paint: {
          tank: { color: "#c3c7cc", metalness: 0.3, roughness: 0.45, clearcoat: 0.3 },
          panels: { color: "#1b1d21", metalness: 0.4, roughness: 0.4, clearcoat: 1 },
          pinstripes: { color: "#2fa8e6", roughness: 0.3 },
          rims: { color: "#2a9fe0", metalness: 0.5, roughness: 0.3 },
        },
      },
      {
        id: "tech-black",
        name: "Tech Black",
        note: "MT-09 colour",
        swatch: ["#1c1d20", "#0e0f11", "#55595f"],
        paint: {
          tank: { color: "#1c1d20", metalness: 0.6, roughness: 0.25, clearcoat: 1 },
          panels: { color: "#0e0f11", metalness: 0.3, roughness: 0.5, clearcoat: 0.4 },
          pinstripes: { color: "#55595f", metalness: 0.6, roughness: 0.3 },
          rims: { color: "#121214", metalness: 0.8, roughness: 0.3 },
        },
      },
      {
        id: "icon-blue",
        name: "Icon Blue",
        note: "MT-09 colour",
        swatch: ["#1a3fd6", "#272d45", "#0f1012"],
        paint: {
          tank: { color: "#1a3fd6", metalness: 0.45, roughness: 0.18, clearcoat: 1 },
          panels: { color: "#272d45", metalness: 0.5, roughness: 0.4, clearcoat: 0.6 },
          pinstripes: { color: "#0f1012", roughness: 0.3 },
          rims: { color: "#1c3ccc", metalness: 0.55, roughness: 0.3 },
        },
      },
    ],
  },
  ride: {
    wheelNodes: ["wheel_lf*", "wheel_lr*"],
    // Discs and the rear sprocket
    discNodes: ["bikedisc_*", "misc_f"],
    spin: 11,
    exhaustOutlet: [0.24, -0.01, 0.7],
    rearContact: [0, -0.5, 0.6],
    // Firm, short-travel sport set-up (130 / 117 mm)
    suspension: {
      sag: [0.022, 0.02],
      bump: 0.0042,
      frontAxle: [0, -0.2, -0.887],
      rearAxle: [-0.025, -0.185, 0.578],
      // Inner fork tubes (forks_l001) slide into the gold outer tubes
      // (forks_u003, sprung); fender, calipers, hub
      unsprung: [
        "wheel_*",
        "bikedisc_*",
        "misc_f",
        "forks_l",
        "forks_l001",
        "forks_l002",
        "forks_l004",
        "forks_l005",
        "forks_l007",
        "forks_l008",
        "forks_l009",
        "forks_u006",
      ],
      // Front brake line
      stretch: ["forks_l006"],
      swingarm: ["swingarm*"],
      pivot: [0, -0.09, 0.03],
    },
  },
  intro: { ...INTRO_TIMING, zFront: -1.05, zBack: 0.8 },
  // CP3 triple: even firing every 240°, revs high — the crossplane howl
  sound: {
    firing: [0, 240, 480],
    idleRpm: 1300,
    cruiseRpm: 7500,
    peakRpm: 10000,
    // 3-into-1, short underbelly silencer
    headers: [0.55, 0.6, 0.66],
    main: 0.45,
    tone: 1400,
    body: 160,
    window: 210,
    variability: 0.12,
    pops: true,
  },
  camera: {
    fov: 35,
    position: [4.0, 1.65, -3.0],
    target: [0, 0.6, 0],
  },
  theme: {
    // "Dark Side of Japan": graphite studio, Yamaha racing blue, gold forks
    dark: true,
    accent: "#3d63ff",
    accentHover: "#2c4fe6",
    accent2: "#a87600",
    stripes: ["#3d63ff", "#9aa3ad", "#d4a017"],
    studio: { day: "#1d2026", night: "#0a0b0e" },
    garage: "dark",
  },
};
