import * as THREE from "three";
import { CORRIDOR_X } from "@/components/owl-world/flightPath";
import { GATE_POST_X, GATE_SIGN, GATE_SIGN_Y, LAB_GATE } from "@/components/owl-world/Corridor";
import type { FallBox } from "@/themes/shared/Falling";

/**
 * Where themes decorate the 3D lab stop: the gate the owl flies through (seen
 * from just behind and above it), the ground at its posts' feet, and the
 * aisle of cards beyond it.
 */
export const LAB = {
  gate: LAB_GATE,
  // A garland just under the sign and in front of it, post to post
  garland: {
    from: new THREE.Vector3(LAB_GATE.x - GATE_POST_X + 0.1, GATE_SIGN_Y - GATE_SIGN.h / 2 - 0.02, LAB_GATE.z + 0.12),
    to: new THREE.Vector3(LAB_GATE.x + GATE_POST_X - 0.1, GATE_SIGN_Y - GATE_SIGN.h / 2 - 0.02, LAB_GATE.z + 0.12),
    sag: 0.3,
  },
  /**
   * The ground either side of the aisle a few steps past the gate, [x, z]:
   * the posts' own feet are below the bottom of the view
   */
  aisleSides: [
    [LAB_GATE.x - 1.9, LAB_GATE.z - 4],
    [LAB_GATE.x + 1.9, LAB_GATE.z - 4],
  ] as [number, number][],
  /** Over the aisle at about the cards' tops, clear of the owl's line: [x, y, z] */
  overhead: [
    [CORRIDOR_X - 1.6, 5.7, -52],
    [CORRIDOR_X + 1.7, 5.9, -56.5],
    [CORRIDOR_X - 1.5, 5.6, -61],
    [CORRIDOR_X + 1.6, 5.8, -65.5],
  ] as [number, number, number][],
};

/** Something drifting down over the lab aisle */
export const LAB_FALL: FallBox = [220, CORRIDOR_X, -54, 7, 10, 0, 9];
