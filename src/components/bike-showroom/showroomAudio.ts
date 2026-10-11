/**
 * Showroom sound, synthesised with Web Audio (no audio files):
 *
 * - Intro: a low drone under the whole build, a resonant sweep riding each of
 *   the three scan edges, data crackle and laser zaps while the hologram
 *   builds, a whoosh for the shape pass, a rising chime for the texture pass
 *   and a deep "lock-in" thump when the real bike is in. Driven by the
 *   scene's intro clock, so it stays in step even when frames stall.
 * - Ride: a physically modelled engine (engineWorklet.ts) built from the
 *   bike's firing order, header and pipe lengths — cranking on the starter,
 *   catching, three gears with a throttle cut at each shift, crackle off the
 *   throttle — plus wind noise that grows with the speed.
 *
 * One AudioContext for the whole app, created on the first click of the
 * sound toggle (browsers only start audio from a user gesture).
 */

import type { IntroSettings } from "@/config/bikeShowroom";
import { ENGINE_WORKLET } from "@/components/bike-showroom/engineWorklet";

export interface EngineSound {
  // Crank angles (degrees, 0–720) where a cylinder fires in one 4-stroke
  // cycle: a 270° twin fires at 0 and 270, an even triple every 240
  firing: number[];
  idleRpm: number;
  // Revs at full ride speed (top of 3rd gear)
  cruiseRpm: number;
  // Revs just before each upshift
  peakRpm: number;
  // Header pipe lengths (m), one per cylinder, and the main pipe after the
  // collector — their echoes give the exhaust its pitch
  headers: number[];
  main: number;
  // Muffler lowpass with the throttle shut (Hz) — opens up under load
  tone: number;
  // Body resonance (Hz)
  body: number;
  // Crank degrees an exhaust pulse lasts
  window: number;
  // Firing-to-firing strength variation (0..1): lumpy idle
  variability: number;
  // Crackle off the throttle at high revs
  pops: boolean;
}

const GEARS = 3;
const MASTER = 0.7;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const smoothstep = (x: number, a: number, b: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const noiseBuffer = (ctx: AudioContext, seconds: number) => {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
};

const loop = (ctx: AudioContext, buffer: AudioBuffer) => {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.start();
  return source;
};

const gain = (ctx: AudioContext, value = 0) => {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
};

const filter = (ctx: AudioContext, type: BiquadFilterType, frequency: number, Q = 1, gainDb = 0) => {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = Q;
  f.gain.value = gainDb;
  return f;
};

const oscillator = (ctx: AudioContext, type: OscillatorType, frequency: number) => {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = frequency;
  return o;
};

// Soft clipping, for a bit of exhaust grit
const saturator = (ctx: AudioContext, drive: number) => {
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
  }
  shaper.curve = curve;
  return shaper;
};

// A short enveloped tone (zaps, chimes, thumps); cleans itself up
const blip = (
  ctx: AudioContext,
  bus: AudioNode,
  at: number,
  { type = "sine", from, to = from, peak, attack = 0.005, decay }: {
    type?: OscillatorType;
    from: number;
    to?: number;
    peak: number;
    attack?: number;
    decay: number;
  },
) => {
  const osc = oscillator(ctx, type, from);
  osc.frequency.setValueAtTime(from, at);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + decay);
  const env = gain(ctx);
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(peak, at + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  osc.connect(env).connect(bus);
  osc.start(at);
  osc.stop(at + attack + decay + 0.05);
};

/* --------------------------------- Engine -------------------------------- */

class EngineVoice {
  readonly sound: EngineSound;
  private ctx: AudioContext;
  private bus: AudioNode;
  private node: AudioWorkletNode;
  private rpm: AudioParam;
  private throttle: AudioParam;
  private level: AudioParam;
  private combustion: AudioParam;
  private muffler: BiquadFilterNode;
  private noise: AudioBufferSourceNode;
  private wind: GainNode;
  private windFilter: BiquadFilterNode;
  private running = false;
  // AudioContext time the engine was last started (-Infinity: never)
  private startedAt = -Infinity;
  private on = 0;
  private lastSpeed = 0;
  private lastGear = 0;
  // Throttle cut while changing gear, until this time
  private shiftUntil = 0;

  constructor(ctx: AudioContext, bus: AudioNode, sound: EngineSound) {
    this.ctx = ctx;
    this.bus = bus;
    this.sound = sound;

    this.node = new AudioWorkletNode(ctx, "bike-engine", {
      numberOfInputs: 0,
      outputChannelCount: [1],
      processorOptions: {
        firing: sound.firing,
        headers: sound.headers,
        main: sound.main,
        window: sound.window,
        variability: sound.variability,
        pops: sound.pops,
      },
    });
    const param = (name: string) => this.node.parameters.get(name)!;
    this.rpm = param("rpm");
    this.throttle = param("throttle");
    this.level = param("level");
    this.combustion = param("firing");
    this.rpm.value = sound.idleRpm;

    // Muffler, body, a little grit, then out
    this.muffler = filter(ctx, "lowpass", sound.tone, 0.8);
    this.node
      .connect(filter(ctx, "highpass", 28, 0.7))
      .connect(this.muffler)
      .connect(filter(ctx, "peaking", sound.body, 1.2, 5))
      .connect(saturator(ctx, 1.6))
      .connect(gain(ctx, 0.5))
      .connect(bus);

    // Wind / road noise
    this.noise = loop(ctx, noiseBuffer(ctx, 2));
    this.windFilter = filter(ctx, "bandpass", 500, 0.6);
    this.wind = gain(ctx);
    this.noise.connect(this.windFilter).connect(this.wind).connect(bus);
  }

  // Gear and revs for a ride speed: through the gears while picking up speed
  private gearFor(speed: number) {
    const { idleRpm, cruiseRpm, peakRpm } = this.sound;
    const x = clamp01(speed) * GEARS;
    const g = Math.min(Math.floor(x), GEARS - 1);
    const local = x - g;
    const low = lerp(idleRpm * 1.6, cruiseRpm * 0.72, g / (GEARS - 1));
    const geared = lerp(low, g === GEARS - 1 ? cruiseRpm : peakRpm, local);
    return { gear: g, rpm: lerp(idleRpm, geared, smoothstep(speed, 0, 0.08)) };
  }

  /**
   * running: the ride toggle; speed: the eased ride level (0..1), which
   * coasts down after a stop
   */
  update(running: boolean, speed: number, delta: number) {
    const now = this.ctx.currentTime;
    const { idleRpm } = this.sound;
    // Starter, then the engine catches. A restart while it's still turning
    // skips the starter
    if (running && !this.running && this.on < 0.05) {
      this.startedAt = now;
      this.starter(now);
    }
    this.running = running;

    const sinceStart = now - this.startedAt;
    const cranking = sinceStart < 0.55;
    const { gear, rpm: geared } = this.gearFor(speed);

    // Throttle: open while gaining speed, part-open cruising, shut while
    // coasting; cut for a moment at each upshift
    const accel = (speed - this.lastSpeed) / Math.max(delta, 1e-3);
    this.lastSpeed = speed;
    if (gear > this.lastGear) this.shiftUntil = now + 0.14;
    this.lastGear = gear;
    // Cruising, the rider's hand isn't perfectly still
    const hand = Math.sin(now * 0.9) * 0.06 + Math.sin(now * 2.3) * 0.03;
    let throttle = running ? clamp01(0.32 + hand + accel * 2.5) : 0.03;
    if (now < this.shiftUntil) throttle = 0.04;

    // On: running (after the starter) or still coasting after a stop
    const target = running || cranking ? 1 : smoothstep(speed, 0.02, 0.3);
    this.on = lerp(this.on, target, 0.08);

    let rpm = geared * (1 + hand * 0.25 * smoothstep(speed, 0.5, 1));
    if (cranking) {
      // Turning over on the starter, no combustion yet
      rpm = 280 + Math.sin(now * 40) * 30;
      // Load for the compression puffs (combustion is off)
      throttle = 0.7;
    } else if (sinceStart < 1.8) {
      // Catches with a flare of revs
      rpm = Math.max(rpm, idleRpm * (1 + 0.9 * Math.exp(-(sinceStart - 0.55) / 0.25)));
      throttle = Math.max(throttle, 0.5 * Math.exp(-(sinceStart - 0.55) / 0.3));
    }
    // Shut throttle: revs sag between shifts
    if (now < this.shiftUntil) rpm *= 0.94;

    this.rpm.setTargetAtTime(rpm, now, cranking ? 0.02 : 0.07);
    this.throttle.setTargetAtTime(throttle, now, 0.05);
    this.combustion.setTargetAtTime(cranking ? 0 : 1, now, 0.02);
    this.level.setTargetAtTime(this.on * (cranking ? 0.9 : 1), now, 0.04);
    this.muffler.frequency.setTargetAtTime(this.sound.tone * (0.75 + 1.1 * throttle + 0.4 * speed), now, 0.06);
    this.windFilter.frequency.setTargetAtTime(350 + speed * 1200, now, 0.2);
    this.wind.gain.setTargetAtTime(speed * speed * 0.06, now, 0.25);
  }

  // Starter motor whine under the cranking
  private starter(at: number) {
    const ctx = this.ctx;
    const osc = oscillator(ctx, "sawtooth", 320);
    osc.frequency.setValueAtTime(260, at);
    osc.frequency.linearRampToValueAtTime(380, at + 0.5);
    const env = gain(ctx);
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(0.03, at + 0.05);
    env.gain.setValueAtTime(0.03, at + 0.48);
    env.gain.linearRampToValueAtTime(0, at + 0.6);
    osc.connect(filter(ctx, "bandpass", 700, 2)).connect(env).connect(this.bus);
    osc.start(at);
    osc.stop(at + 0.65);
  }

  dispose() {
    const now = this.ctx.currentTime;
    this.level.setTargetAtTime(0, now, 0.05);
    this.wind.gain.setTargetAtTime(0, now, 0.05);
    this.noise.stop(now + 0.4);
    setTimeout(() => this.node.disconnect(), 500);
  }
}

/* --------------------------------- Intro --------------------------------- */

class IntroVoice {
  private ctx: AudioContext;
  private bus: AudioNode;
  private sources: AudioScheduledSourceNode[] = [];
  private drone: GainNode;
  private sweep: GainNode;
  private sweepFilter: BiquadFilterNode;
  private sweepOsc: OscillatorNode;
  private crackle: GainNode;
  private whoosh: GainNode;
  private whooshFilter: BiquadFilterNode;
  private lastT = -1;

  constructor(ctx: AudioContext, bus: AudioNode) {
    this.ctx = ctx;
    this.bus = bus;

    // Drone: a low fifth with a slow shimmer
    this.drone = gain(ctx);
    const droneFilter = filter(ctx, "lowpass", 420, 0.8);
    droneFilter.connect(this.drone).connect(bus);
    [
      ["sine", 55, 0.5],
      ["sine", 82.4, 0.32],
      ["triangle", 110.3, 0.12],
    ].forEach(([type, f, level]) => {
      const osc = oscillator(ctx, type as OscillatorType, f as number);
      osc.connect(gain(ctx, level as number)).connect(droneFilter);
      osc.start();
      this.sources.push(osc);
    });

    // Sweep: a buzzy tone through a resonant bandpass that rides the scan edge
    this.sweepOsc = oscillator(ctx, "sawtooth", 110);
    this.sweepFilter = filter(ctx, "bandpass", 300, 9);
    this.sweep = gain(ctx);
    this.sweepOsc.connect(this.sweepFilter).connect(this.sweep).connect(bus);
    this.sweepOsc.start();

    const noise = noiseBuffer(ctx, 2);
    // Crackle: high hiss, chopped up per frame while points condense
    this.crackle = gain(ctx);
    const hiss = loop(ctx, noise);
    hiss.connect(filter(ctx, "highpass", 3200, 0.7)).connect(this.crackle).connect(bus);
    // Whoosh: noise through a moving lowpass (shape pass)
    this.whoosh = gain(ctx);
    this.whooshFilter = filter(ctx, "lowpass", 200, 1.2);
    const air = loop(ctx, noise);
    air.connect(this.whooshFilter).connect(this.whoosh).connect(bus);

    this.sources.push(this.sweepOsc, hiss, air);
  }

  /** t: seconds since the intro began (negative before, ≥ end after) */
  update(t: number, intro: IntroSettings, delta: number) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    // A jump (skip intro) shouldn't fire every one-shot at once
    const crossed = (x: number) => this.lastT < x && t >= x && t - this.lastT < 0.5;

    const fadeOut = 1 - smoothstep(t, intro.textureEnd, intro.end + 0.8);
    const skipped = t - this.lastT > 0.5 && t >= intro.end;
    const tc = skipped ? 0.03 : 0.08;

    this.drone.gain.setTargetAtTime(t < 0 ? 0 : smoothstep(t, 0, 0.6) * fadeOut * 0.22, now, tc);

    // Which sweep is running, and how far along
    const sweeps: [number, number, number, number][] = [
      [intro.scanStart, intro.scanEnd, 0.1, 110],
      [intro.shapeStart, intro.shapeEnd, 0.06, 82],
      [intro.textureStart, intro.textureEnd, 0.08, 165],
    ];
    const active = sweeps.find(([a, b]) => t >= a && t <= b);
    if (active) {
      const [a, b, level, pitch] = active;
      const p = smoothstep(t, a, b);
      this.sweepFilter.frequency.setTargetAtTime(300 * Math.pow(9, p), now, 0.05);
      this.sweepOsc.frequency.setTargetAtTime(pitch * (1 + p * 0.5), now, 0.05);
      const edge = smoothstep(t, a, a + 0.15) * (1 - smoothstep(t, b - 0.15, b));
      this.sweep.gain.setTargetAtTime(level * edge, now, 0.03);
    } else {
      this.sweep.gain.setTargetAtTime(0, now, tc);
    }

    // Hologram building: crackle and laser zaps
    const building = t >= intro.scanStart && t < intro.shapeStart + 0.3;
    const buildLevel = building ? smoothstep(t, intro.scanStart, intro.scanStart + 0.4) : 0;
    this.crackle.gain.setTargetAtTime(buildLevel * (Math.random() < 0.35 ? 0.05 : 0.008), now, 0.01);
    if (building && t < intro.scanEnd && Math.random() < delta * 9) {
      const f = 1400 + Math.random() * 1400;
      blip(ctx, this.bus, now, { from: f, to: f * 0.45, peak: 0.035, decay: 0.07 });
    }

    // Shape pass: a whoosh that opens up with the sweep
    const shaping = t >= intro.shapeStart - 0.1 && t <= intro.shapeEnd + 0.2;
    const sp = smoothstep(t, intro.shapeStart, intro.shapeEnd);
    this.whooshFilter.frequency.setTargetAtTime(200 + sp * 2600, now, 0.06);
    this.whoosh.gain.setTargetAtTime(
      shaping ? 0.09 * smoothstep(t, intro.shapeStart - 0.1, intro.shapeStart + 0.3) * (1 - sp * 0.6) : 0,
      now,
      tc,
    );

    // Texture pass: a rising chime, then the lock-in thump with a low chord
    if (crossed(intro.textureStart)) {
      [880, 1318.5, 1760, 2637].forEach((f, i) =>
        blip(ctx, this.bus, now + i * 0.13, { from: f, peak: 0.05, attack: 0.01, decay: 1.1 }),
      );
    }
    if (crossed(intro.textureEnd)) {
      blip(ctx, this.bus, now, { from: 90, to: 38, peak: 0.55, decay: 0.55 });
      blip(ctx, this.bus, now, { type: "triangle", from: 2200, to: 400, peak: 0.08, attack: 0.001, decay: 0.05 });
      [110, 164.8, 220].forEach((f) =>
        blip(ctx, this.bus, now + 0.02, { type: "triangle", from: f, peak: 0.07, attack: 0.05, decay: 1.8 }),
      );
    }
    this.lastT = t;
  }

  dispose() {
    const now = this.ctx.currentTime;
    [this.drone, this.sweep, this.crackle, this.whoosh].forEach((g) => g.gain.setTargetAtTime(0, now, 0.05));
    this.sources.forEach((s) => s.stop(now + 0.4));
  }
}

/* -------------------------------- Manager -------------------------------- */

class ShowroomAudio {
  readonly ctx: AudioContext;
  private master: GainNode;
  private enabled = false;
  private engine: EngineVoice | null = null;
  private intro: IntroVoice | null = null;
  // The engine worklet module loads asynchronously
  private workletReady = false;

  constructor() {
    this.ctx = new AudioContext();
    const url = URL.createObjectURL(new Blob([ENGINE_WORKLET], { type: "application/javascript" }));
    this.ctx.audioWorklet
      .addModule(url)
      .then(() => {
        this.workletReady = true;
      })
      .catch((error) => console.warn("Engine sound unavailable", error))
      .finally(() => URL.revokeObjectURL(url));
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 6;
    this.master = gain(this.ctx);
    this.master.connect(limiter).connect(this.ctx.destination);
    // Nothing plays in a background tab
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) void this.ctx.suspend();
      else if (this.enabled) void this.ctx.resume();
    });
  }

  get isEnabled() {
    return this.enabled;
  }

  // Call from a user gesture to unlock audio
  setEnabled(on: boolean) {
    this.enabled = on;
    if (on && !document.hidden) void this.ctx.resume();
    this.master.gain.setTargetAtTime(on ? MASTER : 0, this.ctx.currentTime, 0.12);
    // Muted: stop the voices too (they're rebuilt on demand)
    if (!on) this.stopAll();
  }

  updateEngine(sound: EngineSound, running: boolean, speed: number, delta: number) {
    if (!this.enabled || !this.workletReady) return;
    if (this.engine && this.engine.sound !== sound) {
      this.engine.dispose();
      this.engine = null;
    }
    // Only build the voice once there's something to hear
    if (!this.engine && !running && speed < 0.01) return;
    this.engine ??= new EngineVoice(this.ctx, this.master, sound);
    this.engine.update(running, speed, delta);
  }

  updateIntro(t: number, intro: IntroSettings, delta: number) {
    if (!this.enabled) return;
    const live = t >= 0 && t < intro.end + 1;
    if (!live) {
      this.intro?.dispose();
      this.intro = null;
      return;
    }
    this.intro ??= new IntroVoice(this.ctx, this.master);
    this.intro.update(t, intro, delta);
  }

  // Leaving the page: drop every voice
  stopAll() {
    this.engine?.dispose();
    this.intro?.dispose();
    this.engine = null;
    this.intro = null;
  }
}

let instance: ShowroomAudio | null = null;

// Creates the shared AudioContext — only from a user gesture
export const getShowroomAudio = () => (instance ??= new ShowroomAudio());
// The shared audio if it exists, without creating it
export const peekShowroomAudio = () => instance;
