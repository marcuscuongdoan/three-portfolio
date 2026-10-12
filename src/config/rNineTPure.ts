/**
 * BMW R nineT Pure — exploded-view page content.
 *
 * Facts come from BMW Group's press release for the R nineT Pure (technical
 * data and equipment), and the paint finishes from BMW Motorrad's 2019 colour
 * update (see SOURCES). Text is paraphrased; numbers are quoted as BMW lists
 * them.
 *
 * The GLB (`public/models/bikes/bmw_r_ninet_pure.glb`, Draco-compressed) is
 * built from `BMW_R_nineT_Pure_2018_web.glb`, whose meshes are grouped by
 * material: scripts/build-r-ninet-glb.js splits it into part nodes (engine_*,
 * forks_*, swingarm*, …), turns it to model space (front -Z) and keeps its
 * materials (M_*). Model space: see bikeShowroom.ts.
 */

import {
  type BikeDefinition,
  type BikePart,
  DEFAULT_EXPLODE,
  INTRO_TIMING,
} from "@/config/bikeShowroom";

const SOURCES = {
  press: {
    label: "BMW Group PressClub — The new BMW R nineT Racer and R nineT Pure",
    url: "https://www.press.bmwgroup.com/usa/article/detail/T0266151EN_US/the-new-bmw-r-ninet-racer-and-r-ninet-pure?language=en_US",
  },
  colours: {
    label: "BMW Motorrad — New colours 2019 (R nineT Pure Option 719)",
    url: "https://bmwmotorrad.com.ph/en/experience/stories/brand/newcolours2019.html",
  },
};

const PARTS: BikePart[] = [
  {
    id: "engine",
    name: "Boxer engine",
    kicker: "1,170 cc flat twin",
    nodes: ["engine*"],
    explode: [0, -0.45, 0.05],
    summary:
      "BMW's air/oil-cooled 1,170 cc boxer, with its cylinders standing out into the wind on either side. Double overhead camshafts and four valves per cylinder; the engine carries load as part of the frame.",
    specs: [
      ["Engine type", "Air/oil-cooled 2-cylinder 4-stroke boxer, DOHC, 4 valves per cylinder"],
      ["Displacement", "1,170 cc"],
      ["Bore × stroke", "101 × 73 mm"],
      ["Compression ratio", "12.0 : 1"],
      ["Maximum power", "81 kW (110 hp) @ 7,750 rpm"],
      ["Maximum torque", "116 Nm @ 6,000 rpm"],
      ["Maximum engine speed", "8,500 rpm"],
      ["Engine management", "BMS-MP"],
      ["Clutch", "Hydraulically operated dry clutch"],
      ["Gearbox", "Constant-mesh 6-speed"],
    ],
    notes: ["Runs on premium unleaded, 95–98 RON."],
    sources: ["press"],
  },
  {
    id: "exhaust",
    name: "Exhaust",
    kicker: "Stainless 2-into-1",
    nodes: ["exhaust*"],
    explode: [-0.42, -0.22, 0.25],
    summary:
      "A stainless-steel 2-into-1 system: the headers sweep under the engine to a single silencer on the left, with an electric servomotor-driven acoustic valve and a black silk-matt end piece.",
    specs: [
      ["System", "Stainless steel 2-into-1"],
      ["Silencer", "Left side, black silk-matt end piece"],
      ["Acoustic valve", "Electric servomotor"],
      ["Emission control", "Closed-loop 3-way catalytic converter"],
      ["Emissions standard", "EU4"],
    ],
    sources: ["press"],
  },
  {
    id: "brakes",
    name: "Brakes & ABS",
    kicker: "Twin 320 mm discs",
    nodes: ["bikedisc_*", "caliper_f*"],
    explode: [0.15, 0, 0],
    explodeOverrides: [
      { nodes: ["bikedisc_f", "caliper_f*"], explode: [0.14, 0, -0.5] },
      { nodes: ["bikedisc_r"], explode: [0.18, 0, 0.5] },
    ],
    focusBoost: 0.25,
    summary:
      "Twin floating discs with four-piston calipers up front and a single disc at the rear, with BMW Motorrad ABS as standard.",
    specs: [
      ["Front brake", "Twin floating discs, Ø 320 mm, 4-piston calipers"],
      ["Rear brake", "Single disc, Ø 265 mm"],
      ["ABS", "BMW Motorrad ABS, standard"],
      ["ASC", "Automatic Stability Control, factory option"],
    ],
    sources: ["press"],
  },
  {
    id: "front-wheel",
    name: "Front wheel",
    kicker: "17″ cast",
    nodes: ["wheel_lf*"],
    explode: [0, 0, -0.62],
    summary: "A five-spoke light-alloy cast wheel on a 120/70 radial tyre. Wire-spoked wheels are an option.",
    specs: [
      ["Rim", "3.50 × 17″, five-spoke light-alloy cast"],
      ["Tyre", "120/70 ZR 17"],
      ["Option", "Wire-spoked wheels"],
    ],
    sources: ["press"],
  },
  {
    id: "rear-wheel",
    name: "Rear wheel",
    kicker: "180/55 ZR 17",
    nodes: ["wheel_lr*"],
    explode: [0, 0, 0.72],
    summary:
      "A 5.50-inch cast rear wheel on a 180-section tyre, bolted to the Paralever's final drive — there's no chain on a boxer BMW.",
    specs: [
      ["Rim", "5.50 × 17″, five-spoke light-alloy cast"],
      ["Tyre", "180/55 ZR 17"],
      ["Final drive", "Universal shaft, ratio 2.91"],
    ],
    sources: ["press"],
  },
  {
    id: "front-suspension",
    name: "Front suspension",
    kicker: "43 mm telescopic fork",
    nodes: ["forks_*"],
    explode: [0, 0.1, -0.48],
    summary:
      "The Pure keeps it simple: a conventional 43 mm telescopic fork held in forged-aluminium fork bridges with a clear anodised finish.",
    specs: [
      ["Front suspension", "Telescopic fork, Ø 43 mm"],
      ["Spring travel", "125 mm"],
      ["Fork bridges", "Forged aluminium, clear anodised"],
      ["Steering head angle", "63.4°"],
      ["Castor", "105.0 mm"],
    ],
    sources: ["press"],
  },
  {
    id: "rear-suspension",
    name: "Paralever & shock",
    kicker: "Single-sided swingarm",
    nodes: ["swingarm*", "shock*"],
    explode: [0.08, -0.22, 0.4],
    summary:
      "BMW's Paralever single-sided swingarm carries the drive shaft to the rear wheel, damped by a central spring strut with adjustable preload and continuously variable rebound damping.",
    specs: [
      ["Rear suspension", "BMW Paralever single-sided swingarm"],
      ["Spring strut", "Central, preload adjustable"],
      ["Rebound damping", "Continuously variable"],
      ["Spring travel", "120 mm"],
      ["Final drive", "Universal shaft"],
    ],
    sources: ["press"],
  },
  {
    id: "cockpit",
    name: "Handlebars & speedo",
    kicker: "Round analogue dial",
    nodes: ["handlebars*"],
    explode: [0, 0.5, -0.1],
    summary:
      "A single round analogue speedometer with the warning lamps built in, and an LCD for the time and trip distance. A rev counter is available as an accessory.",
    specs: [
      ["Speedometer", "Circular, analogue, integrated indicator lamps"],
      ["Display", "LCD: time and trip distance"],
      ["Rev counter", "Analogue, accessory"],
    ],
    sources: ["press"],
  },
  {
    id: "lighting",
    name: "Lighting",
    kicker: "Round headlight, LED tail",
    nodes: ["headlight_*", "indicator*", "reflector_f*", "taillight_*", "tail_*"],
    explode: [0, 0.2, 0],
    explodeOverrides: [
      { nodes: ["headlight_*", "reflector_f*"], explode: [0, 0.12, -0.55] },
      { nodes: ["taillight_*", "tail_*"], explode: [0, 0.18, 0.5] },
    ],
    focusBoost: 0.25,
    summary:
      "A classic circular headlight in a sheet-steel casing, with the BMW emblem in the middle of the bulb cover. White indicators and an LED rear light.",
    specs: [
      ["Headlight", "Circular, sheet-steel casing"],
      ["Bulb cover", "BMW emblem, centred"],
      ["Indicators", "White"],
      ["Rear light", "LED"],
    ],
    sources: ["press"],
  },
  {
    id: "bodywork",
    name: "Tank & fender",
    kicker: "17 L steel tank",
    nodes: ["bodywork_*", "fender_f*"],
    explode: [0, 0.38, 0.04],
    explodeOverrides: [{ nodes: ["fender_f*"], explode: [0, 0.05, -0.5] }],
    summary:
      "A painted sheet-steel tank with an aluminium trim panel in a clear anodised finish. The Catalano Grey paint is on the tank and the front fender only; suspension, engine and seat are black.",
    specs: [
      ["Fuel tank", "17 L, painted sheet steel"],
      ["Trim panel", "Aluminium, clear anodised"],
      ["Colour", "Catalano Grey non-metallic"],
      ["Fuel consumption (WMTC)", "45 mpg (US)"],
    ],
    sources: ["press"],
  },
  {
    id: "seat",
    name: "Seat",
    kicker: "805 mm",
    nodes: ["seat*"],
    explode: [0, 0.55, 0.22],
    summary:
      "Factory-ready for a passenger. For solo riding the passenger frame comes off, and an aluminium rider's hump seat cover can go on in its place.",
    specs: [
      ["Seat height", "805 mm"],
      ["Passenger", "Factory-equipped"],
      ["Solo option", "Aluminium rider's hump seat"],
    ],
    sources: ["press"],
  },
  {
    id: "footrests",
    name: "Footrests",
    kicker: "Forged aluminium",
    nodes: ["footrest*"],
    explode: [0, -0.28, 0.12],
    summary: "Rider and passenger footrests in forged aluminium, finished clear anodised like the fork bridges.",
    specs: [["Footrests", "Forged aluminium, clear anodised"]],
    sources: ["press"],
  },
  {
    id: "frame",
    name: "Frame & chassis",
    kicker: "Tubular steel space frame",
    nodes: ["frame*"],
    explode: [0, 0.3, 0],
    summary:
      "A modular tubular-steel space frame that uses the boxer engine as a self-supporting member. The passenger frame bolts on, so the bike can go solo.",
    specs: [
      ["Frame", "Tubular steel space frame, engine self-supporting"],
      ["Passenger frame", "Removable"],
      ["Wheelbase", "1,493 mm"],
      ["Length", "2,105 mm (82.9 in)"],
      ["Width (with mirrors)", "900 mm (35.4 in)"],
      ["Weight, road ready", "219 kg (483 lbs, DIN unladen)"],
      ["Top speed", "Over 200 km/h (125 mph)"],
    ],
    sources: ["press"],
  },
];

export const R_NINET_PURE: BikeDefinition = {
  slug: "r-ninet-pure",
  path: "/r-ninet-pure",
  brand: "BMW",
  modelLine: "BMW R nineT",
  title: "R nineT Pure",
  year: "2018",
  tagline: "Make Life a Ride",
  model: "/models/bikes/bmw_r_ninet_pure.glb",
  hiddenNodes: [],
  parts: PARTS,
  sources: SOURCES,
  credit: { name: "BMW Group PressClub", source: "press" },
  modelCredit: {
    title: "BMW R 90 Pure",
    author: "Nieve5677",
    url: "https://sketchfab.com/3d-models/bmw-r-90-pure-01cf4b2bbea447fa978b4f57b3ca1db9",
    license: "CC BY 4.0",
  },
  heroSpecs: [
    ["1,170 cc", "Air/oil-cooled boxer"],
    ["81 kW", "@ 7,750 rpm"],
    ["116 Nm", "@ 6,000 rpm"],
    ["125 / 120 mm", "Fork / Paralever travel"],
    ["219 kg", "Road ready"],
  ],
  explode: DEFAULT_EXPLODE,
  lights: {
    glow: [
      { nodes: ["headlight_lens*"], color: "#fff4dc", intensity: 6 },
      { nodes: ["taillight_lens*"], color: "#ff2424", intensity: 5 },
    ],
    // Lens glass only: the headlight body's own glass parts stay dark
    lampMaterial: /^M_Glass_(Clear|Red)$/,
    headlights: [[0, 0.85, -0.67]],
    beamDirection: [0, -0.22, -1],
  },
  // The Pure's standard Catalano Grey, plus the two Option 719 finishes BMW
  // added for it in 2019
  paint: {
    source: "colours",
    slots: {
      tank: { label: "Tank & fender", materials: ["M_Paint_CatalanoGrey"] },
      rims: { label: "Rims", materials: ["M_Rim_Black_Alu"] },
    },
    liveries: [
      {
        id: "catalano-grey",
        name: "Catalano Grey",
        swatch: ["#424a4d", "#16171a", "#b8b8ba"],
        paint: {
          // The web model's own paint (M_Paint_CatalanoGrey)
          tank: { color: "#424a4d", metalness: 0, roughness: 0.45, clearcoat: 1 },
          rims: { color: "#38383b", metalness: 0.7, roughness: 0.32 },
        },
      },
      {
        id: "blackstorm-aurum",
        name: "Option 719 Blackstorm metallic / Aurum",
        note: "Option 719, 2019",
        swatch: ["#17181c", "#b8913f", "#16171a"],
        paint: {
          tank: { color: "#17181c", metalness: 0.6, roughness: 0.22, clearcoat: 1 },
          rims: { color: "#38383b", metalness: 0.7, roughness: 0.32 },
        },
      },
      {
        id: "blackstorm-light-white",
        name: "Option 719 Blackstorm metallic / Light white",
        note: "Option 719, 2019",
        swatch: ["#eceae4", "#17181c", "#16171a"],
        paint: {
          tank: { color: "#eceae4", metalness: 0.05, roughness: 0.2, clearcoat: 1 },
          rims: { color: "#38383b", metalness: 0.7, roughness: 0.32 },
        },
      },
    ],
  },
  ride: {
    wheelNodes: ["wheel_lf*", "wheel_lr*"],
    discNodes: ["bikedisc_*"],
    spin: 11,
    // End of the silencer, on the left
    exhaustOutlet: [-0.19, 0.5, 0.86],
    rearContact: [0, 0, 0.727],
    // Classic road set-up (125 / 120 mm)
    suspension: {
      sag: [0.026, 0.022],
      bump: 0.005,
      frontAxle: [0, 0.3, -0.765],
      rearAxle: [0, 0.315, 0.727],
      // Fork lowers slide over the stanchions (forks_upper, sprung); fender,
      // calipers and the reflectors ride on the lowers
      unsprung: ["wheel_*", "bikedisc_*", "caliper_f*", "forks_lower*", "fender_f*", "reflector_f*"],
      stretch: ["shock*"],
      swingarm: ["swingarm*"],
      pivot: [0, 0.37, 0.175],
    },
  },
  intro: { ...INTRO_TIMING, zFront: -1.12, zBack: 1.12 },
  // Boxer twin: opposed cylinders, even firing every 360° — a smooth, low
  // revving flat-twin thrum
  sound: {
    firing: [0, 360],
    idleRpm: 1050,
    cruiseRpm: 5200,
    peakRpm: 7750,
    // Two long headers under the engine into one silencer
    headers: [0.85, 0.85],
    main: 0.7,
    tone: 1000,
    body: 110,
    window: 240,
    variability: 0.16,
    pops: false,
  },
  camera: {
    fov: 35,
    position: [4.0, 1.6, -3.0],
    target: [0, 0.58, 0],
  },
  theme: {
    // Heritage roadster: light studio, BMW roundel blue, white and black
    dark: false,
    accent: "#1c69d4",
    accentHover: "#1556b0",
    accent2: "#9a7430",
    stripes: ["#1c69d4", "#ffffff", "#16171a"],
    studio: { day: "#e4e6e8", night: "#101215" },
    garage: "light",
  },
};
