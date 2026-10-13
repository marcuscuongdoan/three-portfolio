import type { Metadata, Viewport } from "next";
import ShowroomLayout from "@/components/bike-showroom/ShowroomLayout";
import { AFRICA_TWIN } from "@/config/africaTwin";
import { SITE_URL } from "@/config/site";

const PATH = "/africa-twin";
const TITLE = "Honda CRF1100L Africa Twin — Interactive 3D Exploded View";
const DESCRIPTION =
  "Take the 2026 Honda CRF1100L Africa Twin apart in 3D: explode the bike, open each of its parts for Honda's specifications, switch on the lights and ride it through desert and city. Built with Three.js and React.";

// og:image / twitter:image come from opengraph-image.png and twitter-image.png
// next to this file (Next adds them, with their alt text, automatically)
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "Honda Africa Twin",
    "CRF1100L",
    "Africa Twin 2026",
    "adventure motorcycle",
    "exploded view",
    "3D motorcycle",
    "interactive 3D",
    "motorcycle specifications",
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
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    creator: "@carrynology",
  },
  category: "technology",
  // The maker's own icon in the tab (the rest of the site uses the owl)
  icons: { icon: "/logos/honda.png", shortcut: "/logos/honda.png", apple: "/logos/honda.png" },
};

export const viewport: Viewport = {
  // Matches the studio background (and the dark studio with the lights on)
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e8eaed" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d12" },
  ],
};

// Structured data: this page is an interactive showcase *about* the bike —
// not a product listing (nothing is sold, and it isn't Honda's page)
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: TITLE,
  description: DESCRIPTION,
  url: `${SITE_URL}${PATH}`,
  inLanguage: "en",
  author: { "@type": "Person", name: "Marcus Cuong Doan" },
  about: {
    "@type": "Motorcycle",
    name: "Honda CRF1100L Africa Twin",
    brand: { "@type": "Brand", name: "Honda" },
    model: "CRF1100L Africa Twin",
    vehicleModelDate: "2026",
    vehicleEngine: {
      "@type": "EngineSpecification",
      engineDisplacement: { "@type": "QuantitativeValue", value: 1084, unitCode: "CMQ" },
      enginePower: { "@type": "QuantitativeValue", value: 75, unitCode: "KWT" },
      torque: { "@type": "QuantitativeValue", value: 112, unitCode: "NU" },
    },
  },
  isBasedOn: Object.values(AFRICA_TWIN.sources).map((s) => s.url),
};

export default function AfricaTwinLayout({ children }: { children: React.ReactNode }) {
  return (
    <ShowroomLayout bike={AFRICA_TWIN} jsonLd={jsonLd}>
      {children}
    </ShowroomLayout>
  );
}
