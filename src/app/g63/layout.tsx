import type { Metadata, Viewport } from "next";
import ShowroomLayout from "@/components/bike-showroom/ShowroomLayout";
import { G63 } from "@/config/g63";
import { SITE_URL } from "@/config/site";

const PATH = "/g63";
const TITLE = "Mercedes-AMG G 63 — Interactive 3D Exploded View";
const DESCRIPTION =
  "Take the Mercedes-AMG G 63 apart in 3D: lift the bonnet on the 5.5-litre V8 biturbo, swing out the doors, tailgate and wheels, open each part for its specifications — ladder frame, three differential locks, 420 kW — switch on the lights and drive it through desert and city. Built with Three.js and React.";

// og:image / twitter:image come from opengraph-image.png and twitter-image.png
// next to this file (Next adds them, with their alt text, automatically)
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "Mercedes-AMG G 63",
    "G63 AMG",
    "G-Class",
    "G-Wagon",
    "W463",
    "V8 biturbo",
    "4x4",
    "off-road SUV",
    "exploded view",
    "3D car",
    "interactive 3D",
    "car specifications",
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
  icons: { icon: "/logos/mercedes-amg.ico", shortcut: "/logos/mercedes-amg.ico", apple: "/logos/mercedes-amg.ico" },
};

export const viewport: Viewport = {
  // The dark studio
  themeColor: G63.theme.studio.day,
};

// Structured data: this page is an interactive showcase *about* the car —
// not a product listing (nothing is sold, and it isn't Mercedes-Benz's page)
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: TITLE,
  description: DESCRIPTION,
  url: `${SITE_URL}${PATH}`,
  inLanguage: "en",
  author: { "@type": "Person", name: "Marcus Cuong Doan" },
  about: {
    "@type": "Car",
    name: "Mercedes-AMG G 63",
    brand: { "@type": "Brand", name: "Mercedes-AMG" },
    model: "G 63 (W463)",
    vehicleModelDate: "2016",
    driveWheelConfiguration: "https://schema.org/AllWheelDriveConfiguration",
    numberOfDoors: 5,
    seatingCapacity: 5,
    weight: { "@type": "QuantitativeValue", value: 2550, unitCode: "KGM" },
    wheelbase: { "@type": "QuantitativeValue", value: 2850, unitCode: "MMT" },
    fuelCapacity: { "@type": "QuantitativeValue", value: 96, unitCode: "LTR" },
    vehicleEngine: {
      "@type": "EngineSpecification",
      engineDisplacement: { "@type": "QuantitativeValue", value: 5461, unitCode: "CMQ" },
      enginePower: { "@type": "QuantitativeValue", value: 420, unitCode: "KWT" },
      torque: { "@type": "QuantitativeValue", value: 760, unitCode: "NU" },
    },
  },
  isBasedOn: Object.values(G63.sources).map((s) => s.url),
};

export default function G63Layout({ children }: { children: React.ReactNode }) {
  return (
    <ShowroomLayout bike={G63} jsonLd={jsonLd}>
      {children}
    </ShowroomLayout>
  );
}
