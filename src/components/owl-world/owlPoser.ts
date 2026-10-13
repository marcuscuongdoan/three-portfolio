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

// Wing chain, inner to outer: [bone base name, share of the flap, phase lag]
const WING_CHAIN: [string, number, number][] = [
  ["shoulder", 1, 0],
  ["elbow", 0.55, 0.65],
  ["wrist", 0.4, 1.2],
];

export const OWL_Z = new THREE.Vector3(0, 0, 1);
const OWL_Y = new THREE.Vector3(0, 1, 0);
const OWL_X = new THREE.Vector3(1, 0, 0);

const _rootInv = new THREE.Quaternion();
const _parent = new THREE.Quaternion();
const _r = new THREE.Quaternion();
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

export class OwlPoser {
  readonly root: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private emote: THREE.AnimationAction;
  private clipDuration: number;
  private wings: { sign: number; bones: { bone: THREE.Object3D; share: number; lag: number }[] }[];
  private head: THREE.Object3D;
  private touched: THREE.Object3D[];
  private base: THREE.Quaternion[];
  private stretching = false;
  private nextStretch: number;
  phase: number;

  constructor(root: THREE.Object3D, animations: THREE.AnimationClip[], seed = 0) {
    this.root = root;
    this.mixer = new THREE.AnimationMixer(root);
    const clip = animations.find((a) => a.name === EMOTE)!;
    this.emote = this.mixer.clipAction(clip);
    this.emote.setLoop(THREE.LoopOnce, 1);
    this.emote.clampWhenFinished = true;
    this.clipDuration = clip.duration;
    this.phase = seed * 2.3;
    this.nextStretch = 6 + seed * 4;

    const bone = (name: string) => root.getObjectByName(name)!;
    // Which wing is on +X decides the sign that lifts it
    root.updateMatrixWorld(true);
    this.wings = (["l", "r"] as const).map((side) => {
      const wrist = bone(`wrist_${side}`);
      const sign = Math.sign(root.worldToLocal(wrist.getWorldPosition(new THREE.Vector3())).x) || 1;
      return { sign, bones: WING_CHAIN.map(([n, share, lag]) => ({ bone: bone(`${n}_${side}`), share, lag })) };
    });
    this.head = bone("head");
    // Bones edited after the mixer; their pre-edit values are put back before
    // the next mixer update (it skips writing values that didn't change)
    this.touched = [this.head, ...this.wings.flatMap((w) => w.bones.map((b) => b.bone))];
    this.base = this.touched.map((b) => b.quaternion.clone());
  }

  /** Play the wing stretch now (if sitting) */
  stretch() {
    this.nextStretch = 0;
  }

  /** Pose for this frame; returns the height offset to add to the owl's position */
  update(dt: number, p: PoseInput) {
    const { emote } = this;
    const fly = 1 - p.perch;

    // (Re)start the held sitting pose — also after a StrictMode remount
    if (!emote.isScheduled()) {
      emote.reset().play();
      emote.paused = true;
      emote.time = EMOTE_HOLD;
    }
    // Sitting: hold the folded frame, now and then play the stretch
    emote.setEffectiveWeight(p.perch);
    if (p.perch > 0.98 && !this.stretching) {
      this.nextStretch -= dt;
      if (this.nextStretch <= 0) {
        this.stretching = true;
        emote.paused = false;
        emote.time = EMOTE_HOLD;
      }
    }
    if (this.stretching && (emote.time >= this.clipDuration - 0.02 || p.perch < 0.5)) {
      this.stretching = false;
      emote.paused = true;
      emote.time = EMOTE_HOLD;
      const [lo, hi] = IDLE_STRETCH_EVERY;
      this.nextStretch = lo + Math.random() * (hi - lo);
    }

    this.touched.forEach((b, i) => b.quaternion.copy(this.base[i]!));
    this.mixer.update(dt);
    this.touched.forEach((b, i) => this.base[i]!.copy(b.quaternion));

    // Flap: faster and wider when hovering, calmer in a cruise, slow deep
    // braking beats when flaring to land
    const cruiseFreq = THREE.MathUtils.lerp(2.1, 3.1, p.hover) + Math.min(1.2, p.speed * 0.9);
    const freq = THREE.MathUtils.lerp(cruiseFreq, 1.5, p.land);
    this.phase += dt * freq * Math.PI * 2;
    const amp = fly * THREE.MathUtils.lerp(THREE.MathUtils.lerp(0.5, 0.72, p.hover), 0.95, p.land);
    // A slight dihedral so the downstroke doesn't sweep below the body
    const lift = fly * 0.12;
    for (const w of this.wings) {
      for (const { bone, share, lag } of w.bones) {
        const a = (Math.sin(this.phase - lag) * amp + lift) * share * w.sign;
        if (Math.abs(a) < 1e-4) continue;
        _r.setFromAxisAngle(OWL_Z, a);
        rotateInOwlSpace(bone, this.root, _r);
      }
    }

    if (p.perch > 0.01 && (p.lookYaw !== 0 || p.lookPitch !== 0)) {
      _r.setFromAxisAngle(OWL_Y, p.lookYaw * p.perch);
      _r2.setFromAxisAngle(OWL_X, p.lookPitch * p.perch);
      _r.multiply(_r2);
      rotateInOwlSpace(this.head, this.root, _r);
    }

    // The body rises on the downstroke; the talons come down onto the perch
    // over the approach, not at touchdown
    return Math.cos(this.phase) * 0.035 * fly * (1 - p.land) + PERCH_LIFT * Math.max(p.perch, p.land);
  }

  dispose() {
    this.mixer.stopAllAction();
  }
}
