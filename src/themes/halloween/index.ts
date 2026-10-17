import { lazy } from "react";
import type { SeasonalTheme } from "@/themes/types";
import "@/themes/halloween/halloween.css";

const halloween: SeasonalTheme = {
  id: "halloween",
  name: "Halloween",
  icon: "🎃",
  day: () => [10, 31],
  lasts: 1,
  className: "theme-halloween",
  copy: { homeKicker: "Trick or treat · welcome to the nest" },
  Scene: lazy(() => import("@/themes/halloween/HalloweenScene")),
};

export default halloween;
