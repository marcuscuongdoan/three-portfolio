import { Box3, Group, MathUtils, type Material, type Mesh, type MeshStandardMaterial, type Object3D } from "three";
import { GROUND_Y } from "@/config/showcase3d";

export type VehicleKind = "car" | "bike";

interface Wheel {
  node: Object3D;
  radius: number;
  front: boolean;
}

const BRAKE_GLOW = 5;

// Every GLB vehicle faces +X with its wheels as children named *_Wheel_*;
// the wheel's height above the model origin doubles as its radius.
export class VehicleRig {
  readonly root = new Group();
  readonly body: Object3D;
  readonly kind: VehicleKind;
  readonly file: string;
  // The rider GLB sitting on a motorbike, if one was added
  readonly riderFile: string | null;
  readonly length: number;
  readonly wheelbase: number;
  private readonly wheels: Wheel[] = [];
  private readonly brakeMats: { mat: MeshStandardMaterial; base: number }[] = [];
  private steer = 0;
  private lean = 0;
  private pitch = 0;
  private lastYaw = 0;
  private hasPose = false;
  // Distance-weighted yaw rate, for steering and lean
  curvature = 0;

  constructor(source: Object3D, kind: VehicleKind, file: string, rider?: { object: Object3D; file: string }) {
    this.kind = kind;
    this.file = file;
    this.riderFile = rider?.file ?? null;
    this.body = source.clone(true);
    this.body.position.set(0, 0, 0);
    this.body.quaternion.identity();
    this.body.visible = true;
    if (rider) this.body.add(rider.object.clone(true));
    this.root.add(this.body);

    const fronts: number[] = [];
    const rears: number[] = [];
    this.body.traverse((o) => {
      if (/ChargeCable/i.test(o.name)) o.visible = false;
      if (/Wheel/i.test(o.name)) {
        const front = /Wheel_F/i.test(o.name);
        o.rotation.order = "YXZ";
        this.wheels.push({ node: o, radius: Math.max(0.15, o.position.y), front });
        (front ? fronts : rears).push(o.position.x);
      }
      const mesh = o as Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.material = this.ownBrakeMaterial(mesh.material);
      }
    });
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    this.wheelbase = Math.max(0.8, avg(fronts) - avg(rears));
    const box = new Box3().setFromObject(this.body);
    this.length = box.max.x - box.min.x;
  }

  // Tail-light materials are cloned per vehicle so each one brakes on its own
  private ownBrakeMaterial(material: Material | Material[]): Material | Material[] {
    if (Array.isArray(material)) return material.map((m) => this.ownBrakeMaterial(m) as Material);
    if (!/tail|brake/i.test(material.name)) return material;
    const mat = material.clone() as MeshStandardMaterial;
    this.brakeMats.push({ mat, base: mat.emissiveIntensity ?? 1 });
    return mat;
  }

  /**
   * Places the vehicle and animates wheels, steering, lean and pitch.
   * `ds` is the signed distance travelled this frame (negative when reversing).
   */
  setPose(x: number, z: number, yaw: number, ds: number, speed: number, accel: number, dt: number) {
    if (this.hasPose && Math.abs(ds) > 1e-4) {
      let dyaw = yaw - this.lastYaw;
      dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
      this.curvature = MathUtils.lerp(this.curvature, dyaw / ds, 1 - Math.exp(-dt * 10));
    }
    this.hasPose = true;
    this.lastYaw = yaw;
    this.root.position.set(x, GROUND_Y, z);
    this.root.rotation.y = yaw;

    const k = 1 - Math.exp(-dt * 8);
    const steerTarget = MathUtils.clamp(Math.atan(this.wheelbase * this.curvature), -0.6, 0.6);
    this.steer = MathUtils.lerp(this.steer, steerTarget, k);
    for (const w of this.wheels) {
      w.node.rotation.z -= ds / w.radius;
      w.node.rotation.y = w.front ? this.steer : 0;
    }

    if (this.kind === "bike") {
      const leanTarget = MathUtils.clamp(-Math.atan((speed * speed * this.curvature) / 9.81), -0.55, 0.55);
      this.lean = MathUtils.lerp(this.lean, leanTarget, k);
      this.body.rotation.x = this.lean;
    }
    const pitchTarget = MathUtils.clamp(accel * 0.006, -0.035, 0.02) * (this.kind === "bike" ? 0.5 : 1);
    this.pitch = MathUtils.lerp(this.pitch, pitchTarget, k);
    this.body.rotation.z = this.pitch;

    const braking = accel < -0.8 || (speed < 0.05 && this.root.visible);
    for (const b of this.brakeMats) b.mat.emissiveIntensity = braking ? BRAKE_GLOW : b.base;
  }

  // Forget the previous pose so a respawn doesn't read as a sharp turn
  resetMotion() {
    this.hasPose = false;
    this.curvature = 0;
  }
}
