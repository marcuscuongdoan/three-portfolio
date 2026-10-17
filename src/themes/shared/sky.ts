import type { FireworksProps } from "@/themes/shared/Fireworks";

/**
 * Where fireworks go off: far down the valley, low enough to show above the
 * meadow in the home view (which looks slightly down) and high enough to
 * fill the sky on the glide home from the contact stop
 */
export const VALLEY_SKY: Pick<FireworksProps, "center" | "extent"> = {
  center: [-4, 12, -60],
  extent: [14, 3, 8],
};

/** Behind the museum's walls, for the view from the pedestal */
export const MUSEUM_SKY: Pick<FireworksProps, "center" | "extent"> = {
  center: [-4.5, 14, -108],
  extent: [12, 2.5, 5],
};
