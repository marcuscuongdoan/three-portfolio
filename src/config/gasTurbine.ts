/**
 * Station blackout gas turbine — plant showroom page content (/gas-turbine).
 *
 * The GLB was published as "part of nuclear power plant reactor", but what it
 * shows is a packaged gas-turbine unit on a concrete pad: intake filter house,
 * turbine package, exhaust stack, anti-icing duct, fuel modules, a switchgear
 * house and access platforms (its nodes are named GPA2_*, "ГПА" being Russian
 * for a gas-turbine unit). Nuclear plants do keep machines like this: as the
 * alternate AC (AAC) source that powers the safety buses in a station
 * blackout. That is the role this page gives it.
 *
 * The model names no engine, so turbine figures are quoted for a reference
 * machine (GE LM2500, an aeroderivative of this size class), and part roles
 * are read from the geometry. Regulatory facts quote the NRC rules; the
 * running simulation's load list and timings are illustrative (see
 * plantSim.ts).
 *
 * `public/models/production_line/gas_turbine_unit.glb` is built from the
 * source GLB by scripts/build-gas-turbine-glb.js, which splits it into the
 * part nodes named below. Model space: the source's — +Y up, pad centred on
 * the origin, intake towards -X, stack towards +X.
 */

import type { CSSProperties } from "react";
import { INTRO_TIMING, type IntroSettings } from "@/config/bikeShowroom";

export type Vec3 = [number, number, number];

export interface PlantSource {
  label: string;
  url: string;
}

export interface PlantPart {
  id: string;
  name: string;
  kicker: string;
  // Node names (prefix match) in the GLB
  nodes: string[];
  summary: string;
  specs: [label: string, value: string][];
  notes?: string[];
  // Keys into SOURCES
  sources: string[];
}

/**
 * Something moving through the plant while it runs, drawn as glowing dashes
 * along a polyline (model space, through the pipe / duct centre).
 */
export interface PlantFlow {
  id: "air" | "fuel" | "transfer" | "antiice" | "power" | "grid";
  // Which part it belongs to (lights up with it when the part is open)
  part: string;
  color: string;
  // Dash speed, model metres per second at full flow
  speed: number;
  width: number;
  path: Vec3[];
}

export interface PlantDefinition {
  slug: string;
  path: string;
  modelLine: string;
  title: string;
  tagline: string;
  model: string;
  parts: PlantPart[];
  sources: Record<string, PlantSource>;
  heroSpecs: [value: string, label: string][];
  flows: PlantFlow[];
  // Where the exhaust leaves the stack, and which way
  stackOutlet: Vec3;
  stackDirection: Vec3;
  intro: IntroSettings;
  camera: { fov: number; position: Vec3; target: Vec3 };
  theme: { accent: string; accentHover: string; stripes: [string, string, string]; night: string };
}

const SOURCES: Record<string, PlantSource> = {
  cfr5063: {
    label: "10 CFR § 50.63 — Loss of all alternating current power",
    url: "https://www.law.cornell.edu/cfr/text/10/50.63",
  },
  cfr502: {
    label: "10 CFR § 50.2 — Definitions (alternate ac source, station blackout)",
    url: "https://www.law.cornell.edu/cfr/text/10/50.2",
  },
  sbo2013: {
    label: "NRC — Station Blackout Mitigation Strategies (July 2013)",
    url: "https://www.nrc.gov/docs/ML1317/ML13171A061.pdf",
  },
  paloVerde: {
    label: "Union of Concerned Scientists — Palo Verde backup power",
    url: "https://blog.ucs.org/dlochbaum/palo-verde-running-without-a-backup-power-supply/",
  },
  lm2500: {
    label: "General Electric LM2500 (reference machine)",
    url: "https://en.wikipedia.org/wiki/General_Electric_LM2500",
  },
  filtration: {
    label: "Turbomachinery Magazine — Elements of a gas turbine filtration system",
    url: "https://www.turbomachinerymag.com/view/elements-of-a-gas-turbine-filtration-system",
  },
  filterHouse: {
    label: "Donaldson — Gas turbine air inlet filter houses",
    url: "https://www.donaldson.com/en/products/gas-turbine-engineered-solutions/air-inlet-filter-houses/",
  },
  stackNoise: {
    label: "Institute of Acoustics — Gas turbine noise control (Iredale)",
    url: "https://www.ioa.org.uk/system/files/publications/RA%20IREDALE%20GAS%20TURBINE%20NOISE.pdf",
  },
  forwarding: {
    label: "US 2013/0068307 — Monitoring fuel at the forwarding skid for a gas turbine",
    url: "https://patents.justia.com/patent/20130068307",
  },
  fuelForum: {
    label: "Control.com — GE Frame 9E fuel oil pressure (operators' forum)",
    url: "https://control.com/forums/threads/ge-frame-9e-fuel-oil-pressure-hunting.35000/",
  },
  sboThesis: {
    label: "Tampere University — Requirement specification for an SBO gas turbine generator",
    url: "https://trepo.tuni.fi/handle/123456789/21350",
  },
};

const PARTS: PlantPart[] = [
  {
    id: "intake",
    name: "Air inlet filter house",
    kicker: "Weather hood → filters",
    nodes: ["intake_"],
    summary:
      "Every kilogram of air the turbine burns is pulled through here first. Hoods and louvres shed rain and snow, screens stop debris and insects, pre-filters take out the coarse dust, and high-efficiency filters catch the fine particles that would foul, corrode and plug the compressor and its cooling passages.",
    specs: [
      ["Stages, in order", "Weather hood & screens → coalescer → pre-filter → high-efficiency filter"],
      ["Pre-filter", "Catches most particles above ~10 µm"],
      ["High-efficiency filter", "Average separation above 80 %"],
      ["Pressure loss", "Up to 1 in H₂O new; changed at ~2.5 in H₂O (panels) or 4 in H₂O (cartridges)"],
      ["Air through it", "≈ 70 kg/s at full load (LM2500 exhaust flow: 70.5 kg/s)"],
      ["Monitoring", "Differential-pressure gauges across each stage"],
    ],
    notes: [
      "Ice blocking some filters forces the same airflow through the rest — which is why the anti-icing duct ends here.",
    ],
    sources: ["filtration", "filterHouse", "lm2500"],
  },
  {
    id: "turbine",
    name: "Gas turbine package",
    kicker: "Compressor · combustor · turbine",
    nodes: ["turbine_"],
    summary:
      "The engine and its generator under acoustic enclosures. The compressor squeezes the filtered air, fuel burns in an annular combustor, and the hot gas drives the turbine stages that spin the generator at 3,600 rpm — 60 Hz straight onto the bus. Aeroderivative engines like the reference machine go from standstill to full power in minutes, which is what standby duty asks for.",
    specs: [
      ["Reference machine", "GE LM2500 (aeroderivative)"],
      ["Output", "25,060 kW (33,600 shp)"],
      ["Thermal efficiency", "≈ 36 % (ISO)"],
      ["Power turbine speed", "3,600 rpm → 60 Hz"],
      ["Compressor", "16 stages"],
      ["Turbine", "2 HP + 6 LP stages"],
      ["Combustor", "Annular"],
      ["Exhaust", "566 °C, 70.5 kg/s"],
    ],
    notes: ["The model names no engine: figures are the LM2500's, as a machine of this size class."],
    sources: ["lm2500"],
  },
  {
    id: "stack",
    name: "Exhaust stack & silencer",
    kicker: "Hot gas out, noise down",
    nodes: ["stack_"],
    summary:
      "Takes the exhaust from the turbine and releases it high above the pad. Inside, silencer panels — baffles spaced across the gas path — absorb the low roar; their width and spacing decide how much noise comes out and at which frequencies. The steel lattice tower carries the stack's weight and wind load.",
    specs: [
      ["Gas temperature", "518–566 °C (LM2500 family)"],
      ["Silencer types", "Reactive, absorptive, or both"],
      ["At 25–50 MW", "Absorptive silencers, as sites are tight"],
      ["Tuning", "Panel width and spacing set attenuation and frequency"],
      ["Support", "Steel lattice tower"],
    ],
    notes: [
      "The stack silencer is one of the most costly noise-control parts of a combustion turbine package.",
    ],
    sources: ["stackNoise", "lm2500"],
  },
  {
    id: "antiicing",
    name: "Anti-icing duct",
    kicker: "Keeps the inlet ice-free",
    nodes: ["antiicing_"],
    summary:
      "In wet weather near freezing, ice builds on inlet screens and filters, chokes the airflow and can break off into the compressor. This duct brings warm air from the hot end of the unit back over to the filter house so the air arriving at the filters stays above freezing. A machine that has to start in any weather can't skip it.",
    specs: [
      ["Runs in", "Freezing climates, with rain, snow or freezing fog"],
      ["Heat from", "Hot air (here, from the stack end); elsewhere compressor bleed or heating coils"],
      ["Without it", "Ice blocks filters, damages parts, lowers output and filtration efficiency"],
    ],
    sources: ["filtration", "filterHouse"],
  },
  {
    id: "switchgear",
    name: "Switchgear & control house",
    kicker: "Generator → safety buses",
    nodes: ["switchgear_"],
    summary:
      "The generator's output runs through the flat bus duct into this house: generator breaker, protection, the turbine's control system. It is connectable to, but not normally connected to, the plant's power systems. In a station blackout the breakers are realigned so this unit feeds the shutdown buses that run the pumps keeping the reactor cool.",
    specs: [
      ["Role", "Alternate AC source (10 CFR 50.2)"],
      ["Connection", "Connectable, not normally connected"],
      ["Independence", "Minimum common-mode failure with offsite power and the diesels"],
      ["Capacity", "Every system needed to cope with the blackout and reach safe shutdown"],
      ["The 10-minute rule", "Shutdown buses powered within 10 min of the blackout → no coping analysis needed"],
      ["In service", "Palo Verde's gas turbine generators can supply any of its three units"],
    ],
    sources: ["cfr502", "cfr5063", "paloVerde"],
  },
  {
    id: "fuelskid",
    name: "Fuel forwarding skid",
    kicker: "Pumps · strainers · filters",
    nodes: ["fuelskid_"],
    summary:
      "Draws fuel from storage through a strainer and delivers it to the turbine at steady pressure. A typical skid has two pumps, a stop valve and a pressure regulator; heating and filtering stages follow before the fuel reaches the engine. It is the first machine to start in the sequence.",
    specs: [
      ["Takes from", "The storage tank, through a strainer"],
      ["Pumps", "Typically two (duty + standby)"],
      ["Then", "Heating (cold oil), filtration and regulation stages"],
      ["Protection", "Solenoid stop valve, pressure regulator ahead of the turbine"],
      ["Typical faults", "Clogged filter → pressure drop; trapped air → pressure oscillation"],
    ],
    sources: ["forwarding", "fuelForum"],
  },
  {
    id: "fueltank",
    name: "Fuel oil storage",
    kicker: "Days of fuel on the pad",
    nodes: ["fueltank_"],
    summary:
      "Liquid fuel kept on site, so the unit doesn't depend on a gas pipeline that a regional grid failure might also take down. Its size sets how long the turbine can carry the plant: after Fukushima the NRC proposed a minimum 8-hour coping time for loss of all AC, with equipment for a 72-hour extended loss.",
    specs: [
      ["Fuel", "Distillate oil"],
      ["Why liquid", "Independent of the gas network"],
      ["Coping (2013 basis)", "8 h minimum, 72 h extended"],
      ["Refilled by", "Road tanker"],
    ],
    notes: [
      "Nuclear emergency-power rules were written around diesel engines; a 2013 thesis notes there's no standard yet for designing and testing gas turbines in this role.",
    ],
    sources: ["sbo2013", "sboThesis"],
  },
  {
    id: "fuelpipe",
    name: "Fuel lines",
    kicker: "Tank → skid → turbine",
    nodes: ["fuelpipe_"],
    summary:
      "The transfer line lifts fuel from the storage tank over to the forwarding skid; the supply header carries it on along the turbine package to the fuel valves, ending at a drain and sampling point at the corner of the pad.",
    specs: [
      ["Transfer line", "Storage tank → forwarding skid"],
      ["Supply header", "Skid → turbine fuel valves"],
      ["End point", "Drain / sampling station"],
      ["Watch for", "Air in the line between skid and stop valve"],
    ],
    sources: ["forwarding", "fuelForum"],
  },
  {
    id: "access",
    name: "Platforms & ladders",
    kicker: "Inspection access",
    nodes: ["access_"],
    summary:
      "Grated platforms, caged ladders and handrails put every filter door, valve and gauge within reach. Filters are serviced when their differential pressure says so, and a standby machine is only as good as its last test — so the people who check it need a safe way up.",
    specs: [
      ["Serves", "Filter house, stack base, fuel modules, turbine train"],
      ["Includes", "Walkways, service doors, caged ladders, handrails"],
    ],
    sources: ["filterHouse"],
  },
];

// Flow paths, from the pipe and duct flanges in the GLB (model space)
const FLOWS: PlantFlow[] = [
  {
    // Drawn in round the hood, through the filter house into the turbine's
    // three inlet trunks
    id: "air",
    part: "intake",
    color: "#7fd8ff",
    speed: 1.1,
    width: 0.05,
    path: [
      [-1.75, 1.15, 0.9],
      [-1.2, 1.15, 0.9],
      [-0.95, 1.18, 0.9],
      [-0.3, 1.18, 0.9],
      [0.45, 1.18, 0.9],
    ],
  },
  {
    id: "air",
    part: "intake",
    color: "#7fd8ff",
    speed: 1.1,
    width: 0.05,
    path: [
      [-1.75, 1.15, 0.45],
      [-1.2, 1.15, 0.45],
      [-0.95, 1.18, 0.52],
      [-0.3, 1.18, 0.52],
      [0.45, 1.18, 0.52],
    ],
  },
  {
    id: "air",
    part: "intake",
    color: "#7fd8ff",
    speed: 1.1,
    width: 0.05,
    path: [
      [-1.75, 1.15, 1.35],
      [-1.2, 1.15, 1.35],
      [-0.95, 1.18, 1.28],
      [-0.3, 1.18, 1.28],
      [0.45, 1.18, 1.28],
    ],
  },
  {
    // Storage tank → over the top → forwarding skid
    id: "transfer",
    part: "fuelpipe",
    color: "#ffb347",
    speed: 0.6,
    width: 0.028,
    path: [
      [1.74, 0.62, -0.98],
      [1.74, 1.15, -1.04],
      [1.74, 1.15, -1.29],
      [0.45, 1.15, -1.29],
      [0.45, 1.15, -1.59],
      [0.09, 1.15, -1.59],
      [0.09, 0.56, -1.59],
    ],
  },
  {
    // Forwarding skid → up → along the turbine package → corner drain point
    id: "fuel",
    part: "fuelpipe",
    color: "#ffb347",
    speed: 0.7,
    width: 0.03,
    path: [
      [-0.36, 0.54, -0.4],
      [-0.36, 0.54, -0.03],
      [-0.36, 1.29, -0.03],
      [-0.36, 1.29, 0.33],
      [1.18, 1.29, 0.33],
      [1.18, 1.29, 1.47],
      [1.7, 1.29, 1.47],
      [1.7, 0.5, 1.47],
    ],
  },
  {
    // Warm air from the stack base back over to the filter house hood
    id: "antiice",
    part: "antiicing",
    color: "#ff7a45",
    speed: 0.9,
    width: 0.045,
    path: [
      [1.12, 1.22, 0.13],
      [1.12, 1.46, 0.13],
      [-1.02, 1.46, 0.13],
      [-1.02, 1.46, 0.9],
    ],
  },
  {
    // Generator end → bus duct → switchgear house
    id: "power",
    part: "switchgear",
    color: "#9d8cff",
    speed: 2.2,
    width: 0.035,
    path: [
      [-0.68, 0.66, 0.48],
      [-0.8, 0.66, 0.4],
      [-0.8, 0.66, -0.41],
      [-1.02, 0.66, -0.54],
      [-1.25, 0.66, -0.66],
    ],
  },
  {
    // Switchgear house → off the pad to the plant's safety buses
    id: "grid",
    part: "switchgear",
    color: "#9d8cff",
    speed: 2.6,
    width: 0.035,
    path: [
      [-1.47, 0.07, -1.8],
      [-1.47, 0.07, -2.05],
      [-2.6, 0.07, -2.05],
      [-3.6, 0.07, -2.05],
    ],
  },
];

export const GAS_TURBINE: PlantDefinition = {
  slug: "gas-turbine",
  path: "/gas-turbine",
  modelLine: "Nuclear plant · Alternate AC source",
  title: "SBO Gas Turbine",
  tagline: "Station blackout backup power",
  model: "/models/production_line/gas_turbine_unit.glb",
  parts: PARTS,
  sources: SOURCES,
  heroSpecs: [
    ["≤ 10 min", "To the safety buses"],
    ["3,600 rpm", "60 Hz generator"],
    ["25 MW", "Size class"],
    ["8 h / 72 h", "Coping basis"],
  ],
  flows: FLOWS,
  // Top of the stack's bent hood (see the GLB: stack_*)
  stackOutlet: [1.21, 2.1, -0.62],
  stackDirection: [0, 0.55, -1],
  intro: {
    ...INTRO_TIMING,
    points: 70000,
    zFront: -2.15,
    zBack: 2.15,
    fromOffset: [0, 0.2, -0.5],
  },
  camera: { fov: 32, position: [6.4, 4.6, 7.4], target: [0.1, 0.75, 0] },
  theme: {
    accent: "#ff6b2c",
    accentHover: "#ff8a52",
    // Hazard amber, steel, safety-bus violet
    stripes: ["#ffb347", "#8b98a8", "#9d8cff"],
    night: "#0c0f14",
  },
};

// CSS variables for the page (see bike-showroom.css, whose dark theme it uses)
export const plantThemeStyle = (def: PlantDefinition) =>
  ({
    "--bk-day": def.theme.night,
    "--bk-night": def.theme.night,
    "--bk-accent": def.theme.accent,
    "--bk-accent-hover": def.theme.accentHover,
    "--bk-accent-2": def.theme.stripes[2],
    "--bk-stripe-1": def.theme.stripes[0],
    "--bk-stripe-2": def.theme.stripes[1],
    "--bk-stripe-3": def.theme.stripes[2],
  }) as CSSProperties;
