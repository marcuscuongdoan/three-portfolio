/**
 * Station blackout run of the gas turbine, as a pure function of plant time.
 *
 * Start (seconds after the blackout): the unit gets its start signal, fuel
 * and lube oil come up, the starter cranks and purges, the fuel lights, the
 * engine runs up to 3,600 rpm, the generator excites, the breakers close it
 * onto the dead safety bus and the shutdown loads come on in steps — all
 * inside the 10 minutes 10 CFR 50.63 allows. Then it carries the plant.
 *
 * Stop (seconds after offsite power is back): loads go back to the grid, the
 * turbine runs unloaded to cool down, then the fuel shuts off and it coasts.
 *
 * The milestones follow how an aeroderivative unit starts; the exact times,
 * the load list and every reading are illustrative, scaled to the LM2500
 * reference (3,600 rpm, 566 °C exhaust at full load, 70.5 kg/s).
 */

export type SimMode = "standby" | "starting" | "running" | "stopping";

export interface SimPhase {
  id: string;
  label: string;
  // Plant seconds the phase starts at
  at: number;
  detail: string;
}

export const DEADLINE = 600;
// Winter night: icing weather, so anti-icing runs
export const AMBIENT_C = 2;

export const START_PHASES: SimPhase[] = [
  { id: "sbo", label: "Station blackout", at: 0, detail: "Offsite power and the diesels are lost. Batteries carry DC; the reactor has tripped." },
  { id: "prestart", label: "Start signal", at: 8, detail: "Fuel forwarding pumps and lube oil come up; enclosure fans start." },
  { id: "crank", label: "Crank & purge", at: 40, detail: "The starter turns the engine over and blows any fuel vapour out of the exhaust." },
  { id: "lightoff", label: "Light-off", at: 95, detail: "Fuel valve opens, igniters fire, flame detected — exhaust temperature jumps." },
  { id: "accel", label: "Run-up", at: 105, detail: "The engine accelerates on its own power to 3,600 rpm, no load." },
  { id: "excite", label: "Excitation", at: 300, detail: "The generator field is flashed; voltage builds to rated at 60 Hz." },
  { id: "close", label: "Breakers realigned", at: 360, detail: "The AAC breaker closes onto the dead safety bus." },
  { id: "load", label: "Load sequencing", at: 450, detail: "Shutdown loads come on in steps, so the engine isn't hit all at once." },
  { id: "run", label: "Carrying the plant", at: 600, detail: "Shutdown loads on the turbine; the reactor's decay heat is being removed." },
];

export const STOP_PHASES: SimPhase[] = [
  { id: "transfer", label: "Grid restored", at: 0, detail: "Offsite power is back; loads transfer to it and the turbine unloads." },
  { id: "cooldown", label: "Cool-down", at: 40, detail: "Runs unloaded so the hot section cools evenly." },
  { id: "coast", label: "Fuel off", at: 280, detail: "Fuel valve closes, flame out, the rotor coasts down." },
  { id: "standby", label: "Standby", at: 380, detail: "Back on standby: ready for the next start signal." },
];

// Illustrative shutdown loads: [plant time, label, MW]
export const LOAD_STEPS: [at: number, label: string, mw: number][] = [
  [455, "Battery chargers & vital inverters", 0.6],
  [485, "Control room & switchgear HVAC", 0.9],
  [515, "Motor-driven auxiliary feedwater pump", 1.6],
  [545, "Charging / makeup pump", 0.9],
  [575, "Component cooling & service water", 2.2],
];
export const FULL_LOAD_MW = LOAD_STEPS.reduce((sum, [, , mw]) => sum + mw, 0);
// Size class of the reference machine
const RATED_MW = 25;
const RATED_RPM = 3600;

export interface SimState {
  mode: SimMode;
  phase: SimPhase;
  // Seconds into the current run (start) or stop
  t: number;
  // 0..1 shaft speed, of 3,600 rpm
  speed: number;
  rpm: number;
  hz: number;
  // Generator voltage, 0..1 of rated
  voltage: number;
  mw: number;
  // 0..1 of the shutdown load
  load: number;
  egt: number;
  // kg/s
  air: number;
  fuel: number;
  lubeBar: number;
  busLive: boolean;
  // Station battery state of charge, 0..1
  battery: number;
  flame: boolean;
  antiIcing: boolean;
  // Light-off puff of smoke, 0..1
  puff: number;
  loadsOn: number;
  // Wall-clock-free visual drives, 0..1
  flows: { air: number; fuel: number; transfer: number; antiice: number; power: number; grid: number; exhaust: number };
}

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const smooth = (x: number, a: number, b: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
// Small, steady flutter on running readings (deterministic in t)
const wobble = (t: number, k: number) => Math.sin(t * 0.7 + k) * 0.5 + Math.sin(t * 1.9 + k * 2.1) * 0.3;

const phaseAt = (phases: SimPhase[], t: number) => {
  let current = phases[0]!;
  for (const p of phases) if (t >= p.at) current = p;
  return current;
};

// Start run: t = plant seconds since the blackout
function starting(t: number): SimState {
  const phase = phaseAt(START_PHASES, t);
  const crank = smooth(t, 40, 80) * 0.24;
  const run = smooth(t, 105, 290);
  const speed = t < 105 ? crank : 0.24 + 0.76 * run;
  const flame = t >= 95;
  const voltage = smooth(t, 300, 345);
  const busLive = t >= 445;
  const loadsOn = LOAD_STEPS.filter(([at]) => t >= at).length;
  // Each step ramps on over a few seconds
  const mw = LOAD_STEPS.reduce((sum, [at, , m]) => sum + m * smooth(t, at, at + 6), 0) + (busLive ? 0.15 : 0);
  const load = mw / FULL_LOAD_MW;
  const steady = t >= 600 ? wobble(t, 1) : 0;
  // Exhaust temperature: ambient → warm air on cranking → spike at light-off
  // → ~380 °C at full speed no load → up with load (566 °C at rated)
  let egt = AMBIENT_C + crank * 40;
  if (flame) {
    const spike = 300 * Math.exp(-(t - 95) / 18) * smooth(t, 95, 98);
    egt = 330 + 50 * run + spike + (mw / RATED_MW) * 186 + steady * 3;
  }
  // Air: with the shaft speed, a little more as the load (and firing) rises
  const air = 70.5 * speed * (0.6 + 0.4 * (mw / RATED_MW));
  const fuel = flame ? 0.18 + 0.12 * run + 0.055 * mw + steady * 0.004 : 0;
  // Battery drains from the blackout until the chargers are back
  const charging = t >= LOAD_STEPS[0]![0];
  const battery = charging ? 0.93 + 0.07 * smooth(t, 455, 2400) : 1 - 0.07 * smooth(t, 0, 455);
  return {
    mode: t >= DEADLINE ? "running" : "starting",
    phase,
    t,
    speed,
    rpm: speed * RATED_RPM + (t >= 300 ? steady * 2 : 0),
    hz: (speed * RATED_RPM * 60) / RATED_RPM + (t >= 300 ? steady * 0.02 : 0),
    voltage,
    mw,
    load,
    egt,
    air,
    fuel,
    lubeBar: 2.6 * smooth(t, 8, 30) + steady * 0.03,
    busLive,
    battery,
    flame,
    antiIcing: flame && AMBIENT_C < 4,
    puff: flame ? Math.exp(-(t - 95) / 12) : 0,
    loadsOn,
    flows: {
      air: clamp01(speed * 1.2),
      fuel: t >= 8 ? (flame ? 0.4 + 0.6 * clamp01(fuel / 0.7) : 0.25) : 0,
      transfer: t >= 8 ? 0.6 : 0,
      antiice: flame ? smooth(t, 120, 200) : 0,
      power: busLive ? 0.35 + 0.65 * load : 0,
      grid: busLive ? 0.35 + 0.65 * load : 0,
      exhaust: flame ? 0.35 + 0.4 * run + 0.25 * (mw / FULL_LOAD_MW) : clamp01(crank * 2) * 0.25,
    },
  };
}

// Stop: t = plant seconds since offsite power came back, from a run that had
// reached `from` (its state when the stop began)
function stopping(t: number, from: SimState): SimState {
  const phase = phaseAt(STOP_PHASES, t);
  const unload = 1 - smooth(t, 0, 30);
  const mw = from.mw * unload;
  const flame = t < 280;
  const fsnl = from.speed;
  const speed = flame ? fsnl : fsnl * Math.exp(-(t - 280) / 28) * (1 - smooth(t, 340, 380));
  const egt = flame
    ? from.egt * unload + (380 - 40 * smooth(t, 40, 280)) * (1 - unload)
    : AMBIENT_C + (340 - AMBIENT_C) * Math.exp(-(t - 280) / 45);
  // Unloaded at full speed it still burns the no-load flow
  const idleFuel = 0.3;
  const fuel = flame ? idleFuel + Math.max(from.fuel - idleFuel, 0) * unload : 0;
  return {
    mode: t >= 380 ? "standby" : "stopping",
    phase,
    t,
    speed,
    rpm: speed * RATED_RPM,
    hz: speed * 60,
    voltage: from.voltage * (1 - smooth(t, 30, 45)),
    mw,
    load: mw / FULL_LOAD_MW,
    egt,
    air: 70.5 * speed * 0.6,
    fuel,
    lubeBar: 2.6 * (1 - smooth(t, 380, 400)) * (speed > 0.02 || t < 380 ? 1 : 0),
    busLive: t < 30,
    battery: Math.min(1, from.battery + 0.0002 * t),
    flame,
    antiIcing: flame && AMBIENT_C < 4,
    puff: 0,
    loadsOn: t < 30 ? from.loadsOn : 0,
    flows: {
      air: clamp01(speed * 1.2),
      fuel: flame ? 0.4 : 0,
      transfer: flame ? 0.3 : 0,
      antiice: flame ? from.flows.antiice * (1 - smooth(t, 200, 280)) : 0,
      power: unload * from.flows.power,
      grid: from.flows.grid,
      exhaust: flame ? 0.35 + 0.25 * unload : 0.3 * Math.exp(-(t - 280) / 20),
    },
  };
}

export const STANDBY: SimState = {
  mode: "standby",
  phase: STOP_PHASES[STOP_PHASES.length - 1]!,
  t: 0,
  speed: 0,
  rpm: 0,
  hz: 0,
  voltage: 0,
  mw: 0,
  load: 0,
  egt: AMBIENT_C,
  air: 0,
  fuel: 0,
  lubeBar: 0,
  busLive: false,
  battery: 1,
  flame: false,
  antiIcing: false,
  puff: 0,
  loadsOn: 0,
  flows: { air: 0, fuel: 0, transfer: 0, antiice: 0, power: 0, grid: 0, exhaust: 0 },
};

/**
 * One simulation run, advanced by the page's clock. `rate`: plant seconds
 * per real second.
 */
export class PlantSim {
  private mode: "standby" | "start" | "stop" = "standby";
  private t = 0;
  private stopFrom: SimState = STANDBY;
  state: SimState = STANDBY;

  get active() {
    return this.mode !== "standby";
  }

  start() {
    if (this.mode === "start") return;
    // Restarting while it coasts down picks up from a fresh signal
    this.mode = "start";
    this.t = 0;
    this.state = starting(0);
  }

  stop() {
    if (this.mode !== "start") return;
    this.stopFrom = this.state;
    this.mode = "stop";
    this.t = 0;
    this.state = stopping(0, this.stopFrom);
  }

  // Jump the start straight to steady running (skips the sequence)
  skip() {
    if (this.mode !== "start" || this.t >= DEADLINE) return;
    this.t = DEADLINE;
    this.state = starting(this.t);
  }

  advance(seconds: number) {
    if (this.mode === "standby") return;
    this.t += seconds;
    if (this.mode === "start") this.state = starting(this.t);
    else {
      this.state = stopping(this.t, this.stopFrom);
      if (this.state.mode === "standby") {
        this.mode = "standby";
        this.state = STANDBY;
      }
    }
  }
}

// "T+07:30"
export const formatClock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
};

// What a part is doing right now, for the part panel
export const partStatus = (id: string, s: SimState): string => {
  const running = s.mode === "starting" || s.mode === "running" || s.mode === "stopping";
  if (!running) {
    const idle: Record<string, string> = {
      intake: "Idle. Filters dry, dampers ready.",
      turbine: "Cold, on standby. Waiting for a start signal.",
      stack: "Cold. Nothing flowing.",
      antiicing: `Off. Ambient ${AMBIENT_C} °C — it will run once the engine is hot.`,
      switchgear: "AAC breaker open: connectable, not connected.",
      fuelskid: "Pumps stopped, lined up on the storage tank.",
      fueltank: "Full. Ready to carry the plant.",
      fuelpipe: "Lines full and isolated.",
      access: "Clear for walk-downs and filter checks.",
    };
    return idle[id] ?? "Standby.";
  }
  const kgh = (s.fuel * 3600).toFixed(0);
  switch (id) {
    case "intake":
      return `Drawing ${s.air.toFixed(1)} kg/s of air${s.antiIcing ? " — anti-icing on" : ""}.`;
    case "turbine":
      return s.flame
        ? `${Math.round(s.rpm).toLocaleString("en-US")} rpm, exhaust ${Math.round(s.egt)} °C, ${s.mw.toFixed(1)} MW.`
        : s.speed > 0.01
          ? `Cranking at ${Math.round(s.rpm).toLocaleString("en-US")} rpm — no fuel yet.`
          : "Lube oil up, ready to crank.";
    case "stack":
      return s.flame ? `Releasing ${Math.round(s.egt)} °C exhaust.` : "Purging air through the exhaust.";
    case "antiicing":
      return s.antiIcing ? `On: warming the inlet air (ambient ${AMBIENT_C} °C).` : "Off.";
    case "switchgear":
      return s.busLive
        ? `Safety bus live: ${s.loadsOn}/${LOAD_STEPS.length} load groups, ${s.mw.toFixed(1)} MW.`
        : s.voltage > 0.95
          ? "Generator at rated voltage, breakers realigning."
          : "AAC breaker open, safety bus dead.";
    case "fuelskid":
      return s.flame ? `Pumping ${kgh} kg/h to the turbine.` : "Pumps running, pressure up.";
    case "fueltank":
      return s.fuel > 0
        ? `Supplying ${kgh} kg/h.`
        : "Lined up to the skid.";
    case "fuelpipe":
      return s.flame ? `${kgh} kg/h flowing to the fuel valves.` : "Primed, pressure up.";
    case "access":
      return "Keep clear: unit running.";
    default:
      return "";
  }
};
