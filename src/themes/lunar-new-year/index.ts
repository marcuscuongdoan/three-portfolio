import { lazy } from "react";
import type { MonthDay, SeasonalTheme } from "@/themes/types";
import "@/themes/lunar-new-year/lunar-new-year.css";

// The first day of the lunar year (Tết) moves; past this table the theme
// just stops coming round on its own until more years are added
const TET: Record<number, MonthDay> = {
  2025: [1, 29],
  2026: [2, 17],
  2027: [2, 6],
  2028: [1, 26],
  2029: [2, 13],
  2030: [2, 3],
  2031: [1, 23],
  2032: [2, 11],
  2033: [1, 31],
  2034: [2, 19],
  2035: [2, 8],
};

const lunarNewYear: SeasonalTheme = {
  id: "lunar-new-year",
  name: "Lunar New Year",
  icon: "🧧",
  day: (year) => TET[year] ?? null,
  // Tết runs the best part of a week
  lasts: 6,
  className: "theme-lunar-new-year",
  copy: { homeKicker: "Chúc Mừng Năm Mới · welcome to the nest" },
  Scene: lazy(() => import("@/themes/lunar-new-year/LunarNewYearScene")),
};

export default lunarNewYear;
