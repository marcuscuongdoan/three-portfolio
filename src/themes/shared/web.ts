import * as THREE from "three";
import { CORRIDOR_X } from "@/components/owl-world/flightPath";
import { GATE_POST_X, GATE_SIGN, GATE_SIGN_Y, ROAD_LAMPS, WEB_GATE } from "@/components/owl-world/Corridor";
import type { FallBox } from "@/themes/shared/Falling";

/**
 * Where themes decorate the web products stop and the road under the flight:
 * the gate the owl flies toward (seen from behind and above as it comes), the
 * ground either side of the gate on the side it comes from, and the lamp
 * posts along the road all the way to the museum.
 */
export const WEB = {
  gate: WEB_GATE,
  // A garland just under the sign and in front of it, post to post
  garland: {
    from: new THREE.Vector3(WEB_GATE.x - GATE_POST_X + 0.1, GATE_SIGN_Y - GATE_SIGN.h / 2 - 0.02, WEB_GATE.z + 0.12),
    to: new THREE.Vector3(WEB_GATE.x + GATE_POST_X - 0.1, GATE_SIGN_Y - GATE_SIGN.h / 2 - 0.02, WEB_GATE.z + 0.12),
    sag: 0.3,
  },
  /** The ground just outside each gate post, toward the home clearing, [x, z]: clear of the road's curbs */
  gateSides: [
    [WEB_GATE.x - 2.4, WEB_GATE.z + 1.1],
    [WEB_GATE.x + 2.4, WEB_GATE.z + 1.1],
  ] as [number, number][],
};

/**
 * The road's lamp posts: `pos` the foot, `away` the level unit vector from
 * the road out to the post, `height` the post (the lamp head is above it)
 */
export const ROAD_POSTS = ROAD_LAMPS;

/** Yaw that turns a thing's +Z to face the road from a post */
export const facingRoad = (away: THREE.Vector3) => Math.atan2(-away.x, -away.z);

/** Something drifting down over the web products row */
export const WEB_FALL: FallBox = [160, CORRIDOR_X, -24, 7, 9, 0, 8];
