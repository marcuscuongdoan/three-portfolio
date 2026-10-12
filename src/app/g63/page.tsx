"use client";

import { useGLTF } from "@react-three/drei";
import BikeShowroom from "@/components/bike-showroom/BikeShowroom";
import { G63 } from "@/config/g63";

// Client page: the car definition holds RegExps, which can't cross from a
// server component into a client one
useGLTF.preload(G63.model);

export default function G63Page() {
  return <BikeShowroom bike={G63} />;
}
