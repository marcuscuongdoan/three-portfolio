import type { Metadata } from "next";
import { Barlow_Condensed } from "next/font/google";
import "./africa-twin.css";

// Condensed display face for the moto look; exposed through the `font-at` class
const barlow = Barlow_Condensed({
  variable: "--font-at-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Marcus Portfolio - Africa Twin",
  description:
    "An interactive exploded view of the Honda CRF1100L Africa Twin, with Honda's specifications for each part.",
};

export default function AfricaTwinLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${barlow.variable} theme-at`}>{children}</div>;
}
