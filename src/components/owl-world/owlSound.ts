/**
 * Owl sounds, synthesised with Web Audio (no audio files): a "hoo-hoo
 * hoooo" call and the rush of wingbeats, scheduled to match the wing stretch
 * OwlPoser plays when an owl is clicked. The AudioContext is made on the first click on an owl
 * (browsers only start audio from a user gesture).
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;

function audio() {
  if (!ctx) {
    ctx = new AudioContext();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(comp).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { ctx, master: master!, noise: noise! };
}

/** One hooted note: a soft sine with a little pitch arc, vibrato and breath */
function hoot(at: number, length: number, freq: number, fall: number) {
  const { ctx, master, noise } = audio();
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, at);
  out.gain.linearRampToValueAtTime(0.5, at + 0.045);
  out.gain.setValueAtTime(0.5, at + length * 0.6);
  out.gain.exponentialRampToValueAtTime(0.001, at + length + 0.12);
  out.connect(master);

  const tone = ctx.createOscillator();
  tone.type = "sine";
  tone.frequency.setValueAtTime(freq * 0.96, at);
  tone.frequency.linearRampToValueAtTime(freq * 1.03, at + length * 0.3);
  tone.frequency.linearRampToValueAtTime(freq * fall, at + length + 0.1);
  // A slow wobble in the throat
  const wobble = ctx.createOscillator();
  wobble.frequency.value = 6.5;
  const wobbleDepth = ctx.createGain();
  wobbleDepth.gain.value = freq * 0.012;
  wobble.connect(wobbleDepth).connect(tone.frequency);

  // A hollow overtone, and breath through a band-pass
  const overtone = ctx.createOscillator();
  overtone.type = "triangle";
  // Follows the same pitch arc, an octave up
  overtone.frequency.setValueAtTime(freq * 2 * 0.96, at);
  overtone.frequency.linearRampToValueAtTime(freq * 2 * 1.03, at + length * 0.3);
  overtone.frequency.linearRampToValueAtTime(freq * 2 * fall, at + length + 0.1);
  const overtoneGain = ctx.createGain();
  overtoneGain.gain.value = 0.08;
  const breath = ctx.createBufferSource();
  breath.buffer = noise;
  const breathBand = ctx.createBiquadFilter();
  breathBand.type = "bandpass";
  breathBand.frequency.value = freq * 2.2;
  breathBand.Q.value = 3;
  const breathGain = ctx.createGain();
  breathGain.gain.value = 0.06;

  tone.connect(out);
  overtone.connect(overtoneGain).connect(out);
  breath.connect(breathBand).connect(breathGain).connect(out);
  const end = at + length + 0.2;
  for (const node of [tone, wobble, overtone]) {
    node.start(at);
    node.stop(end);
  }
  breath.start(at, Math.random() * 0.5);
  breath.stop(end);
}

/** One wingbeat: a short band-passed rush of air with a soft thump */
function wingbeat(at: number, strength: number) {
  const { ctx, master, noise } = audio();
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.setValueAtTime(1500, at);
  band.frequency.exponentialRampToValueAtTime(500, at + 0.09);
  band.Q.value = 0.9;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(0.42 * strength, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.11);
  src.connect(band).connect(gain).connect(master);
  src.start(at, Math.random() * 0.8);
  src.stop(at + 0.14);

  const thump = ctx.createOscillator();
  thump.frequency.setValueAtTime(140, at);
  thump.frequency.exponentialRampToValueAtTime(60, at + 0.08);
  const thumpGain = ctx.createGain();
  thumpGain.gain.setValueAtTime(0.16 * strength, at);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, at + 0.09);
  thump.connect(thumpGain).connect(master);
  thump.start(at);
  thump.stop(at + 0.1);
}

/**
 * The clockwork venting: a servo whir and a run of ratchet ticks, then the
 * hiss of steam. `quiet` (the idle puffs) only plays once audio has already
 * been started by a click, and softer
 */
export function playVent({ strength = 1, quiet = false }: { strength?: number; quiet?: boolean } = {}) {
  if (quiet && (!ctx || ctx.state !== "running")) return;
  const { ctx: c, master, noise } = audio();
  const now = c.currentTime + 0.01;
  const level = (quiet ? 0.35 : 1) * strength;

  if (!quiet) {
    // Servo: a rising buzz through a low-pass
    const servo = c.createOscillator();
    servo.type = "sawtooth";
    servo.frequency.setValueAtTime(170, now);
    servo.frequency.exponentialRampToValueAtTime(430, now + 0.22);
    const servoLp = c.createBiquadFilter();
    servoLp.type = "lowpass";
    servoLp.frequency.value = 1200;
    const servoGain = c.createGain();
    servoGain.gain.setValueAtTime(0, now);
    servoGain.gain.linearRampToValueAtTime(0.05 * level, now + 0.03);
    servoGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    servo.connect(servoLp).connect(servoGain).connect(master);
    servo.start(now);
    servo.stop(now + 0.3);
    // Ratchet: short metallic ticks
    for (let i = 0; i < 5; i++) {
      const at = now + 0.04 + i * 0.038;
      const tick = c.createBufferSource();
      tick.buffer = noise;
      const band = c.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = 3200 + i * 180;
      band.Q.value = 9;
      const g = c.createGain();
      g.gain.setValueAtTime(0.5 * level, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.025);
      tick.connect(band).connect(g).connect(master);
      tick.start(at, Math.random() * 0.8);
      tick.stop(at + 0.03);
    }
  }

  // Steam: high-passed noise, a sharp start and a long tail
  const at = now + (quiet ? 0 : 0.2);
  const hiss = c.createBufferSource();
  hiss.buffer = noise;
  hiss.loop = true;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.setValueAtTime(3800, at);
  hp.frequency.exponentialRampToValueAtTime(1800, at + 0.7);
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(0.22 * level, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, at + 0.8);
  hiss.connect(hp).connect(g).connect(master);
  hiss.start(at, Math.random() * 0.5);
  hiss.stop(at + 0.85);
}

export interface OwlCall {
  // 1 for the guide; the smaller owls call higher
  pitch?: number;
  // Seconds from now at which the wings sweep open
  wingbeats?: number[];
}

/** "Hoo-hoo, hoooo", with a rush of air each time the wings open */
export function playOwlCall({ pitch = 1, wingbeats = [] }: OwlCall = {}) {
  const { ctx } = audio();
  const now = ctx.currentTime + 0.02;
  wingbeats.forEach((t, i) => wingbeat(now + t, 1 - i * 0.15));
  const f = 310 * pitch;
  const start = now + 0.25;
  hoot(start, 0.2, f, 0.95);
  hoot(start + 0.32, 0.16, f * 1.02, 0.95);
  hoot(start + 0.62, 0.48, f * 0.97, 0.88);
}
