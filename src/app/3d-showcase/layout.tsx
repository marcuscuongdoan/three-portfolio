import type { Metadata, Viewport } from "next";
import { SITE_URL } from "@/config/site";
import { SHOWCASE_INFO, SHOWCASE_MODELS } from "@/config/showcase3d";

const PATH = "/3d-showcase";
const TITLE = "3D Showcase — Gas Station, Road Traffic and Subway";
const DESCRIPTION = `${SHOWCASE_INFO.tagline} ${SHOWCASE_MODELS.length} low-poly GLB models stream in with live per-file progress, then come alive: cars pull in to refuel and back out, cars and motorbikes loop the main road, and a train stops at the underground platform — under a day–night cycle and 20 post-processing effects. Built with Three.js and React.`;

// og:image / twitter:image come from opengraph-image.png and twitter-image.png
// next to this file (Next adds them, with their alt text, automatically)
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "3D showcase",
    "low-poly",
    "gas station",
    "traffic simulation",
    "subway train",
    "day night cycle",
    "post-processing",
    "GLB",
    "glTF",
    "model loading",
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
  // The loading screen's night blue
  themeColor: "#0a1024",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: TITLE,
  description: DESCRIPTION,
  url: `${SITE_URL}${PATH}`,
  inLanguage: "en",
  author: { "@type": "Person", name: "Marcus Cuong Doan" },
  about: {
    "@type": "CreativeWork",
    name: "3D Showcase",
    abstract: SHOWCASE_INFO.tagline,
    creator: { "@type": "Person", name: "Marcus Cuong Doan" },
    genre: "Interactive 3D scene",
    keywords: "low-poly, glTF, Three.js, animation",
  },
};

export default function ShowcaseLayout({ children }: { children: React.ReactNode }) {
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
