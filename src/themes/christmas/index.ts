import { lazy } from "react";
import type { SeasonalTheme } from "@/themes/types";
import "@/themes/christmas/christmas.css";

const christmas: SeasonalTheme = {
  id: "christmas",
  name: "Christmas",
  icon: "🎄",
  day: () => [12, 25],
  lasts: 1,
  className: "theme-christmas",
  copy: { homeKicker: "Merry Christmas · welcome to the nest" },
  Scene: lazy(() => import("@/themes/christmas/ChristmasScene")),
};

export default christmas;
