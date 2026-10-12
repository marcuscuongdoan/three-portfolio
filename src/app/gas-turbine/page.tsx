"use client";

import { useGLTF } from "@react-three/drei";
import PlantShowroom from "@/components/plant-showroom/PlantShowroom";
import { GAS_TURBINE } from "@/config/gasTurbine";

useGLTF.preload(GAS_TURBINE.model);

export default function GasTurbinePage() {
  return <PlantShowroom def={GAS_TURBINE} />;
}
