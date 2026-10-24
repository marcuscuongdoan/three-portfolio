import { MathUtils } from "three";
import { TRAFFIC } from "@/config/expodia";
import type { VehicleRig } from "@/components/showcase-3d/vehicleRig";

const ACCEL = 2.4;
const DECEL = 4.5;
const HEADWAY = 1.2;
const MIN_GAP = 2.5;
const FADE = 6;
const CROSS_SLOW = 6;

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const wrapAngle = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

// A polyline sampled every half metre, with a heading at every point
class Path {
  readonly xs: number[] = [];
  readonly zs: number[] = [];
  readonly yaws: number[] = [];
  readonly cum: number[] = [];
  readonly length: number;

  constructor(
    points: [number, number][],
    readonly closed: boolean,
  ) {
    let total = 0;
    points.forEach(([x, z], i) => {
      if (i > 0) total += Math.hypot(x - points[i - 1]![0], z - points[i - 1]![1]);
      this.xs.push(x);
      this.zs.push(z);
      this.cum.push(total);
    });
    if (closed) total += Math.hypot(points[0]![0] - points.at(-1)![0], points[0]![1] - points.at(-1)![1]);
    this.length = total;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const a = closed ? (i - 1 + n) % n : Math.max(0, i - 1);
      const b = closed ? (i + 1) % n : Math.min(n - 1, i + 1);
      // A GLB vehicle faces +X; rotation.y = yaw turns that to (cos, −sin)
      this.yaws.push(Math.atan2(-(this.zs[b]! - this.zs[a]!), this.xs[b]! - this.xs[a]!));
    }
  }

  sample(s: number) {
    const n = this.xs.length;
    s = this.closed ? ((s % this.length) + this.length) % this.length : MathUtils.clamp(s, 0, this.length);
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.cum[mid]! <= s) lo = mid;
      else hi = mid - 1;
    }
    const j = lo + 1 < n ? lo + 1 : this.closed ? 0 : lo;
    const seg = (j === 0 ? this.length : this.cum[j]!) - this.cum[lo]!;
    const t = seg > 0 ? (s - this.cum[lo]!) / seg : 0;
    let dy = this.yaws[j]! - this.yaws[lo]!;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    return {
      x: MathUtils.lerp(this.xs[lo]!, this.xs[j]!, t),
      z: MathUtils.lerp(this.zs[lo]!, this.zs[j]!, t),
      yaw: this.yaws[lo]! + dy * t,
    };
  }
}

function ringPath(radius: number, dir: 1 | -1) {
  const steps = Math.ceil((Math.PI * 2 * radius) / 0.5);
  const pts: [number, number][] = [];
  for (let i = 0; i < steps; i++) {
    const a = (dir * i * Math.PI * 2) / steps;
    pts.push([radius * Math.cos(a), radius * Math.sin(a)]);
  }
  return new Path(pts, true);
}

// In from the gate on the right-hand lane, round the plaza, back out
function avenuePath(angle: number) {
  const { laneOffset: L, gateR, turnR } = TRAFFIC.avenue;
  const local: [number, number][] = [];
  for (let x = gateR; x > turnR; x -= 0.5) local.push([x, -L]);
  const arc = Math.ceil((Math.PI * L) / 0.5);
  for (let i = 0; i <= arc; i++) {
    const t = (i / arc) * Math.PI;
    local.push([turnR - L * Math.sin(t), -L * Math.cos(t)]);
  }
  for (let x = turnR + 0.5; x <= gateR; x += 0.5) local.push([x, L]);
  // Built along +X (heading −X the right-hand side is −Z, so that is the
  // inbound lane), then turned to face its gate
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    path: new Path(
      local.map(([x, z]) => [x * c - z * s, x * s + z * c]),
      false,
    ),
    stopAt: gateR - turnR - 1,
  };
}

interface Vehicle {
  rig: VehicleRig;
  half: number;
  cruise: number;
  s: number;
  v: number;
}

interface RingVehicle extends Vehicle {
  lane: number;
}

interface AvenueVehicle extends Vehicle {
  avenue: number;
  state: "waiting" | "driving";
  timer: number;
  dwelt: boolean;
  // Seconds left at the drop-off, null until it gets there
  dwell: number | null;
  // Index of the crossing zone this vehicle has claimed, or −1
  claimed: number;
}

export class ExpoTraffic {
  readonly rigs: VehicleRig[];
  private readonly rings: { path: Path; radius: number; dir: 1 | -1; vehicles: RingVehicle[] }[];
  private readonly avenues: { path: Path; angle: number; stopAt: number; zones: [number, number][]; vehicles: AvenueVehicle[] }[];

  constructor(make: (i: number) => VehicleRig) {
    let n = 0;
    const vehicle = (s: number): Vehicle => {
      const rig = make(n++);
      rig.groundY = TRAFFIC.groundY;
      const cruise = rig.kind === "bike" ? rand(9, 11.5) : rand(8, 10.5);
      return { rig, half: rig.length / 2, cruise, s, v: cruise };
    };

    this.rings = TRAFFIC.ring.map(({ radius, dir, count }) => {
      const path = ringPath(radius, dir);
      const vehicles = Array.from({ length: count }, (_, i) => ({ ...vehicle(((i + rand(-0.2, 0.2)) / count) * path.length), lane: 0 }));
      return { path, radius, dir, vehicles };
    });

    const { r0, r1 } = TRAFFIC.crossing;
    this.avenues = TRAFFIC.avenue.angles.map((angle, a) => {
      const { path, stopAt } = avenuePath(angle);
      // The two stretches where the avenue runs over the ring road
      const zones: [number, number][] = [];
      let start = -1;
      for (let s = 0; s <= path.length; s += 0.5) {
        const p = path.sample(s);
        const inside = Math.hypot(p.x, p.z) >= r0 && Math.hypot(p.x, p.z) <= r1;
        if (inside && start < 0) start = s;
        if (!inside && start >= 0) {
          zones.push([start, s]);
          start = -1;
        }
      }
      const vehicles = Array.from({ length: TRAFFIC.avenue.perAvenue }, (_, i) => ({
        ...vehicle(0),
        avenue: a,
        state: "waiting" as const,
        timer: rand(0.5, 4) + i * 6,
        dwelt: false,
        dwell: null,
        claimed: -1,
      }));
      vehicles.forEach((v) => (v.rig.root.visible = false));
      return { path, angle, stopAt, zones, vehicles };
    });

    this.rigs = [...this.rings.flatMap((r) => r.vehicles), ...this.avenues.flatMap((a) => a.vehicles)].map((v) => v.rig);
    for (const ring of this.rings) for (const v of ring.vehicles) this.place(v, ring.path, 0, 0, 1 / 60);
  }

  // Arc distance from a ring vehicle to the near edge of an avenue's
  // crossing band, and whether it is already inside the band
  private toCrossing(ring: (typeof this.rings)[number], v: Vehicle, angle: number) {
    const p = ring.path.sample(v.s);
    const theta = Math.atan2(p.z, p.x);
    const delta = wrapAngle(ring.dir * (angle - theta)) * ring.radius;
    const w = TRAFFIC.crossing.halfWidth;
    const around = Math.PI * 2 * ring.radius;
    return { ahead: delta - w, inside: delta < w || around - delta < w };
  }

  private crossingClear(a: number) {
    const angle = this.avenues[a]!.angle;
    for (const ring of this.rings)
      for (const v of ring.vehicles) {
        const c = this.toCrossing(ring, v, angle);
        if (c.inside || c.ahead < TRAFFIC.crossing.lookAhead) return false;
      }
    return true;
  }

  private place(v: Vehicle, path: Path, ds: number, accel: number, dt: number) {
    const p = path.sample(v.s);
    v.rig.setPose(p.x, p.z, p.yaw, ds, v.v, accel, dt);
  }

  // Speed toward the slowest of cruise, the car ahead and any stop line
  private drive(v: Vehicle, path: Path, gap: number, stop: number, cap: number, dt: number) {
    let target = Math.min(v.cruise, cap);
    target = Math.min(target, Math.max(0, (gap - MIN_GAP) / HEADWAY));
    if (stop < Infinity) target = Math.min(target, Math.sqrt(2 * DECEL * 0.8 * Math.max(0, stop)));
    const accel = MathUtils.clamp((target - v.v) * 2, -DECEL * 1.6, ACCEL);
    v.v = Math.max(0, v.v + accel * dt);
    let ds = v.v * dt;
    if (stop < Infinity) ds = Math.min(ds, Math.max(0, stop));
    v.s += ds;
    if (path.closed) v.s %= path.length;
    this.place(v, path, ds, accel, dt);
  }

  update(dt: number) {
    dt = Math.min(dt, 0.1);
    const busy = this.avenues.map((av) => av.vehicles.some((v) => v.claimed >= 0));

    for (const ring of this.rings) {
      const vs = ring.vehicles;
      const L = ring.path.length;
      for (const v of vs) {
        let gap = Infinity;
        for (const o of vs) {
          if (o === v) continue;
          const d = (o.s - v.s + L) % L;
          gap = Math.min(gap, d - v.half - o.half);
        }
        let stop = Infinity;
        this.avenues.forEach((av, a) => {
          if (!busy[a]) return;
          const c = this.toCrossing(ring, v, av.angle);
          if (!c.inside && c.ahead < TRAFFIC.crossing.lookAhead) stop = Math.min(stop, c.ahead - 0.5);
        });
        this.drive(v, ring.path, gap, stop, Infinity, dt);
      }
    }

    this.avenues.forEach((av, a) => {
      const { path, vehicles } = av;
      for (const v of vehicles) {
        if (v.state === "waiting") {
          v.timer -= dt;
          // The gate lane must be free before the next one rolls out
          const blocked = vehicles.some((o) => o !== v && o.state === "driving" && o.s < 18);
          if (v.timer > 0 || blocked) continue;
          Object.assign(v, { state: "driving", s: 0, v: 5, dwelt: false, dwell: null, claimed: -1 });
          v.rig.resetMotion();
          v.rig.root.visible = true;
        }

        let gap = Infinity;
        for (const o of vehicles) {
          if (o === v || o.state !== "driving" || o.s <= v.s) continue;
          gap = Math.min(gap, o.s - v.s - v.half - o.half);
        }

        let stop = Infinity;
        let cap = Infinity;
        // Drop-off at the plaza before the U-turn
        if (!v.dwelt) {
          const d = av.stopAt - v.s;
          stop = Math.min(stop, d);
          if (d < 0.05 && v.v < 0.05) {
            v.dwell = (v.dwell ?? rand(...TRAFFIC.avenue.dwell)) - dt;
            if (v.dwell <= 0) {
              v.dwelt = true;
              v.dwell = null;
            }
          }
        }
        // Give way to the ring road, then claim the crossing
        av.zones.forEach(([z0, z1], zi) => {
          if (v.claimed === zi) {
            if (v.s - v.half > z1) v.claimed = -1;
            return;
          }
          const d = z0 - (v.s + v.half);
          if (d < 0 || d > 30) return;
          cap = Math.min(cap, CROSS_SLOW);
          if (!this.crossingClear(a)) stop = Math.min(stop, d - 0.3);
          else if (d < 2.5) v.claimed = zi;
        });

        this.drive(v, path, gap, stop, cap, dt);

        // Grow out of the gate portal on the way in, shrink into it on the way out
        const edge = Math.min(v.s, path.length - v.s);
        v.rig.root.scale.setScalar(MathUtils.clamp(edge / FADE, 0.001, 1));
        if (v.s >= path.length - 0.01) {
          v.state = "waiting";
          v.claimed = -1;
          v.timer = rand(...TRAFFIC.avenue.respawn);
          v.rig.root.visible = false;
        }
      }
    });
  }
}
