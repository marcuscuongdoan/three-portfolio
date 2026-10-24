import type { Metadata, Viewport } from "next";
import { SITE_URL } from "@/config/site";
import { SLOTS } from "@/config/expodia";

const PATH = "/expodia";
const TITLE = "Expodia — Build Your Booth in a Virtual 3D Expo";
const DESCRIPTION = `A virtual expo hall with ${SLOTS.length} booth slots. Pick a slot, choose a Basic, Pro or Premium booth model, paint it in your own colours and put your product images on its display boxes — all saved in your browser. Built with Three.js and React.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "virtual expo",
    "3D trade show",
    "exhibition booth",
    "booth builder",
    "interactive 3D",
    "Three.js",
    "React Three Fiber",
    "WebGL",
    "Marcus Cuong Doan",
  ],
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
  category: "technology",
};

export const viewport: Viewport = {
  themeColor: "#0b0f17",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: TITLE,
  description: DESCRIPTION,
  url: `${SITE_URL}${PATH}`,
  inLanguage: "en",
  author: { "@type": "Person", name: "Marcus Cuong Doan" },
};

export default function ExpodiaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        // Static, built from our own config: safe to inline. `<` escaped so
        // no string in it can close the script tag
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {children}
    </>
  );
}
