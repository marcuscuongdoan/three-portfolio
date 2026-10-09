import { Cinzel } from "next/font/google";
import "./legends.css";

// Display serif close to the League client's Beaufort
const cinzel = Cinzel({
  variable: "--font-lol-display",
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
});

export default function LegendsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={`${cinzel.variable} theme-lol`}>{children}</div>;
}
