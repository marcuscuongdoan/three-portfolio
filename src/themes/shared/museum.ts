import * as THREE from "three";
import { MUSEUM_CENTER, MUSEUM_RADIUS, MUSEUM_WALL_STEP, MUSEUM_WALLS } from "@/components/owl-world/flightPath";
import type { FallBox } from "@/themes/shared/Falling";

/**
 * Where themes decorate the museum: the arc of walls round the owl's
 * pedestal and the pylons at their joints. Each wall and pylon has its own
 * frame, +Z toward the pedestal (as in Museum.tsx).
 */

const UP = new THREE.Vector3(0, 1, 0);
const WALL_W = 2 * MUSEUM_RADIUS * Math.sin(MUSEUM_WALL_STEP / 2);
const PYLON_RADIUS = MUSEUM_RADIUS / Math.cos(MUSEUM_WALL_STEP / 2);

/** A point in the frame of whatever stands at `angle` on the arc, `radius` from the pedestal */
function onArc(angle: number, radius: number, x: number, y: number, z: number) {
  return new THREE.Vector3(x, y, z)
    .applyAxisAngle(UP, -angle)
    .add(new THREE.Vector3(MUSEUM_CENTER.x + Math.sin(angle) * radius, 0, MUSEUM_CENTER.z - Math.cos(angle) * radius));
}

const wallAngles = Array.from({ length: MUSEUM_WALLS }, (_, i) => (i - (MUSEUM_WALLS - 1) / 2) * MUSEUM_WALL_STEP);
const pylonAngles = Array.from({ length: MUSEUM_WALLS + 1 }, (_, i) => (i - MUSEUM_WALLS / 2) * MUSEUM_WALL_STEP);

export const MUSEUM = {
  /** The walls, left to right: `at(x, y, z)` in a wall's frame (its face is at z = 0.2, its frieze from y = 4.8) */
  walls: wallAngles.map((a) => ({
    at: (x: number, y: number, z: number) => onArc(a, MUSEUM_RADIUS, x, y, z),
    yaw: -a,
    halfWidth: WALL_W / 2,
  })),
  /** One garland per wall, across the frieze above the top row of frames (whose tops are at 4.26 m) */
  garlands: wallAngles.map((a) => ({
    from: onArc(a, MUSEUM_RADIUS, -WALL_W / 2 + 0.15, 5.0, 0.45),
    to: onArc(a, MUSEUM_RADIUS, WALL_W / 2 - 0.15, 5.0, 0.45),
    sag: 0.3,
  })),
  /**
   * The pylons, outer left to outer right: `at(y, z)` is a point on the
   * pylon's axis plane, z out toward the pedestal (the shaft's face is at
   * about 0.28, the plinth's at 0.45, and the wall steps beside it reach out
   * to about 0.85, so floor things go from 1.25); `yaw` turns a thing to face
   * the pedestal
   */
  pylons: pylonAngles.map((a) => ({
    at: (y: number, z: number) => onArc(a, PYLON_RADIUS, 0, y, z),
    yaw: -a,
    outer: Math.abs(a) > MUSEUM_WALL_STEP,
  })),
};

/** Something drifting down over the museum floor */
export const MUSEUM_FALL: FallBox = [200, MUSEUM_CENTER.x, MUSEUM_CENTER.z - 3, 10, 6, 0, 8];
