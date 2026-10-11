/**
 * Engine synthesis AudioWorklet (loaded from a Blob URL, so it ships with the
 * page instead of as a separate file). A small physical model, per sample:
 *
 * - The crank turns at `rpm`; each cylinder fires at its own crank angle in
 *   the 720° cycle. ~140° later its exhaust valve opens and a pressure pulse
 *   leaves: a sharp blowdown with a softer tail, shaped over crank angle (so
 *   it's longer and softer at idle, short and hard high up the revs — capped
 *   at ~30 ms, so it stays a puff while cranking), louder
 *   under throttle, a little different every time (combustion varies — more
 *   so at idle, for the lumpy tick-over).
 * - Each pulse runs down its own header pipe and the headers merge into the
 *   main pipe. Pipes are waveguides: a delay of the pipe's round trip with a
 *   damped, inverted reflection — they ring at their own pitch, which is what
 *   makes it sound like an exhaust rather than a buzzer.
 * - Intake noise follows each intake stroke; off the throttle at high revs
 *   the exhaust can crackle (afterfire).
 *
 * The muffler (lowpass), body resonance and grit are Web Audio nodes after
 * this one (see showroomAudio.ts).
 */
export const ENGINE_WORKLET = /* js */ `
const SPEED_OF_SOUND = 343;

class Pipe {
  constructor(metres) {
    const n = Math.max(2, Math.round((2 * metres / SPEED_OF_SOUND) * sampleRate));
    this.buffer = new Float32Array(n);
    this.i = 0;
    this.lp = 0;
  }
  // y = x + reflection × damped(y, one round trip ago)
  process(x, reflection, damping) {
    const back = this.buffer[this.i];
    this.lp += (back - this.lp) * damping;
    const y = x + reflection * this.lp;
    this.buffer[this.i] = y;
    this.i = (this.i + 1) % this.buffer.length;
    return y;
  }
}

class BikeEngine extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "rpm", defaultValue: 1000, minValue: 0, maxValue: 20000, automationRate: "k-rate" },
      { name: "throttle", defaultValue: 0.2, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "level", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      // 0 while cranking on the starter: compression puffs, no combustion
      { name: "firing", defaultValue: 1, minValue: 0, maxValue: 1, automationRate: "k-rate" },
    ];
  }

  constructor(options) {
    super();
    const o = options.processorOptions;
    this.angles = o.firing;
    this.n = o.firing.length;
    this.window = o.window;
    this.variability = o.variability;
    this.pops = o.pops;
    this.theta = 0;
    this.lastPhase = new Float32Array(this.n).fill(720);
    this.amp = new Float32Array(this.n).fill(1);
    this.headers = o.headers.map((m) => new Pipe(m));
    this.main = new Pipe(o.main);
    this.crack = 0;
    this.intakeLp = 0;
    this.intakeHp = 0;
  }

  process(_inputs, outputs, params) {
    const channels = outputs[0];
    const out = channels[0];
    if (!out) return true;
    const rpm = params.rpm[0];
    const throttle = params.throttle[0];
    const level = params.level[0];
    const firing = params.firing[0];
    const step = (rpm / 60) * 360 / sampleRate;
    // A pulse spans its crank window, but never more than ~30 ms: at
    // cranking speed a crank-angle pulse would be a sub-bass swell
    const W = Math.min(this.window, rpm * 6 * 0.03);
    // Cranking (no combustion) still pushes audible compression puffs
    const load = (0.3 + 0.7 * throttle) * (0.5 + 0.5 * firing);
    const spread = this.variability * (1.5 - throttle);

    for (let s = 0; s < out.length; s++) {
      this.theta = (this.theta + step) % 720;
      let collector = 0;
      let intake = 0;
      for (let c = 0; c < this.n; c++) {
        // Exhaust valve opens ~140° after the cylinder fires
        let ph = (this.theta - this.angles[c] - 140) % 720;
        if (ph < 0) ph += 720;
        if (ph < this.lastPhase[c]) {
          // A new exhaust event: how strong this firing was
          this.amp[c] = Math.max(0.15, 1 + (Math.random() * 2 - 1) * spread);
          if (this.pops && firing > 0.5 && throttle < 0.08 && rpm > 3500 && Math.random() < 0.07) {
            this.crack = 0.6 + Math.random() * 0.6;
          }
        }
        this.lastPhase[c] = ph;

        const noise = Math.random() * 2 - 1;
        let pulse = 0;
        if (ph < W) {
          const x = ph / W;
          pulse = (Math.exp(-x * 7) + 0.4 * Math.sin(Math.PI * x)) * (1 - x);
        }
        const ex = pulse * this.amp[c] * load * (0.8 + 0.4 * noise * pulse);
        collector += this.headers[c].process(ex, -0.55, 0.35);

        // Intake stroke ~360° after firing
        let ip = (this.theta - this.angles[c] - 360) % 720;
        if (ip < 0) ip += 720;
        if (ip < 200) intake += Math.sin((Math.PI * ip) / 200) * noise;
      }
      let y = this.main.process(collector / Math.sqrt(this.n), 0.45, 0.25);

      if (this.crack > 0.001) {
        y += this.crack * (Math.random() * 2 - 1) * 2;
        this.crack *= 0.9965;
      }
      // Intake: band-limited noise, a touch more with the throttle open
      this.intakeLp += (intake - this.intakeLp) * 0.08;
      this.intakeHp += (this.intakeLp - this.intakeHp) * 0.01;
      y += (this.intakeLp - this.intakeHp) * 0.22 * (0.3 + throttle);

      out[s] = y * level;
    }
    for (let ch = 1; ch < channels.length; ch++) channels[ch].set(out);
    return true;
  }
}

registerProcessor("bike-engine", BikeEngine);
`;
