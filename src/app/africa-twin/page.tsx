"use client";

import { useGLTF } from "@react-three/drei";
import BikeShowroom from "@/components/bike-showroom/BikeShowroom";
import { AFRICA_TWIN } from "@/config/africaTwin";

// Client page: the bike definition holds RegExps, which can't cross from a
// server component into a client one
useGLTF.preload(AFRICA_TWIN.model);

export default function AfricaTwinPage() {
  return <BikeShowroom bike={AFRICA_TWIN} />;
}
