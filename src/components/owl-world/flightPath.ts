import * as THREE from "three";

/**
 * The owl's whole journey is one curve. Scroll progress is a float where each
 * integer is a stop (a snap point): 0 home → 1 loop → 2 web products →
 * 3 3D lab → 4 museum → 5 contact → 6 home again. Between two stops the owl
 * moves along the curve at constant speed (by arc length); near a stop that
 * has its own framing the owl's pose and the camera ease into it.
 */

export type StopKind = "perch" | "hover" | "chase";

export interface StopDef {
  id: string;
  kind: StopKind;
  // Owl heading at the stop (rotation about Y; 0 faces -Z, π faces +Z)
  yaw?: number;
  // Nose-up tilt while hovering
  pitch?: number;
}

export const STOPS: StopDef[] = [
  { id: "home", kind: "perch", yaw: Math.PI + 0.32 },
  { id: "loop", kind: "chase" },
  { id: "web", kind: "chase" },
  { id: "lab", kind: "chase" },
  { id: "museum", kind: "perch", yaw: 0 },
  { id: "contact", kind: "hover", yaw: Math.PI + 0.38, pitch: 0.35 },
  { id: "return", kind: "perch", yaw: Math.PI + 0.32 },
];
export const LAST_STOP = STOPS.length - 1;

// Portrait screens get a taller field of view so the scenes still fit across
export const PORTRAIT_ASPECT = 0.9;
export const cameraFov = (aspect: number) => (aspect < PORTRAIT_ASPECT ? 58 : 45);
export const STOP_INDEX = { home: 0, loop: 1, web: 2, lab: 3, museum: 4, contact: 5, return: 6 } as const;

// Where the owl sits on the branch — the tree and branch are built around it
export const PERCH_HOME = new THREE.Vector3(0, 2.79, 0.01);
// The museum perch (top of the pedestal) and the arc of walls around it
export const MUSEUM_CENTER = new THREE.Vector3(-4.5, 1.6, -86);
export const MUSEUM_RADIUS = 8.4;
export const MUSEUM_WALLS = 3;
export const MUSEUM_WALL_STEP = THREE.MathUtils.degToRad(30);
export const CONTACT_POINT = new THREE.Vector3(-3.2, 15.5, -78);

// The flight corridor the cards line
export const CORRIDOR_X = -4.5;
export const CORRIDOR_Y = 4.3;

type P = [number, number, number];
const pts: { p: P; stop?: number }[] = [
  { p: [PERCH_HOME.x, PERCH_HOME.y, PERCH_HOME.z], stop: 0 },
  // Take off toward the camera, then one full circle around the tree crown
  { p: [-0.5, 3.4, 1.35] },
  { p: [-2.7, 4.25, 2.65] },
  { p: [-5.3, 4.8, -1.0] },
  { p: [-1.4, 5.5, -4.9] },
  { p: [2.5, 5.8, -1.0] },
  { p: [-1.4, 5.4, 2.9], stop: 1 },
  { p: [-5.3, 5.0, -1.0] },
  // ...then straight down the corridor
  { p: [-4.9, 4.6, -6] },
  { p: [CORRIDOR_X, CORRIDOR_Y, -11], stop: 2 },
  { p: [CORRIDOR_X + 0.3, CORRIDOR_Y + 0.2, -26] },
  { p: [CORRIDOR_X, CORRIDOR_Y, -42], stop: 3 },
  { p: [CORRIDOR_X - 0.3, CORRIDOR_Y - 0.1, -56] },
  { p: [CORRIDOR_X, CORRIDOR_Y - 0.6, -68] },
  { p: [CORRIDOR_X, 2.9, -76] },
  { p: [CORRIDOR_X, 2.05, -82.5] },
  { p: [MUSEUM_CENTER.x, MUSEUM_CENTER.y, MUSEUM_CENTER.z], stop: 4 },
  // Up out of the open-air museum in a wide rising turn — always moving
  // across as well as up, so the heading (and the chase camera) stays steady
  { p: [-4.5, 3.6, -89.2] },
  { p: [-1.6, 6.6, -91.6] },
  { p: [1.6, 9.8, -88.4] },
  { p: [1.8, 12.8, -83] },
  { p: [-0.6, 14.9, -78.8] },
  { p: [CONTACT_POINT.x, CONTACT_POINT.y, CONTACT_POINT.z], stop: 5 },
  // A long glide home over the house
  { p: [-2.4, 15.5, -62] },
  { p: [-0.4, 13, -38] },
  { p: [2.2, 10.2, -14] },
  // ...swinging out over the open garden so it comes in from the right,
  // clear of the tree, and lands facing the camera
  { p: [4.2, 6.4, -4.2] },
  { p: [3.0, 4.3, 1.1] },
  { p: [1.0, 3.25, 0.75] },
  { p: [PERCH_HOME.x, PERCH_HOME.y, PERCH_HOME.z], stop: 6 },
];

const curve = new THREE.CatmullRomCurve3(
  pts.map(({ p }) => new THREE.Vector3(...p)),
  false,
  "centripetal",
);
const TOTAL = curve.getLength();
// Arc length → curve parameter (sampled lengths can overshoot the end a hair)
const toU = (len: number) => THREE.MathUtils.clamp(len / TOTAL, 0, 1);

// Arc length at each stop: control point i sits at t = i / (n - 1)
const STOP_LEN: number[] = (() => {
  const samples = 6000;
  const lengths = curve.getLengths(samples);
  const n = pts.length - 1;
  const out: number[] = [];
  pts.forEach(({ stop }, i) => {
    if (stop === undefined) return;
    const x = (i / n) * samples;
    const i0 = Math.floor(x);
    const i1 = Math.min(samples, i0 + 1);
    out[stop] = THREE.MathUtils.lerp(lengths[i0]!, lengths[i1]!, x - i0);
  });
  return out;
})();

export const stopPosition = (stop: number, target = new THREE.Vector3()) =>
  curve.getPointAt(toU(STOP_LEN[THREE.MathUtils.clamp(stop, 0, LAST_STOP)]!), target);

// Camera framing at stops that override the chase camera, as offsets from the
// owl. Narrow (portrait) screens need a different composition
function stopCamera(id: string, aspect: number, fov: number, pos: THREE.Vector3, target: THREE.Vector3) {
  const portrait = aspect < PORTRAIT_ASPECT;
  switch (id) {
    case "home":
    case "return":
      // Looking at the owl, panned right so it sits in the upper left
      if (portrait) {
        pos.set(0.45, 0.75, 4.4);
        target.set(0.45, -0.95, 0);
      } else {
        pos.set(0.9, 0.38, 2.6);
        target.set(0.9, -0.32, 0);
      }
      return true;
    case "museum": {
      // Behind the owl, far enough back that all the walls fit across
      const tanH = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * aspect;
      const halfAngle = MUSEUM_WALL_STEP * (MUSEUM_WALLS / 2);
      const edgeX = Math.sin(halfAngle) * MUSEUM_RADIUS + 0.4;
      const edgeZ = -Math.cos(halfAngle) * MUSEUM_RADIUS;
      // Phones can't fit the whole arc without backing into the flight
      // cards; they get the middle walls and a higher, steeper view instead
      const back = THREE.MathUtils.clamp(edgeX / tanH + edgeZ, 4.2, 13);
      pos.set(0, 1.25 + back * 0.12 + (portrait ? 1.5 : 0), back);
      target.set(0, portrait ? 1.6 : 2.1, -MUSEUM_RADIUS);
      return true;
    }
    case "contact":
      // On a phone the form fills the lower part; the owl hovers above it
      if (portrait) {
        pos.set(0, 0.3, 4.6);
        target.set(0, -0.9, 0);
      } else {
        pos.set(0.7, 0.32, 3.05);
        target.set(0.72, 0.02, 0);
      }
      return true;
    default:
      return false;
  }
}

export interface FlightSample {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  // 0 → flying, 1 → sitting (the Emote clip)
  perch: number;
  // 0 → flying, 1 → hovering in place
  hover: number;
  // 0 → cruising, 1 → on final approach to (or just off) a perch: flaring
  land: number;
  camPos: THREE.Vector3;
  camTarget: THREE.Vector3;
}

export const createSample = (): FlightSample => ({
  pos: new THREE.Vector3(),
  quat: new THREE.Quaternion(),
  perch: 1,
  hover: 0,
  land: 1,
  camPos: new THREE.Vector3(),
  camTarget: new THREE.Vector3(),
});

const smoothstep = THREE.MathUtils.smoothstep;
const UP = new THREE.Vector3(0, 1, 0);
const FORWARD_AXIS = new THREE.Vector3(0, 0, 1);
const ORIGIN = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _ahead = new THREE.Vector3();
const _behind = new THREE.Vector3();
const _flat = new THREE.Vector3();
const _back = new THREE.Vector3();
const _dirA = new THREE.Vector3();
const _dirB = new THREE.Vector3();
const _sphA = new THREE.Spherical();
const _sphB = new THREE.Spherical();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _roll = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _chasePos = new THREE.Vector3();
const _chaseTarget = new THREE.Vector3();
const _offPos = new THREE.Vector3();
const _offTarget = new THREE.Vector3();
const _stopPos = new THREE.Vector3();

// Ease a stop's framing in over this much of the neighbouring segments. The
// camera window must stay ≤ 0.5 so two stops never pull at the same time
const POSE_WINDOW = 0.4;
const PERCH_WINDOW = 0.16;
const CAMERA_WINDOW = 0.5;
// Metres from a stop at which its camera framing starts / is complete
const CAMERA_REACH = 18;
const CAMERA_NEAR = 0.4;
// The approach to a perch: the owl starts to flare at FLARE_START (in
// segment fractions from the perch) and is fully flared by FLARE_FULL
const FLARE_START = 0.42;
const FLARE_FULL = 0.12;
const FLARE_PITCH = 0.9;
const LOCAL_X = new THREE.Vector3(1, 0, 0);

// Hermite eases with unit speed at the free end and zero at a perch, so the
// owl brakes into a landing and builds up speed on take-off
const easeIntoPerch = (f: number) => f + f * f - f * f * f;
const easeOutOfPerch = (f: number) => 1 - easeIntoPerch(1 - f);
const easeBoth = (f: number) => f * f * (3 - 2 * f);

function easeSegment(seg: number, f: number) {
  const fromPerch = STOPS[seg]!.kind === "perch";
  const toPerch = STOPS[seg + 1]!.kind === "perch";
  if (fromPerch && toPerch) return easeBoth(f);
  if (toPerch) return easeIntoPerch(f);
  if (fromPerch) return easeOutOfPerch(f);
  return f;
}

/**
 * Where the owl and camera are at scroll progress `p` (in stops).
 * `reverse` (0..1) is how far the owl has turned round to fly back along
 * the path, for when the page is scrolled up.
 */
export function sampleFlight(p: number, aspect: number, fov: number, reverse: number, out: FlightSample) {
  const progress = THREE.MathUtils.clamp(p, 0, LAST_STOP);
  const seg = Math.min(LAST_STOP - 1, Math.floor(progress));
  const f = progress - seg;
  const s = THREE.MathUtils.lerp(STOP_LEN[seg]!, STOP_LEN[seg + 1]!, easeSegment(seg, f));

  curve.getPointAt(toU(s), out.pos);
  curve.getTangentAt(toU(s), _tan);

  // Flying heading: nose along the curve (the model faces -Z), banked into
  // turns by how fast the heading swings
  curve.getTangentAt(toU(s + 1.5), _ahead);
  curve.getTangentAt(toU(s - 1.5), _behind);
  const turn = _behind.x * _ahead.z - _behind.z * _ahead.x; // -(cross).y
  const bank = THREE.MathUtils.clamp(-turn * 1.1, -0.5, 0.5);
  _m.lookAt(ORIGIN, _tan, UP);
  out.quat.setFromRotationMatrix(_m).multiply(_roll.setFromAxisAngle(FORWARD_AXIS, bank));
  if (reverse > 0) {
    // Flying back: nose down the path the other way, banking the other way
    _m.lookAt(ORIGIN, _back.copy(_tan).negate(), UP);
    _q.setFromRotationMatrix(_m).multiply(_roll.setFromAxisAngle(FORWARD_AXIS, -bank));
    out.quat.slerp(_q, reverse);
  }

  // Chase camera: behind and a little above, along the level heading — it
  // swings round with the owl when it turns back
  _flat.set(_tan.x + _ahead.x + _behind.x, 0, _tan.z + _ahead.z + _behind.z);
  if (_flat.lengthSq() < 1e-4) _flat.set(0, 0, -1);
  _flat.normalize().applyAxisAngle(UP, Math.PI * reverse);
  _chasePos.copy(out.pos).addScaledVector(_flat, -2.5).add(_offPos.set(0, 0.8, 0));
  _chaseTarget.copy(out.pos).addScaledVector(_flat, 3).add(_offTarget.set(0, 0.15, 0));
  out.camPos.copy(_chasePos);
  out.camTarget.copy(_chaseTarget);

  out.perch = 0;
  out.hover = 0;
  out.land = 0;

  // Pull toward the framing of the stop on either side of this segment
  for (const [k, d] of [
    [seg, f],
    [seg + 1, 1 - f],
  ] as const) {
    const def = STOPS[k]!;
    if (def.kind === "chase") continue;

    const wPose = 1 - smoothstep(d, 0, POSE_WINDOW);
    if (wPose > 0) {
      _euler.set(def.pitch ?? 0, def.yaw ?? 0, 0, "YXZ");
      _q.setFromEuler(_euler);
      out.quat.slerp(_q, wPose);
    }
    const wSit = 1 - smoothstep(d, 0.03, PERCH_WINDOW);
    if (def.kind === "perch") {
      out.perch = Math.max(out.perch, wSit);
      out.land = Math.max(out.land, 1 - smoothstep(d, FLARE_FULL, FLARE_START));
    } else out.hover = Math.max(out.hover, 1 - smoothstep(d, 0.05, POSE_WINDOW));

    stopPosition(k, _stopPos);
    // The camera takes the stop's framing over the last stretch of the
    // approach (by distance, so long legs don't drag it along early), and
    // never past the middle of the segment
    const wCam =
      (1 - THREE.MathUtils.smootherstep(d, 0, CAMERA_WINDOW)) *
      (1 - THREE.MathUtils.smootherstep(out.pos.distanceTo(_stopPos), CAMERA_NEAR, CAMERA_REACH));
    // The flare: body pitched up, wings braking, until the sitting pose
    // takes over (it's upright on its own)
    if (def.kind === "perch") {
      const flare = (1 - smoothstep(d, FLARE_FULL, FLARE_START)) * (1 - wSit);
      if (flare > 0) out.quat.multiply(_roll.setFromAxisAngle(LOCAL_X, flare * FLARE_PITCH));
    }
    if (wCam > 0 && stopCamera(def.id, aspect, fov, _offPos, _offTarget)) {
      _offPos.add(_stopPos);
      _offTarget.add(_stopPos);
      // Orbit round the owl from the chase framing to the stop's, rather
      // than sliding straight across: the stop camera often faces the other
      // way, and a straight line between the two runs through the owl.
      // Azimuth, elevation and distance ease separately so the swing goes
      // round the side at a steady height instead of over the top
      _sphA.setFromVector3(_dirA.subVectors(out.camPos, out.pos));
      _sphB.setFromVector3(_dirB.subVectors(_offPos, out.pos));
      let dTheta = _sphB.theta - _sphA.theta;
      dTheta -= Math.round(dTheta / (Math.PI * 2)) * Math.PI * 2;
      _sphA.set(
        THREE.MathUtils.lerp(_sphA.radius, _sphB.radius, wCam),
        THREE.MathUtils.lerp(_sphA.phi, _sphB.phi, wCam),
        _sphA.theta + dTheta * wCam,
      );
      out.camPos.copy(out.pos).add(_dirA.setFromSpherical(_sphA));
      // Mid-swing, keep the owl in shot: the stop's own target only makes
      // sense once the owl has arrived
      out.camTarget.lerp(_offTarget, wCam).lerp(out.pos, Math.sin(Math.PI * wCam) * 0.8);
    }
  }
  return out;
}
