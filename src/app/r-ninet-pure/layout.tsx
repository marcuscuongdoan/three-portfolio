import type { Metadata, Viewport } from "next";
import ShowroomLayout from "@/components/bike-showroom/ShowroomLayout";
import { R_NINET_PURE } from "@/config/rNineTPure";
import { SITE_URL } from "@/config/site";

const PATH = "/r-ninet-pure";
const TITLE = "BMW R nineT Pure — Interactive 3D Exploded View";
const DESCRIPTION =
  "Take the BMW R nineT Pure apart in 3D: explode the 1,170 cc air/oil-cooled boxer roadster, open each part for BMW's specifications — Paralever, shaft drive, 320 mm twin discs, round headlight — switch on the lights and ride it through desert and city. Built with Three.js and React.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "BMW R nineT Pure",
    "R nineT",
    "R nineT Pure 2018",
    "BMW Motorrad Heritage",
    "boxer engine",
    "Paralever",
    "roadster",
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
  icons: { icon: "/logos/bmw.png", shortcut: "/logos/bmw.png", apple: "/logos/bmw.png" },
};

export const viewport: Viewport = {
  // Matches the studio background (and the dark studio with the lights on)
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: R_NINET_PURE.theme.studio.day },
    { media: "(prefers-color-scheme: dark)", color: R_NINET_PURE.theme.studio.night },
  ],
};

// Structured data: this page is an interactive showcase *about* the bike —
// not a product listing (nothing is sold, and it isn't BMW's page)
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
    name: "BMW R nineT Pure",
    brand: { "@type": "Brand", name: "BMW Motorrad" },
    model: "R nineT Pure",
    vehicleModelDate: "2018",
    color: "Catalano Grey",
    weight: { "@type": "QuantitativeValue", value: 219, unitCode: "KGM" },
    vehicleEngine: {
      "@type": "EngineSpecification",
      engineDisplacement: { "@type": "QuantitativeValue", value: 1170, unitCode: "CMQ" },
      enginePower: { "@type": "QuantitativeValue", value: 81, unitCode: "KWT" },
      torque: { "@type": "QuantitativeValue", value: 116, unitCode: "NU" },
    },
  },
  isBasedOn: Object.values(R_NINET_PURE.sources).map((s) => s.url),
};

export default function RNineTPureLayout({ children }: { children: React.ReactNode }) {
  return (
    <ShowroomLayout bike={R_NINET_PURE} jsonLd={jsonLd}>
      {children}
    </ShowroomLayout>
  );
}
