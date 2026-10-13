"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ThreeEvent, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { CLICK_STRETCH_SPEED, clickWingbeats, OWL_URL } from "@/components/owl-world/Owl";
import { headAngles, OwlPoser, pointerPoint } from "@/components/owl-world/owlPoser";
import { playOwlCall } from "@/components/owl-world/owlSound";
import { usePointerCursor } from "@/components/owl-world/Corridor";
import { LAST_STOP, MUSEUM_CENTER, MUSEUM_RADIUS, MUSEUM_WALL_STEP, STOP_INDEX } from "@/components/owl-world/flightPath";
import { HOUSE_POSITION, HOUSE_YAW } from "@/components/owl-world/HomeGrounds";
import { MUSEUM_WALL_TOP } from "@/components/owl-world/Museum";
import { flight, guide } from "@/components/owl-world/owlStore";

/**
 * Two smaller owls that keep the guide company. They sit on the cottage at
 * home, fly off when the tour starts, catch up with the guide for the flight
 * past the apps (flying either side of it), and land on the museum walls.
 * Past the museum they leave again until the guide is home.
 */

type Place = "home" | "museum" | "escort" | "away";

/** Which place the companions belong at for this scroll progress */
function placeAt(p: number): Place {
  if (p < 0.12 || p > LAST_STOP - 0.12) return "home";
  if (Math.abs(p - STOP_INDEX.museum) < 0.45) return "museum";
  if (p >= STOP_INDEX.web - 0.5 && p < STOP_INDEX.museum - 0.45) return "escort";
  return "away";
}

// Formation slots in the guide's frame: [right, up, forward] metres
const ESCORT_SLOTS: [number, number, number][] = [
  [-1.15, 0.3, 0.9],
  [1.2, -0.1, 0.6],
];
// How quickly they settle into their slot (1/s). Only the offset from the
// guide is eased, so however fast the guide flies they keep up with it
const ESCORT_FOLLOW = 1.6;
// Seconds of a still pointer before the companions go back to glancing about
const POINTER_IDLE = 5;

interface Spot {
  pos: THREE.Vector3;
  // Heading while sitting (0 faces -Z, π faces +Z)
  yaw: number;
  // Where it flies off to (and comes in from), out of shot
  away: THREE.Vector3;
}

const UP = new THREE.Vector3(0, 1, 0);
const HOME_CAMERA = new THREE.Vector3(0.9, 3.2, 2.6);
const yawToward = (from: THREE.Vector3, to: THREE.Vector3) => Math.atan2(-(to.x - from.x), -(to.z - from.z));

const houseToWorld = (x: number, y: number, z: number) =>
  new THREE.Vector3(x, y, z).applyAxisAngle(UP, HOUSE_YAW).add(HOUSE_POSITION);

function homeSpot(local: [number, number, number], away: [number, number, number]): Spot {
  const pos = houseToWorld(...local);
  return { pos, yaw: yawToward(pos, HOME_CAMERA), away: new THREE.Vector3(...away).add(pos) };
}

function wallSpot(wall: -1 | 1): Spot {
  const theta = wall * MUSEUM_WALL_STEP;
  const out = new THREE.Vector3(Math.sin(theta), 0, -Math.cos(theta));
  const pos = MUSEUM_CENTER.clone().setY(MUSEUM_WALL_TOP).addScaledVector(out, MUSEUM_RADIUS);
  // Face into the museum, toward the pedestal and the camera behind it
  return { pos, yaw: Math.PI - theta, away: pos.clone().addScaledVector(out, 26).add(new THREE.Vector3(wall * 8, 14, 0)) };
}

// One spot per companion in each place
const SPOTS: Record<"home" | "museum", [Spot, Spot]> = {
  home: [
    // On the little porch roof over the door, and on top of the garden lantern
    homeSpot([0.35, 3.06, 3.46], [-6, 15, -30]),
    homeSpot([-2.6, 2.6, 5.2], [8, 14, -32]),
  ],
  museum: [wallSpot(-1), wallSpot(1)],
};

const SCALES = [0.95, 0.85];
// The second owl follows the first a beat later
const STAGGER = 0.45;
const TAKEOFF = 0.12;
const FLARE = 0.3;
const SETTLE = 0.1;

const _tan = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qYaw = new THREE.Quaternion();
const _flare = new THREE.Quaternion();
const _ORIGIN = new THREE.Vector3();
const _X = new THREE.Vector3(1, 0, 0);
const _Z = new THREE.Vector3(0, 0, 1);
const _fwd = new THREE.Vector3();
const _side = new THREE.Vector3();
const _target = new THREE.Vector3();
const _acc = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _head = new THREE.Vector3();
const _pointerAt = new THREE.Vector3();
const _guideVel = new THREE.Vector3();
const _lastGuide = new THREE.Vector3();
const _lastPointer = new THREE.Vector2();

class Companion {
  readonly root: THREE.Object3D;
  private poser: OwlPoser;
  private scale: number;
  private index: number;
  private place: Place | null = null;
  private mode: "perched" | "flying" | "escort" | "away" = "away";
  // Offset from the guide while flying with it, and how fast that changes
  private rel = new THREE.Vector3();
  private relVel = new THREE.Vector3();
  private escortClock = 0;
  private from = new THREE.Vector3();
  private ctrl = new THREE.Vector3();
  private to = new THREE.Vector3();
  private fromYaw = 0;
  private toYaw = 0;
  private landing = false;
  private taking = false;
  private t = 0;
  private duration = 1;
  private delay = 0;
  private look = { yaw: 0, pitch: 0, target: 0, timer: 0 };

  constructor(model: THREE.Object3D, animations: THREE.AnimationClip[], index: number) {
    this.index = index;
    this.scale = SCALES[index]!;
    this.root = new THREE.Group();
    this.root.add(model);
    this.root.scale.setScalar(this.scale);
    this.poser = new OwlPoser(model, animations, index + 1);
    // An easy target round the body for clicks
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.36, 12, 10),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
    );
    hit.position.y = 0.02;
    hit.userData.noShadow = true;
    this.root.add(hit);
  }

  get sitting() {
    return this.mode === "perched" && this.root.visible;
  }

  /** Clicked: stretch its wings and call, if it's sitting. Returns whether it did */
  startle() {
    if (!this.sitting) return false;
    return this.poser.stretch(CLICK_STRETCH_SPEED);
  }

  private spotFor(place: Place) {
    return place === "home" || place === "museum" ? SPOTS[place][this.index]! : null;
  }

  /** Join the guide's formation; from out of shot if it was away */
  private startEscort() {
    if (this.mode === "away" || !this.root.visible) {
      // Swoop in from behind and above the chase camera
      _fwd.set(0, 0, -1).applyQuaternion(guide.quat).setY(0).normalize();
      this.rel.copy(_fwd).multiplyScalar(-12 - this.index * 3).addScaledVector(UP, 5);
    } else {
      this.rel.subVectors(this.root.position, guide.pos);
    }
    this.relVel.set(0, 0, 0);
    this.mode = "escort";
    this.root.visible = true;
  }

  private updateEscort(dt: number, guideVel: THREE.Vector3) {
    this.escortClock += dt;
    const [r, u, f] = ESCORT_SLOTS[this.index]!;
    _fwd.set(0, 0, -1).applyQuaternion(guide.quat).setY(0).normalize();
    _side.crossVectors(_fwd, UP).normalize();
    // Its slot, drifting a little so the three never fly in lockstep
    const t = this.escortClock + this.index * 2.1;
    _target
      .set(0, 0, 0)
      .addScaledVector(_side, r + Math.sin(t * 0.6) * 0.3)
      .addScaledVector(UP, u + Math.sin(t * 0.9) * 0.22)
      .addScaledVector(_fwd, f + Math.sin(t * 0.45) * 0.35);
    // Critically damped ease of the offset toward the slot
    _acc.subVectors(_target, this.rel).multiplyScalar(ESCORT_FOLLOW * ESCORT_FOLLOW).addScaledVector(this.relVel, -2 * ESCORT_FOLLOW);
    this.relVel.addScaledVector(_acc, dt);
    this.rel.addScaledVector(this.relVel, dt);
    this.root.position.copy(guide.pos).add(this.rel);

    // Face where it's going, or the guide's way when nearly still; bank into
    // sideways pulls
    _dir.addVectors(guideVel, this.relVel);
    const speed = _dir.length();
    if (speed < 0.4) _dir.copy(_fwd);
    _m.lookAt(_ORIGIN, _dir, UP);
    _q.setFromRotationMatrix(_m);
    const bank = THREE.MathUtils.clamp(-_acc.dot(_side) * 0.06, -0.5, 0.5);
    _q.multiply(_flare.setFromAxisAngle(_Z, bank));
    this.root.quaternion.slerp(_q, 1 - Math.exp(-dt * 5));
    return speed;
  }

  private startFlight(target: Place) {
    const leaving = this.spotFor(this.place ?? "away");
    const arriving = this.spotFor(target);
    this.from.copy(this.root.position);
    this.fromYaw = this.mode === "perched" && leaving ? leaving.yaw : this.toYaw;
    this.taking = this.mode === "perched";
    if (this.mode === "away") {
      // Come in from out of shot near the destination
      this.from.copy(arriving!.away);
    }
    if (arriving) {
      this.to.copy(arriving.pos);
      this.toYaw = arriving.yaw;
      this.landing = true;
    } else {
      this.to.copy(leaving ? leaving.away : this.root.position.clone().add(new THREE.Vector3(0, 15, -25)));
      this.landing = false;
    }
    const dist = this.from.distanceTo(this.to);
    // Arc: climb out of a perch, drop into one
    this.ctrl.lerpVectors(this.from, this.to, 0.5).addScaledVector(UP, Math.max(2, dist * 0.18));
    this.duration = THREE.MathUtils.clamp(dist / 8, 2.4, 5.5);
    this.delay = this.index * STAGGER;
    this.t = 0;
    this.mode = "flying";
    this.root.visible = true;
  }

  private snapTo(place: Place) {
    const spot = this.spotFor(place);
    if (spot) {
      this.to.copy(spot.pos);
      this.toYaw = spot.yaw;
      this.mode = "perched";
      this.root.visible = true;
    } else {
      this.mode = "away";
      this.root.visible = false;
    }
  }

  update(dt: number, place: Place, guideVel: THREE.Vector3, pointer: THREE.Vector3 | null) {
    if (this.place === null) {
      // First frame: just be there
      this.snapTo(place);
      this.place = place;
    } else if (place !== this.place) {
      if (place === "escort") this.startEscort();
      else this.startFlight(place);
      this.place = place;
    }

    let perch = 0;
    let land = 0;
    let speed = 0;
    if (this.mode === "flying" && this.delay > 0) {
      // Waiting its turn: still sitting, or still out of sight
      this.delay -= dt;
      if (this.taking) {
        perch = 1;
        this.root.quaternion.setFromAxisAngle(UP, this.fromYaw);
      } else this.root.visible = false;
    } else if (this.mode === "flying") {
      this.root.visible = true;
      this.t = Math.min(1, this.t + dt / this.duration);
      const e = THREE.MathUtils.smootherstep(this.t, 0, 1);
      bezier(this.from, this.ctrl, this.to, e, this.root.position);
      bezierTangent(this.from, this.ctrl, this.to, Math.min(e, 0.995), _tan);
      speed = 1.2 * Math.sin(Math.PI * this.t);
      // Nose along the flight line (the model faces -Z)
      _m.lookAt(_ORIGIN, _tan, UP);
      this.root.quaternion.setFromRotationMatrix(_m);

      // Leaving a perch: unfold and turn onto the flight line
      if (this.taking && this.t < TAKEOFF * 2) {
        const k = THREE.MathUtils.smoothstep(this.t, 0, TAKEOFF * 2);
        _q.copy(this.root.quaternion);
        this.root.quaternion.slerpQuaternions(_qYaw.setFromAxisAngle(UP, this.fromYaw), _q, k);
        perch = 1 - THREE.MathUtils.smoothstep(this.t, 0, TAKEOFF);
      }
      // Coming in to a perch: flare, turn to face out, fold
      if (this.landing && this.t > 1 - FLARE) {
        land = THREE.MathUtils.smoothstep(this.t, 1 - FLARE, 1 - SETTLE);
        perch = THREE.MathUtils.smoothstep(this.t, 1 - SETTLE, 1);
        this.root.quaternion.slerp(_qYaw.setFromAxisAngle(UP, this.toYaw), land);
        this.root.quaternion.multiply(_flare.setFromAxisAngle(_X, 0.9 * land * (1 - perch)));
      }
      if (this.t >= 1) {
        this.mode = this.landing ? "perched" : "away";
        this.root.visible = this.landing;
      }
    }
    if (this.mode === "escort") speed = this.updateEscort(dt, guideVel) / 6;
    if (this.mode === "perched") {
      perch = 1;
      this.root.position.copy(this.to);
      this.root.quaternion.setFromAxisAngle(UP, this.toYaw);
    }
    if (!this.root.visible) return;

    // Sitting owls watch the pointer; once it has been still a while they go
    // back to glancing about on their own
    let wantYaw = this.look.target;
    let wantPitch = 0;
    if (pointer) {
      _head.copy(this.root.position).setY(this.root.position.y + 0.3 * this.scale);
      const a = headAngles(_head, this.root.quaternion, pointer);
      wantYaw = a.yaw;
      wantPitch = a.pitch;
    } else {
      this.look.timer -= dt;
      if (this.look.timer <= 0) {
        this.look.target = (Math.random() * 2 - 1) * 0.8;
        this.look.timer = 1.5 + Math.random() * 3.5;
      }
    }
    this.look.yaw = THREE.MathUtils.damp(this.look.yaw, wantYaw, 3.5, dt);
    this.look.pitch = THREE.MathUtils.damp(this.look.pitch, wantPitch, 3.5, dt);

    const bob = this.poser.update(dt, { perch, hover: 0, land, speed, lookYaw: this.look.yaw, lookPitch: this.look.pitch });
    // Bob and talon lift are in model units; the companion is scaled
    this.root.position.y += bob * this.scale;
  }

  dispose() {
    this.poser.dispose();
  }
}

function bezier(a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, t: number, out: THREE.Vector3) {
  const u = 1 - t;
  return out.set(
    u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    u * u * a.z + 2 * u * t * c.z + t * t * b.z,
  );
}

function bezierTangent(a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, t: number, out: THREE.Vector3) {
  const u = 1 - t;
  return out
    .set(2 * u * (c.x - a.x) + 2 * t * (b.x - c.x), 2 * u * (c.y - a.y) + 2 * t * (b.y - c.y), 2 * u * (c.z - a.z) + 2 * t * (b.z - c.z))
    .normalize();
}

export default function Companions() {
  const [hovered, setHovered] = useState<number | null>(null);
  usePointerCursor(hovered !== null);
  const { scene, animations } = useGLTF(OWL_URL);
  const owls = useMemo(
    () =>
      [0, 1].map((i) => {
        const model = cloneSkinned(scene);
        model.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) o.frustumCulled = false;
        });
        return new Companion(model, animations, i);
      }),
    [scene, animations],
  );
  useEffect(() => () => owls.forEach((o) => o.dispose()), [owls]);

  const pointerStill = useRef(POINTER_IDLE);
  useFrame(({ camera, pointer }, delta) => {
    const dt = Math.min(delta, 0.1);
    const place = placeAt(flight.current);
    // The guide's velocity, for the escorts' heading
    _guideVel.subVectors(guide.pos, _lastGuide).divideScalar(Math.max(dt, 1e-3));
    if (_guideVel.lengthSq() > 2500) _guideVel.set(0, 0, 0); // a jump (rewind), not flight
    _lastGuide.copy(guide.pos);
    pointerStill.current = pointer.equals(_lastPointer) ? pointerStill.current + dt : 0;
    _lastPointer.copy(pointer);
    const watching = pointerStill.current < POINTER_IDLE;
    for (const owl of owls) {
      owl.update(dt, place, _guideVel, watching ? pointerPoint(camera, pointer, owl.root.position, _pointerAt) : null);
    }
  });

  return (
    <>
      {owls.map((o, i) => (
        <primitive
          key={i}
          object={o.root}
          onPointerOver={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            setHovered(o.sitting ? i : null);
          }}
          onPointerOut={() => setHovered(null)}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            if (!o.startle()) return;
            e.stopPropagation();
            // The smaller the owl, the higher its call
            playOwlCall({ pitch: 1.18 + i * 0.14, wingbeats: clickWingbeats() });
          }}
        />
      ))}
    </>
  );
}
