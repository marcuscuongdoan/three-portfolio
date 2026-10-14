import { audio } from "@/components/owl-world/owlSound";

/**
 * Background music, generated with Web Audio like the owl's sounds (no audio
 * files): slow pad chords under a music-box melody that wanders the D major
 * pentatonic, all through a soft reverb. A small look-ahead scheduler queues
 * the notes; it pauses while the tab is hidden.
 */

const BEAT = 60 / 64;
const EIGHTH = BEAT / 2;
// Eighths per chord
const BAR = 16;
const LOOKAHEAD = 0.6;
const LEVEL = 0.5;

const CHORDS = [
  [50, 57, 64, 66, 69], // Dmaj9
  [47, 54, 62, 64, 66], // Bm11
  [43, 50, 57, 62, 66], // Gmaj7
  [45, 52, 57, 61, 64], // A
];
const SCALE = [62, 64, 66, 69, 71, 74, 76, 78, 81];

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

let bus: GainNode | null = null;
let wet: GainNode | null = null;
let timer: number | null = null;
let nextTime = 0;
let step = 0;
let note = 3;
let playing = false;

function graph() {
  const { ctx, master } = audio();
  if (!bus) {
    bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(master);
    // Reverb: a convolver over a few seconds of decaying noise
    const verb = ctx.createConvolver();
    const len = ctx.sampleRate * 3.2;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    verb.buffer = ir;
    wet = ctx.createGain();
    wet.gain.value = 0.55;
    wet.connect(verb).connect(bus);
  }
  return { ctx, bus, wet: wet! };
}

/** A chord's pad: detuned triangles through a low-pass, slow in and out */
function pad(at: number, notes: number[], length: number) {
  const { ctx, bus, wet } = graph();
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(700, at);
  lp.frequency.linearRampToValueAtTime(1300, at + length * 0.5);
  lp.frequency.linearRampToValueAtTime(700, at + length);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(0.05, at + 2.5);
  env.gain.setValueAtTime(0.05, at + length);
  env.gain.linearRampToValueAtTime(0, at + length + 3);
  lp.connect(env);
  env.connect(bus);
  env.connect(wet);
  const end = at + length + 3.1;
  for (const n of notes) {
    for (const cents of [-7, 7]) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = hz(n);
      osc.detune.value = cents;
      osc.connect(lp);
      osc.start(at);
      osc.stop(end);
    }
  }
  // A soft sine an octave under the root
  const bass = ctx.createOscillator();
  bass.frequency.value = hz(notes[0]! - 12);
  const bassGain = ctx.createGain();
  bassGain.gain.value = 1.4;
  bass.connect(bassGain).connect(env);
  bass.start(at);
  bass.stop(end);
}

/** One music-box note: a sine with two quickly fading partials */
function pluck(at: number, midi: number, velocity: number) {
  const { ctx, bus, wet } = graph();
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(0.09 * velocity, at + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, at + 2.4);
  env.connect(bus);
  env.connect(wet);
  for (const [mult, level, decay] of [
    [1, 1, 2.4],
    [2, 0.22, 0.6],
    [3, 0.08, 0.3],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.frequency.value = hz(midi) * mult;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    osc.connect(g).connect(env);
    osc.start(at);
    osc.stop(at + 2.5);
  }
}

function schedule() {
  const { ctx } = graph();
  while (nextTime < ctx.currentTime + LOOKAHEAD) {
    if (step % BAR === 0) pad(nextTime, CHORDS[(step / BAR) % CHORDS.length]!, BAR * EIGHTH);
    // Melody: mostly on the beat, a step or two at a time, with rests
    const onBeat = step % 2 === 0;
    if (Math.random() < (onBeat ? 0.5 : 0.18)) {
      note = Math.min(SCALE.length - 1, Math.max(0, note + Math.round((Math.random() - 0.5) * 4)));
      pluck(nextTime + (Math.random() - 0.5) * 0.02, SCALE[note]!, onBeat ? 1 : 0.7);
    }
    nextTime += EIGHTH;
    step++;
  }
}

function run() {
  if (timer !== null) return;
  const { ctx } = graph();
  nextTime = Math.max(nextTime, ctx.currentTime + 0.1);
  schedule();
  timer = window.setInterval(schedule, 150);
}

function halt() {
  if (timer !== null) window.clearInterval(timer);
  timer = null;
}

function onVisibility() {
  if (!playing) return;
  if (document.hidden) halt();
  else run();
}

/** Fade the music in (from a user gesture: browsers only start audio from one) */
export function startMusic() {
  if (playing) return;
  playing = true;
  const { ctx, bus } = graph();
  // A fresh start begins on the first chord
  if (timer === null && nextTime < ctx.currentTime) step = 0;
  bus.gain.cancelScheduledValues(ctx.currentTime);
  bus.gain.setTargetAtTime(LEVEL, ctx.currentTime, 0.8);
  document.addEventListener("visibilitychange", onVisibility);
  if (!document.hidden) run();
}

/** Fade the music out; notes already queued die away under the fade */
export function stopMusic() {
  if (!playing) return;
  playing = false;
  halt();
  document.removeEventListener("visibilitychange", onVisibility);
  if (!bus) return;
  const { ctx } = graph();
  bus.gain.cancelScheduledValues(ctx.currentTime);
  bus.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
}
