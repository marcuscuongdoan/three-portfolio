import type { Metadata } from "next";
import { Cinzel } from "next/font/google";
import "./trial.css";

// Same display serif as /legends; exposed through the `font-lol` utility
const cinzel = Cinzel({
  variable: "--font-lol-display",
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
});

export const metadata: Metadata = {
  title: "Marcus Portfolio - Trial",
};

export default function TrialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={`${cinzel.variable} theme-trial`}>{children}</div>;
}
