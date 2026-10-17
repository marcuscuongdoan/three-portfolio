import type { Metadata, Viewport } from "next";
import { Metal_Mania } from "next/font/google";
import "./khoc-block.css";

// Only "KHÓC" / "BLÓCK" and the title are set in it, all Latin-1
const metalMania = Metal_Mania({
  variable: "--font-kb-title",
  subsets: ["latin"],
  weight: "400",
});

const PATH = "/khoc-block";
const TITLE = "Khóc Blóck — Metal Light Show";
const DESCRIPTION =
  "A portrait lit hit by hit to the second chorus of Phùng Khánh Linh's Khóc Blóck: strobe flashes, chrome lettering and a cold torch under your cursor. Built with React and CSS.";

// opengraph-image.png / twitter-image.png next to this file supply the images
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: PATH,
    siteName: "Marcus Portfolio",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, creator: "@carrynology" },
  // Plays someone else's song: shareable by link, kept out of search results
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#040405",
};

export default function KhocBlockLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={`${metalMania.variable} theme-khoc-block`}>{children}</div>;
}
