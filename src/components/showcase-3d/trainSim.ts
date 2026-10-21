import type { Object3D } from "three";
import { TRAIN } from "@/config/showcase3d";

type Phase = "arrive" | "dwell" | "depart" | "layover";

// train.glb runs along +X from its front buffer (x 2.79) back to the last
// coach (x −15.46); turning it to face along the tunnel puts its middle
// 6.33 m behind the origin.
const MID_OFFSET = 6.33;

/**
 * The subway shuttle: runs in from one end of the tunnel, stops at the
 * platform, pulls out the other end, waits out of sight and comes back the
 * other way.
 */
export class TrainSim {
  readonly root: Object3D;
  private readonly wheels: { node: Object3D; radius: number }[] = [];
  private phase: Phase = "arrive";
  private timer = 0;
  private northbound = true;
  z = 0;
  v = 0;

  constructor(root: Object3D) {
    this.root = root;
    root.traverse((o) => {
      if (/Wheel|Driver|Pilot|Trailing/.test(o.name)) this.wheels.push({ node: o, radius: Math.max(0.2, o.position.y) });
    });
    this.startRun();
  }

  get status() {
    if (this.phase === "dwell") return "At platform";
    if (this.phase === "layover") return "In the tunnel";
    return this.phase === "arrive" ? "Arriving" : "Departing";
  }

  private get dir() {
    return this.northbound ? -1 : 1;
  }

  // Origin z that centres the train on the platform
  private get stopZ() {
    return TRAIN.platformCenterZ - this.dir * MID_OFFSET;
  }

  private startRun() {
    this.phase = "arrive";
    this.z = this.northbound ? TRAIN.southEndZ : TRAIN.northEndZ;
    this.v = TRAIN.cruise;
    this.root.visible = true;
    this.root.rotation.y = this.northbound ? Math.PI / 2 : -Math.PI / 2;
  }

  step(dt: number) {
    let ds = 0;
    switch (this.phase) {
      case "arrive": {
        const remaining = (this.stopZ - this.z) * this.dir;
        const target = Math.min(TRAIN.cruise, Math.sqrt(2 * TRAIN.decel * Math.max(0, remaining)));
        this.v = Math.max(0, Math.min(target, this.v + TRAIN.accel * dt));
        ds = Math.min(this.v * dt, Math.max(0, remaining));
        if (remaining < 0.02 || (this.v < 0.03 && remaining < 0.3)) {
          this.z = this.stopZ;
          this.v = 0;
          this.phase = "dwell";
          this.timer = TRAIN.dwell;
          ds = 0;
        }
        break;
      }
      case "dwell":
        this.timer -= dt;
        if (this.timer <= 0) this.phase = "depart";
        break;
      case "depart": {
        this.v = Math.min(TRAIN.cruise, this.v + TRAIN.accel * dt);
        ds = this.v * dt;
        const end = this.northbound ? TRAIN.northEndZ : TRAIN.southEndZ;
        if ((end - this.z) * this.dir <= 0) {
          this.phase = "layover";
          this.timer = TRAIN.layover;
          this.root.visible = false;
          this.v = 0;
        }
        break;
      }
      case "layover":
        this.timer -= dt;
        if (this.timer <= 0) {
          this.northbound = !this.northbound;
          this.startRun();
        }
        break;
    }
    this.z += ds * this.dir;
    this.root.position.set(TRAIN.trackX, TRAIN.railY, this.z);
    for (const w of this.wheels) w.node.rotation.z -= ds / w.radius;
  }
}
