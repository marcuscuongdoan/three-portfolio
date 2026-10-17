import { lazy } from "react";
import type { SeasonalTheme } from "@/themes/types";
import "@/themes/new-year/new-year.css";

const newYear: SeasonalTheme = {
  id: "new-year",
  name: "New Year",
  icon: "🎆",
  day: () => [1, 1],
  lasts: 1,
  className: "theme-new-year",
  copy: { homeKicker: "Happy New Year · welcome to the nest" },
  Scene: lazy(() => import("@/themes/new-year/NewYearScene")),
};

export default newYear;
