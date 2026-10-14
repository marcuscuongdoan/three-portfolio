import * as THREE from "three";

/**
 * Where the castle stands, shared by the scene, the grass scatter and the
 * companions. Its front (local +Z) faces the perch tree; the castle itself is
 * built at 1:1 and scaled up, the garden in front of it is not.
 */
export const HOUSE_POSITION = new THREE.Vector3(7.2, 0, -13.5);
export const HOUSE_YAW = -0.22;
export const CASTLE_SCALE = 1.45;

const _v = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** A point in the castle's (unscaled) frame, in world space */
export const houseToWorld = (x: number, y: number, z: number) =>
  new THREE.Vector3(x, y, z).applyAxisAngle(UP, HOUSE_YAW).add(HOUSE_POSITION);

/** World x, z into the castle's (unscaled) frame */
export function worldToHouse(x: number, z: number) {
  _v.set(x - HOUSE_POSITION.x, 0, z - HOUSE_POSITION.z).applyAxisAngle(UP, -HOUSE_YAW);
  return { x: _v.x, z: _v.z };
}
