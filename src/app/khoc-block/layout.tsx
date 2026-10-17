import type { Metadata } from "next";
import { Metal_Mania } from "next/font/google";
import "./khoc-block.css";

// Only "KHÓC" / "BLÓCK" and the title are set in it, all Latin-1
const metalMania = Metal_Mania({
  variable: "--font-kb-title",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Marcus Portfolio - Khóc Blóck",
  robots: { index: false, follow: false },
};

export default function KhocBlockLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={`${metalMania.variable} theme-khoc-block`}>{children}</div>;
}
