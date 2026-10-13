import * as THREE from "three";

/**
 * Poses one owl model instance: the sitting clip, the procedural wingbeat and
 * a head that can turn. The model ships two clips and no flight cycle. Its
 * bind pose is a glide (body level, wings spread, facing -Z), so flight is the
 * bind pose with a flap on top; Emote is the sitting pose, held on its first
 * frame and played through now and then for a wing stretch. Where the owl is
 * and which way it faces is up to the caller.
 */

const EMOTE = "Emote";
const EMOTE_HOLD = 0.05;
const IDLE_STRETCH_EVERY: [number, number] = [9, 15];
// In the sitting pose the talons hang this far below the model's origin;
// lifting by it puts them on top of whatever the owl perches on
export const PERCH_LIFT = 0.155;

export const OWL_Z = new THREE.Vector3(0, 0, 1);
const OWL_Y = new THREE.Vector3(0, 1, 0);
const OWL_X = new THREE.Vector3(1, 0, 0);

const _rootInv = new THREE.Quaternion();
const _parent = new THREE.Quaternion();
const _r2 = new THREE.Quaternion();

/** Rotate `bone` by `r`, given in the owl's own (model root) frame */
function rotateInOwlSpace(bone: THREE.Object3D, root: THREE.Object3D, r: THREE.Quaternion) {
  const parent = bone.parent!;
  parent.updateWorldMatrix(true, false);
  root.getWorldQuaternion(_rootInv).invert();
  parent.getWorldQuaternion(_parent).premultiply(_rootInv);
  // local' = P⁻¹ · R · P · local
  _r2.copy(_parent).invert().multiply(r).multiply(_parent);
  bone.quaternion.premultiply(_r2);
}

const _v = new THREE.Vector3();
const _qi = new THREE.Quaternion();
const _ray = new THREE.Vector3();

/** The point under the pointer at the same distance from the camera as `near` */
export function pointerPoint(camera: THREE.Camera, pointer: THREE.Vector2, near: THREE.Vector3, out: THREE.Vector3) {
  _ray.set(pointer.x, pointer.y, 0.5).unproject(camera).sub(camera.position).normalize();
  return out.copy(camera.position).addScaledVector(_ray, camera.position.distanceTo(near));
}

/** Head yaw/pitch (radians, as PoseInput wants them) for an owl at `pos`/`quat` to look at `target` */
export function headAngles(pos: THREE.Vector3, quat: THREE.Quaternion, target: THREE.Vector3) {
  _v.subVectors(target, pos).applyQuaternion(_qi.copy(quat).invert());
  // The owl faces -Z; a positive yaw turns it toward -X
  return {
    yaw: THREE.MathUtils.clamp(Math.atan2(-_v.x, -_v.z), -1.1, 1.1),
    pitch: THREE.MathUtils.clamp(Math.atan2(_v.y, Math.hypot(_v.x, _v.z)), -0.5, 0.6),
  };
}

export interface PoseInput {
  // 0 flying … 1 sitting
  perch: number;
  // 0 cruising … 1 hovering in place (quicker, wider beats)
  hover: number;
  // 0 cruising … 1 flaring to land (slow, deep braking beats)
  land: number;
  // How fast the owl is going (any unit ~0..2), for wingbeat pace
  speed: number;
  // Head turn while sitting (radians: yaw toward the owl's -X, pitch up)
  lookYaw: number;
  lookPitch: number;
}

// --- Flight feel -----------------------------------------------------------
// Share of a wingbeat spent on the (powered) downstroke; the rest is the
// slower recovery upstroke, on which the wing folds
const DOWNSTROKE = 0.4;
// Folding on the upstroke, as a bird does: the elbow flexes, the wrist
// folds the hand back and lets it hang, roughly halving the span (rad)
const FOLD_ELBOW = 0.95;
const FOLD_WRIST = 1.1;
const HAND_DROOP = 0.75;
// Leading edge dips on the downstroke (rad)
const PRONATE = 0.14;
// Beats between glides, and how long a glide lasts (s)
const BEATS: [number, number] = [3, 7];
const GLIDE: [number, number] = [0.9, 2.2];
// Legs: tucked back in flight, reaching forward to take the perch (rad)
const LEG_TUCK = 0.95;
const LEG_REACH = 0.5;
// Tail: dips and fans to brake, rudders into turns
const TAIL_BRAKE = 0.65;
const TAIL_FAN = 0.55;

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const wrapPi = (a: number) => a - Math.round(a / (Math.PI * 2)) * Math.PI * 2;

const _q = new THREE.Quaternion();
const _qa = new THREE.Quaternion();
const _e = new THREE.Euler();

/** A one-off movement with a soft start and end: 0 → 1 → 0 over `length` s */
class Pulse {
  t = -1;
  length = 1;
  start(length: number) {
    this.t = 0;
    this.length = length;
  }
  step(dt: number) {
    if (this.t < 0) return 0;
    this.t += dt / this.length;
    if (this.t >= 1) {
      this.t = -1;
      return 0;
    }
    return Math.sin(Math.PI * this.t);
  }
  get running() {
    return this.t >= 0;
  }
}

export class OwlPoser {
  readonly root: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private emote: THREE.AnimationAction;
  private parts: THREE.AnimationAction[];
  private clipDuration: number;
  private wings: {
    sign: number;
    shoulder: THREE.Object3D;
    elbow: THREE.Object3D;
    wrist: THREE.Object3D;
    // Flight feathers: how much each gives to the air, and its place from
    // the body outward (the wave runs along this)
    feathers: { bone: THREE.Object3D; give: number; order: number }[];
  }[];
  private head: THREE.Object3D;
  private neck: THREE.Object3D;
  private chest: THREE.Object3D;
  private tail: THREE.Object3D;
  private tailFeathers: { bone: THREE.Object3D; sign: number; spread: number }[];
  private legs: THREE.Object3D[];
  private ears: { bone: THREE.Object3D; sign: number }[];
  private eyes: { bone: THREE.Object3D; base: THREE.Vector3 }[];
  private touched: THREE.Object3D[];
  private base: THREE.Quaternion[];
  private stretching = false;
  private nextStretch: number;
  phase: number;

  // Flight rhythm: flap ↔ glide
  private flapWeight = 1;
  private beatsLeft = 4;
  private gliding = 0;
  private lastCycle = 0;
  // Body attitude, from the root's own orientation
  private lastYaw: number | null = null;
  private turnRate = 0;
  private pitch = 0;
  private roll = 0;
  // Idle life while sitting
  private tilt = { value: 0, target: 0, timer: 2 };
  private shake = new Pulse();
  private shuffle = new Pulse();
  private blink = new Pulse();
  // The tail bobbing as the owl settles after touching down
  private settle = new Pulse();
  private wasSitting = true;
  private nextShake = rand(9, 18);
  private nextShuffle = rand(6, 14);
  private nextBlink = rand(1.5, 4);
  private time = 0;
  // Speed of the stretch now playing (a click plays it brisker)
  private stretchSpeed = 1;

  constructor(root: THREE.Object3D, animations: THREE.AnimationClip[], seed = 0) {
    this.root = root;
    this.mixer = new THREE.AnimationMixer(root);
    const clip = animations.find((a) => a.name === EMOTE)!;
    this.parts = [clip].map((c) => {
      const action = this.mixer.clipAction(c);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      return action;
    });
    this.emote = this.parts[0]!;
    this.clipDuration = clip.duration;
    this.phase = seed * 2.3;
    this.nextStretch = 6 + seed * 4;

    const bone = (name: string) => root.getObjectByName(name)!;
    root.updateMatrixWorld(true);
    // Which side of the body a bone is on, in the owl's own frame
    const sideOf = (b: THREE.Object3D) => Math.sign(root.worldToLocal(b.getWorldPosition(new THREE.Vector3())).x) || 1;
    // Arm feathers barely give; the hand's primaries bend the most
    const FEATHERS: [string, number][] = [
      ["featherMain_A", 0.08],
      ["featherMid_a", 0.1],
      ["featherMid_b", 0.11],
      ["featherMid_c", 0.12],
      ["featherMain_B", 0.14],
      ["featherMid_d", 0.16],
      ["featherMid_e", 0.18],
      ["featherMid_f", 0.2],
      ["featherMid_g", 0.26],
      ["featherMid_h", 0.3],
      ["featherMid_i", 0.34],
    ];
    this.wings = (["l", "r"] as const).map((s) => ({
      sign: sideOf(bone(`wrist_${s}`)),
      shoulder: bone(`shoulder_${s}`),
      elbow: bone(`elbow_${s}`),
      wrist: bone(`wrist_${s}`),
      feathers: FEATHERS.map(([name, give], order) => ({ bone: bone(`${name}_${s}`), give, order })),
    }));
    this.head = bone("head");
    this.neck = bone("neck");
    this.chest = bone("chest");
    this.tail = bone("tail");
    // Outer tail feathers fan furthest
    const spreadOf: Record<string, number> = { a: 0.45, b: 0.7, c: 1, main: 0.25 };
    this.tailFeathers = (["a", "b", "c", "main"] as const).flatMap((k) =>
      (["l", "r"] as const).map((s) => {
        const b = bone(`tailFeather_${k}_${s}`);
        return { bone: b, sign: sideOf(b), spread: spreadOf[k]! };
      }),
    );
    this.legs = [bone("upleg_l"), bone("upleg_r")];
    this.ears = (["l", "r"] as const).map((s) => ({ bone: bone(`ear_${s}`), sign: sideOf(bone(`ear_${s}`)) }));
    this.eyes = ["eye_l", "eye_r", "pupil_l", "pupil_r"].map((n) => ({ bone: bone(n), base: bone(n).scale.clone() }));
    // Bones edited after the mixer; their pre-edit values are put back before
    // the next mixer update (it skips writing values that didn't change)
    this.touched = [
      this.chest,
      this.neck,
      this.head,
      this.tail,
      ...this.tailFeathers.map((f) => f.bone),
      ...this.legs,
      ...this.ears.map((e) => e.bone),
      ...this.wings.flatMap((w) => [w.shoulder, w.elbow, w.wrist, ...w.feathers.map((f) => f.bone)]),
    ];
    this.base = this.touched.map((b) => b.quaternion.clone());
  }

  /** Play the wing stretch now (if sitting); `speed` > 1 plays it brisker */
  stretch(speed = 1) {
    if (this.stretching) return false;
    this.nextStretch = 0;
    this.stretchSpeed = speed;
    return true;
  }



  private setParts(fn: (a: THREE.AnimationAction) => void) {
    this.parts.forEach(fn);
  }

  /** Rotate a bone about one of the owl's own axes */
  private turn(bone: THREE.Object3D, axis: THREE.Vector3, angle: number) {
    if (Math.abs(angle) < 1e-4) return;
    rotateInOwlSpace(bone, this.root, _qa.setFromAxisAngle(axis, angle));
  }

  /** Pitch, roll and turn rate of the body, from the root's world orientation */
  private readAttitude(dt: number) {
    this.root.getWorldQuaternion(_q);
    _e.setFromQuaternion(_q, "YXZ");
    const yawRate = this.lastYaw === null ? 0 : wrapPi(_e.y - this.lastYaw) / Math.max(dt, 1e-3);
    this.lastYaw = _e.y;
    const k = 1 - Math.exp(-dt * 5);
    this.turnRate += (THREE.MathUtils.clamp(yawRate, -3, 3) - this.turnRate) * k;
    this.pitch += (_e.x - this.pitch) * k;
    this.roll += (_e.z - this.roll) * k;
  }

  /** Pose for this frame; returns the height offset to add to the owl's position */
  update(dt: number, p: PoseInput) {
    const { emote } = this;
    const fly = 1 - p.perch;
    const sit = p.perch;
    this.time += dt;
    this.readAttitude(dt);


    // (Re)start the held sitting pose — also after a StrictMode remount
    if (!emote.isScheduled()) this.setParts((a) => {
      a.reset().play();
      a.paused = true;
      a.time = EMOTE_HOLD;
    });
    // Sitting: hold the folded frame, now and then play the stretch
    for (const part of this.parts) part.setEffectiveWeight(sit);
    if (sit > 0.98 && !this.stretching) {
      this.nextStretch -= dt;
      if (this.nextStretch <= 0) {
        this.stretching = true;
        const speed = this.stretchSpeed;
        this.setParts((a) => {
          a.paused = false;
          a.time = EMOTE_HOLD;
          a.timeScale = speed;
        });
      }
    }
    if (this.stretching && (emote.time >= this.clipDuration - 0.02 || sit < 0.5)) {
      this.stretching = false;
      this.stretchSpeed = 1;
      this.setParts((a) => {
        a.paused = true;
        a.time = EMOTE_HOLD;
        a.timeScale = 1;
      });
      const [lo, hi] = IDLE_STRETCH_EVERY;
      this.nextStretch = lo + Math.random() * (hi - lo);
    }

    this.touched.forEach((b, i) => b.quaternion.copy(this.base[i]!));
    this.mixer.update(dt);
    this.touched.forEach((b, i) => this.base[i]!.copy(b.quaternion));

    // --- Rhythm: a few beats, then a glide (longer when descending) --------
    const cruising = fly > 0.9 && p.hover < 0.3 && p.land < 0.05;
    const cruiseFreq = THREE.MathUtils.lerp(2.1, 3.1, p.hover) + Math.min(1.2, p.speed * 0.9);
    const freq = THREE.MathUtils.lerp(cruiseFreq, 1.5, p.land);
    if (this.gliding > 0) {
      this.gliding -= dt;
      if (!cruising) this.gliding = 0;
      if (this.gliding <= 0) this.beatsLeft = Math.round(rand(...BEATS));
    } else {
      this.phase += dt * freq * Math.PI * 2;
      const cycle = Math.floor(this.phase / (Math.PI * 2));
      if (cycle !== this.lastCycle) {
        this.lastCycle = cycle;
        this.beatsLeft--;
        if (this.beatsLeft <= 0 && cruising) this.gliding = rand(...GLIDE) * (this.pitch < -0.12 ? 1.6 : 1);
        if (this.beatsLeft <= 0 && !cruising) this.beatsLeft = Math.round(rand(...BEATS));
      }
    }
    this.flapWeight = THREE.MathUtils.damp(this.flapWeight, this.gliding > 0 ? 0 : 1, 6, dt);

    // --- Wingbeat: a wave down the wing, not a plank -----------------------
    // The shoulder leads; the forearm follows a beat later and the hand later
    // still, so every stroke curves through the wing and the tip whips. The
    // upstroke folds the hand in and down (the "M" shape); the flight
    // feathers bend against the air, the outer ones last.
    const amp = fly * THREE.MathUtils.lerp(THREE.MathUtils.lerp(0.5, 0.72, p.hover), 0.95, p.land) * this.flapWeight;
    // Gliding wings hold a little raised and ride the air
    const glideHold = fly * (1 - this.flapWeight) * (0.16 + Math.sin(this.time * 1.7) * 0.03);
    // A slight dihedral so the downstroke doesn't sweep below the body
    const dihedral = fly * 0.12;
    // Wing shuffle while sitting: a quick lift and settle
    const shuffle = this.shuffle.step(dt) * sit;
    const phi = this.phase;
    const beatAmp = amp;
    const base = glideHold + dihedral;
    const foldReach = fly;

    // u: 0..1 through the beat; s: +1 wings up … -1 wings down
    const u = (((phi / (Math.PI * 2)) % 1) + 1) % 1;
    const down = u < DOWNSTROKE;
    const s = down ? Math.cos((Math.PI * u) / DOWNSTROKE) : -Math.cos((Math.PI * (u - DOWNSTROKE)) / (1 - DOWNSTROKE));
    // Folded through the upstroke and opened out again just before the top,
    // so the next downstroke starts on a fully spread wing
    const fold = down ? 0 : Math.sin(Math.PI * THREE.MathUtils.clamp((u - DOWNSTROKE) / (0.92 - DOWNSTROKE), 0, 1)) * (beatAmp > 0.01 ? 1 : 0);
    const pronate = down ? Math.sin((Math.PI * u) / DOWNSTROKE) : 0;
    // How hard the wing is working, 0..1, for the bends below
    const work = THREE.MathUtils.clamp(beatAmp / 0.6, 0, 1);

    for (const w of this.wings) {
      const side = w.sign;
      // Shoulder: the stroke itself (about the owl's forward axis), the
      // leading edge dipping on the way down
      this.turn(w.shoulder, OWL_Z, (s * beatAmp + base + shuffle * 0.22) * side);
      this.turn(w.shoulder, OWL_X, -PRONATE * pronate * beatAmp);
      // Downstroke: the wing is held straight and open, the tip trailing a
      // touch. Upstroke: the elbow flexes and the hand folds back and hangs,
      // so the wing comes up short and opens out again at the top
      this.turn(w.elbow, OWL_Z, (Math.sin(phi - 1.2) * beatAmp * 0.2 - fold * 0.3 * work + dihedral * 0.4) * side);
      this.turn(w.elbow, OWL_Y, -FOLD_ELBOW * fold * work * foldReach * side);
      this.turn(w.wrist, OWL_Z, (Math.sin(phi - 1.8) * beatAmp * 0.3 - fold * HAND_DROOP * work) * side);
      this.turn(w.wrist, OWL_Y, -FOLD_WRIST * fold * work * foldReach * side);
      // Flight feathers: bent up by the air on the downstroke and down on the
      // upstroke, each a little after the one inside it; fanned open on the
      // downstroke, closed up on the upstroke
      w.feathers.forEach(({ bone, give, order }) => {
        this.turn(bone, OWL_Z, Math.sin(phi - 2.3 - order * 0.28) * beatAmp * give * side);
        this.turn(bone, OWL_Y, (pronate - fold * 0.6) * order * 0.035 * work * side);
      });
    }

    // --- Body: bobs against the wings; shakes now and then when sitting ----
    this.turn(this.chest, OWL_X, -s * amp * 0.12);
    if (sit > 0.98 && !this.stretching) {
      this.nextShake -= dt;
      if (this.nextShake <= 0 && !this.shake.running) {
        this.shake.start(0.7);
        this.nextShake = rand(12, 24);
      }
      this.nextShuffle -= dt;
      if (this.nextShuffle <= 0 && !this.shuffle.running) {
        this.shuffle.start(0.6);
        this.nextShuffle = rand(8, 16);
      }
    }
    const shake = this.shake.step(dt) * Math.sin(this.time * 38) * sit;
    this.turn(this.chest, OWL_Y, shake * 0.09);

    // --- Tail: rudders into turns, dips and fans to brake ------------------
    // It pumps against each wingbeat (a beat behind it), sways and twists on
    // the air while gliding, and when landing dips and fans wide, working up
    // and down to balance; after touchdown it bobs a few times and settles
    const nowSitting = sit > 0.95;
    if (nowSitting && !this.wasSitting) this.settle.start(1.1);
    this.wasSitting = nowSitting;
    const settle = this.settle.step(dt);
    const brake = Math.max(p.land, p.hover * 0.5) * fly;
    const glide = fly * (1 - this.flapWeight);
    const pump = Math.sin(phi - 2.6) * amp * 0.24;
    const balance = Math.sin(this.time * 7.5) * 0.14 * p.land * fly;
    const bobDown = Math.sin(this.time * 13) * 0.22 * settle;
    const sway = Math.sin(this.time * 1.3) * 0.13 * glide + Math.sin(this.time * 2.9 + 1) * 0.04 * fly;
    this.turn(this.tail, OWL_X, TAIL_BRAKE * brake - s * amp * 0.06 + pump + balance + bobDown);
    this.turn(this.tail, OWL_Y, THREE.MathUtils.clamp(-this.turnRate * 0.18, -0.35, 0.35) * fly + sway);
    this.turn(this.tail, OWL_Z, THREE.MathUtils.clamp(-this.roll * 0.4, -0.3, 0.3) * fly + Math.sin(this.time * 0.9) * 0.07 * glide);
    // Fanned to brake, opening and closing a little with each beat; the
    // feathers flutter in the wind, the outer ones most
    const fan = (TAIL_FAN * brake + 0.08 * fly + 0.18 * settle) * (1 + shake * 0.5) + Math.max(0, -s) * amp * 0.12;
    for (const f of this.tailFeathers) {
      this.turn(f.bone, OWL_Y, fan * f.spread * f.sign);
      this.turn(f.bone, OWL_X, Math.sin(this.time * 11 + f.spread * 4 + f.sign) * 0.05 * f.spread * fly * (0.4 + p.speed * 0.4));
    }

    // --- Legs: tucked back in flight, reaching for the perch on approach ---
    const reach = p.land * (1 - sit);
    for (const leg of this.legs) this.turn(leg, OWL_X, (-LEG_TUCK * fly * (1 - p.land) + LEG_REACH * reach) * (1 - sit));

    // --- Head: level and looking into turns in flight; curious when sitting
    this.tilt.timer -= dt;
    if (this.tilt.timer <= 0) {
      // An owl's head tilt: often, briefly, either way
      this.tilt.target = this.tilt.target === 0 && Math.random() < 0.6 ? rand(0.18, 0.38) * (Math.random() < 0.5 ? -1 : 1) : 0;
      this.tilt.timer = this.tilt.target === 0 ? rand(2, 6) : rand(0.8, 2);
    }
    this.tilt.value = THREE.MathUtils.damp(this.tilt.value, this.tilt.target, 5, dt);
    // Flying: undo most of the body's roll and pitch so the head stays level
    this.turn(this.neck, OWL_Z, -this.roll * 0.75 * fly);
    this.turn(this.neck, OWL_X, -THREE.MathUtils.clamp(this.pitch, -0.8, 0.8) * 0.55 * fly);
    this.turn(this.neck, OWL_Y, THREE.MathUtils.clamp(this.turnRate * 0.3, -0.5, 0.5) * fly);
    // Sitting: watch the pointer (from the caller), tilt now and then, shake
    if (sit > 0.01) {
      this.turn(this.head, OWL_Y, (p.lookYaw + shake * 0.15) * sit);
      this.turn(this.head, OWL_X, p.lookPitch * sit);
      this.turn(this.head, OWL_Z, this.tilt.value * sit);
    }
    // Ears prick up a little when the head tilts or turns
    const prick = (Math.abs(this.tilt.value) * 0.6 + Math.abs(p.lookYaw) * 0.15) * sit;
    for (const ear of this.ears) this.turn(ear.bone, OWL_Z, prick * 0.5 * ear.sign);

    // --- Blink: the eyes shrink shut for a moment, every few seconds -------
    this.nextBlink -= dt;
    if (this.nextBlink <= 0 && !this.blink.running) {
      this.blink.start(0.16);
      this.nextBlink = Math.random() < 0.2 ? 0.25 : rand(2.5, 6); // sometimes a double blink
    }
    const shut = 1 - this.blink.step(dt) * 0.85;
    for (const eye of this.eyes) eye.bone.scale.copy(eye.base).multiplyScalar(shut);

    // The body rises on the downstroke; the talons come down onto the perch
    // over the approach, not at touchdown
    return -s * amp * 0.05 * (1 - p.land) + PERCH_LIFT * Math.max(sit, p.land);
  }

  dispose() {
    this.mixer.stopAllAction();
  }
}
