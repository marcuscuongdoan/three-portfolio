import type { Metadata, Viewport } from "next";
import { SITE_URL } from "@/config/site";
import { SLOTS, TIERS, TRAFFIC } from "@/config/expodia";

const PATH = "/expodia";
const TITLE = "Expodia — Build Your Booth in a Virtual 3D Expo";
const VEHICLES = TRAFFIC.ring.reduce((n, r) => n + r.count, 0) + TRAFFIC.avenue.angles.length * TRAFFIC.avenue.perAvenue;
const DESCRIPTION = `Revived from a broken project once built at Arobaby: a virtual 3D expo hall with ${SLOTS.length} booth slots. Pick a slot, choose a ${new Intl.ListFormat("en", { type: "disjunction" }).format(TIERS)} booth, paint it in your own colours and put your own product images on its display boxes — all saved in your browser — while ${VEHICLES} cars and motorbikes loop the ring road and shuttle in from the gates. Built with Three.js and React.`;

// og:image / twitter:image come from opengraph-image.png and twitter-image.png
// next to this file (Next adds them, with their alt text, automatically)
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "virtual expo",
    "3D trade show",
    "exhibition booth",
    "booth builder",
    "booth customizer",
    "virtual exhibition",
    "trade fair",
    "product display",
    "traffic simulation",
    "interactive 3D",
    "Three.js",
    "React Three Fiber",
    "WebGL",
    "glTF",
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
  about: {
    "@type": "CreativeWork",
    name: "Expodia",
    abstract: "A virtual expo where visitors set up their own exhibition booth, revived from a broken project once built at Arobaby.",
    creator: { "@type": "Person", name: "Marcus Cuong Doan" },
    genre: "Interactive 3D scene",
    keywords: "virtual expo, booth builder, glTF, Three.js",
  },
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
