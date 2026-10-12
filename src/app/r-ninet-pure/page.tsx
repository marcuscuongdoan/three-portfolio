"use client";

import { useGLTF } from "@react-three/drei";
import BikeShowroom from "@/components/bike-showroom/BikeShowroom";
import { R_NINET_PURE } from "@/config/rNineTPure";

// Client page: the bike definition holds RegExps, which can't cross from a
// server component into a client one
useGLTF.preload(R_NINET_PURE.model);

export default function RNineTPurePage() {
  return <BikeShowroom bike={R_NINET_PURE} />;
}
