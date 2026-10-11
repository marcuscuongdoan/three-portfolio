"use client";

import { createContext, useContext } from "react";
import type { BikeDefinition } from "@/config/bikeShowroom";

// The bike on show: every showroom component reads its model, parts, lights
// and theme from here (set once by BikeShowroom)
const BikeContext = createContext<BikeDefinition | null>(null);

export const BikeProvider = BikeContext.Provider;

export const useBikeDef = () => {
  const def = useContext(BikeContext);
  if (!def) throw new Error("useBikeDef must be used inside <BikeProvider>");
  return def;
};
