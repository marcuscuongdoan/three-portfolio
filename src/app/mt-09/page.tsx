"use client";

import { useGLTF } from "@react-three/drei";
import BikeShowroom from "@/components/bike-showroom/BikeShowroom";
import { MT09_SP } from "@/config/mt09";

// Client page: the bike definition holds RegExps, which can't cross from a
// server component into a client one
useGLTF.preload(MT09_SP.model);

export default function Mt09Page() {
  return <BikeShowroom bike={MT09_SP} />;
}
