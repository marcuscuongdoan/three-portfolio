import { CatmullRomCurve3, MathUtils, Vector3 } from "three";
import { ROAD, STATION } from "@/config/showcase3d";
import type { VehicleRig } from "./vehicleRig";

// ---------------------------------------------------------------- road lanes

export type LaneId = "eb" | "wb";

const LANES: Record<LaneId, { z: number; dir: 1 | -1 }> = {
  eb: { z: ROAD.eastboundZ, dir: 1 },
  wb: { z: ROAD.westboundZ, dir: -1 },
};
const SPAN = ROAD.spanMaxX - ROAD.spanMinX;
// A vehicle within this distance of a lane's centre line holds that lane
const LANE_BAND = 1.6;

const ACCEL = 2.6;
const BRAKE = 7;
const MIN_GAP = 6.5;
const HEADWAY = 1.1;

interface Occupant {
  x: number;
  z: number;
  self: object;
}

// Lets an agent find the nearest vehicle ahead of it in its lane
function gapAhead(occupants: Occupant[], self: object, x: number, lane: LaneId, wrap: boolean) {
  const { z, dir } = LANES[lane];
  let best = Infinity;
  for (const o of occupants) {
    if (o.self === self || Math.abs(o.z - z) > LANE_BAND) continue;
    let d = (o.x - x) * dir;
    if (wrap && d < 0) d += SPAN;
    if (d > 0 && d < best) best = d;
  }
  return best;
}

const followSpeed = (gap: number, v: number) => Math.max(0, (gap - MIN_GAP) / HEADWAY - v * 0.15);

function approach(v: number, target: number, dt: number) {
  const dv = target - v;
  return v + MathUtils.clamp(dv, -BRAKE * dt, ACCEL * dt);
}

export class LaneAgent {
  readonly rig: VehicleRig;
  readonly lane: LaneId;
  readonly vTarget: number;
  readonly offset: number;
  s: number;
  v: number;
  accel = 0;

  constructor(rig: VehicleRig, lane: LaneId, s: number, vTarget: number, offset = 0) {
    this.rig = rig;
    this.lane = lane;
    this.s = s;
    this.vTarget = vTarget;
    this.v = vTarget;
    this.offset = offset;
  }

  get x() {
    return LANES[this.lane].dir === 1 ? ROAD.spanMinX + this.s : ROAD.spanMaxX - this.s;
  }

  get z() {
    return LANES[this.lane].z + this.offset;
  }

  step(dt: number, occupants: Occupant[]) {
    const gap = gapAhead(occupants, this, this.x, this.lane, true);
    const before = this.v;
    this.v = approach(this.v, Math.min(this.vTarget, followSpeed(gap, this.v)), dt);
    this.accel = dt > 0 ? (this.v - before) / dt : 0;
    const ds = this.v * dt;
    this.s += ds;
    const wrapped = this.s >= SPAN;
    if (wrapped) {
      this.s -= SPAN;
      this.rig.resetMotion();
    }
    const yaw = LANES[this.lane].dir === 1 ? 0 : Math.PI;
    this.rig.setPose(this.x, this.z, yaw, ds, this.v, this.accel, dt);
  }
}

// ------------------------------------------------------------- fuel stop

type V2 = [number, number];

const path = (points: V2[]) =>
  new CatmullRomCurve3(
    points.map(([x, z]) => new Vector3(x, 0, z)),
    false,
    "centripetal",
  );

const WB = ROAD.westboundZ;
// Where a fuel-stop car waits for the gate before it turns in
const TURN_IN_X = 21;
// Far enough down the road for the fog to hide the car appearing
const SPAWN_X = ROAD.spanMaxX - 15;

function lanePaths(laneX: number) {
  const pump = STATION.pumpZ;
  const jog = laneX > 7; // the right-hand lane passes the gate post first
  const enter: V2[] = jog
    ? [[TURN_IN_X, WB], [13, WB - 0.1], [9, 16.9], [7.1, 13.4], [7.0, 10.6], [7.6, 7.2], [laneX, 4.4], [laneX, pump]]
    : [[TURN_IN_X, WB], [13, WB - 0.1], [8.6, 17.2], [5.8, 14.2], [laneX, 10], [laneX, 6], [laneX, pump]];
  const exit: V2[] = jog
    ? [[laneX, pump], [laneX, 4.4], [7.6, 7.2], [7.0, 10.8], [7.4, 14.2], [9.8, 17.4], [13.5, WB]]
    : [[laneX, pump], [laneX, 6], [5.3, 10], [6.4, 14], [9.4, 17.4], [13.5, WB]];
  return {
    road: path([[SPAWN_X, WB], [TURN_IN_X + 12, WB], [TURN_IN_X, WB]]),
    enter: path(enter),
    exit: path(exit),
    leave: path([[13.5, WB], [-20, WB], [ROAD.spanMinX + 5, WB]]),
  };
}

type Step =
  | { kind: "spawn" }
  | { kind: "drive"; curve: CatmullRomCurve3; dir: 1 | -1; vmax: number; stop: boolean; gate?: "enter" | "exit" }
  | { kind: "refuel" }
  | { kind: "pause"; seconds: number }
  | { kind: "despawn" };

const tmpP = new Vector3();
const tmpT = new Vector3();
const tmpA = new Vector3();

function curvatureAt(curve: CatmullRomCurve3, u: number, len: number) {
  const du = Math.min(0.02, 1.5 / len);
  const u0 = MathUtils.clamp(u - du, 0, 1);
  const u1 = MathUtils.clamp(u + du, 0, 1);
  curve.getTangentAt(u0, tmpT);
  curve.getTangentAt(u1, tmpA);
  const a0 = Math.atan2(-tmpT.z, tmpT.x);
  const a1 = Math.atan2(-tmpA.z, tmpA.x);
  const d = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0));
  return Math.abs(d) / Math.max(1e-3, (u1 - u0) * len);
}

/** Shared between the two fuel lanes: one car at a time through the gate. */
export class StationGate {
  holder: object | null = null;
  tryTake(who: object) {
    if (this.holder && this.holder !== who) return false;
    this.holder = who;
    return true;
  }
  release(who: object) {
    if (this.holder === who) this.holder = null;
  }
}

/**
 * One fuel lane. A car comes along the westbound lane, waits for the gate,
 * turns in, fills up, then backs out onto the road and drives off — the next
 * model in the pool takes its place.
 */
export class FuelLane {
  readonly pool: VehicleRig[];
  readonly gate: StationGate;
  private readonly steps: Step[];
  private stepIndex = 0;
  private stepTime = 0;
  private u = 0;
  private v = 0;
  private accel = 0;
  private poolIndex: number;
  private delay: number;
  rig: VehicleRig;
  // 0..1 while the car is at the pump, otherwise -1
  refuel = -1;
  x = 0;
  z = 0;

  constructor(pool: VehicleRig[], laneIndex: 0 | 1, gate: StationGate, delay: number) {
    this.pool = pool;
    this.gate = gate;
    this.delay = delay;
    this.poolIndex = laneIndex;
    this.rig = pool[this.poolIndex % pool.length]!;
    for (const r of pool) r.root.visible = false;
    const p = lanePaths(STATION.laneX[laneIndex]);
    this.steps = [
      { kind: "spawn" },
      { kind: "drive", curve: p.road, dir: 1, vmax: 10, stop: false, gate: "enter" },
      { kind: "drive", curve: p.enter, dir: 1, vmax: 4, stop: true },
      { kind: "refuel" },
      { kind: "drive", curve: p.exit, dir: -1, vmax: 2.2, stop: true, gate: "exit" },
      { kind: "pause", seconds: 0.6 },
      { kind: "drive", curve: p.leave, dir: 1, vmax: 11, stop: false },
      { kind: "despawn" },
      { kind: "pause", seconds: 2 },
    ];
  }

  // The car in the lane, if it is on stage
  get active() {
    return this.rig.root.visible ? this.rig : null;
  }

  private next() {
    const step = this.steps[this.stepIndex]!;
    // The gate is held from the turn-in until the car stops at the pump, and
    // from the start of the back-out until the car is on the road
    if (step.kind === "drive" && (step.gate === "exit" || (!step.gate && step.stop))) this.gate.release(this);
    this.stepIndex = (this.stepIndex + 1) % this.steps.length;
    this.stepTime = 0;
    this.u = 0;
  }

  step(dt: number, occupants: Occupant[]) {
    if (this.delay > 0) {
      this.delay -= dt;
      return;
    }
    const step = this.steps[this.stepIndex]!;
    this.stepTime += dt;
    this.refuel = -1;

    switch (step.kind) {
      case "spawn": {
        // Appear far down the road once nothing is about to run into us
        const clear = occupants.every((o) => Math.abs(o.z - WB) > LANE_BAND || o.x < SPAWN_X - 12 || o.x > SPAWN_X + 25);
        if (!clear) return;
        this.rig = this.pool[this.poolIndex++ % this.pool.length]!;
        this.rig.resetMotion();
        this.rig.root.visible = true;
        this.v = 10;
        this.next();
        this.place(this.steps[this.stepIndex] as Extract<Step, { kind: "drive" }>, 0, dt);
        return;
      }
      case "refuel": {
        this.refuel = Math.min(1, this.stepTime / STATION.refuelSeconds);
        this.rig.setPose(this.x, this.z, this.rig.root.rotation.y, 0, 0, 0, dt);
        if (this.stepTime >= STATION.refuelSeconds) this.next();
        return;
      }
      case "pause": {
        if (this.rig.root.visible) this.rig.setPose(this.x, this.z, this.rig.root.rotation.y, 0, 0, 0, dt);
        if (this.stepTime >= step.seconds) this.next();
        return;
      }
      case "despawn": {
        this.rig.root.visible = false;
        this.next();
        return;
      }
      case "drive":
        this.drive(step, dt, occupants);
    }
  }

  private gateOpen(step: Extract<Step, { kind: "drive" }>, occupants: Occupant[], remainingToTurn = 0) {
    if (step.gate === "exit") {
      // Back out only into an empty stretch of the westbound lane
      const clear = occupants.every(
        (o) => o.self === this || Math.abs(o.z - WB) > LANE_BAND || o.x < -3 || o.x > 34,
      );
      return clear && this.gate.tryTake(this);
    }
    // Entering: only claim the gate once the turn is within braking range
    return remainingToTurn > 30 || this.gate.tryTake(this);
  }

  private drive(step: Extract<Step, { kind: "drive" }>, dt: number, occupants: Occupant[]) {
    const len = step.curve.getLength();
    const remaining = (1 - this.u) * len;

    // Exit gate is checked before moving; entry gate as the car nears the turn
    if (step.gate === "exit" && this.u === 0 && !this.gateOpen(step, occupants)) {
      this.rig.setPose(this.x, this.z, this.rig.root.rotation.y, 0, 0, 0, dt);
      return;
    }
    let mustStop = step.stop;
    if (step.gate === "enter" && !this.gateOpen(step, occupants, remaining)) mustStop = true;

    let target = step.vmax;
    if (mustStop) target = Math.min(target, Math.sqrt(2 * 3.2 * Math.max(0, remaining - 0.05)));
    // Ease off for bends a little way ahead
    const ahead = MathUtils.clamp(this.u + (this.v * 1.2 + 2) / len, 0, 1);
    const k = Math.max(curvatureAt(step.curve, this.u, len), curvatureAt(step.curve, ahead, len));
    if (k > 1e-3) target = Math.min(target, Math.max(2.2, Math.sqrt(2.4 / k)));
    // Keep behind anything in the lane we're driving along
    if (step.dir === 1 && Math.abs(this.z - WB) < LANE_BAND) {
      target = Math.min(target, followSpeed(gapAhead(occupants, this, this.x, "wb", false), this.v));
    }

    const before = this.v;
    this.v = approach(this.v, target, dt);
    this.accel = dt > 0 ? (this.v - before) / dt : 0;
    const ds = Math.min(this.v * dt, remaining);
    this.u = Math.min(1, this.u + ds / len);
    this.place(step, ds, dt);

    const arrived = this.u >= 1 || (mustStop && remaining < 0.06 && this.v < 0.05);
    if (!arrived) return;
    if (step.gate === "enter" && mustStop && this.gate.holder !== this) {
      this.v = 0;
      return; // hold at the turn until the gate frees up
    }
    if (step.stop) this.v = 0;
    this.next();
  }

  private place(step: Extract<Step, { kind: "drive" }>, ds: number, dt: number) {
    step.curve.getPointAt(this.u, tmpP);
    step.curve.getTangentAt(this.u, tmpT);
    if (step.dir === -1) tmpT.negate();
    this.x = tmpP.x;
    this.z = tmpP.z;
    const yaw = Math.atan2(-tmpT.z, tmpT.x);
    const sign = step.dir;
    this.rig.setPose(this.x, this.z, yaw, ds * sign, this.v, this.accel * sign, dt);
  }
}

// --------------------------------------------------------------- the road

export class TrafficSim {
  readonly agents: LaneAgent[];
  readonly fuel: FuelLane[];
  private readonly occupants: Occupant[] = [];

  constructor(agents: LaneAgent[], fuel: FuelLane[]) {
    this.agents = agents;
    this.fuel = fuel;
  }

  step(dt: number) {
    const occ = this.occupants;
    occ.length = 0;
    for (const a of this.agents) occ.push({ x: a.x, z: a.z, self: a });
    for (const f of this.fuel) if (f.active) occ.push({ x: f.x, z: f.z, self: f });
    for (const a of this.agents) a.step(dt, occ);
    for (const f of this.fuel) f.step(dt, occ);
  }
}

export { SPAN as ROAD_SPAN };
