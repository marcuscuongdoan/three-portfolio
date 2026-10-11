import type { Metadata, Viewport } from "next";
import ShowroomLayout from "@/components/bike-showroom/ShowroomLayout";
import { MT09_SP } from "@/config/mt09";
import { SITE_URL } from "@/config/site";

const PATH = "/mt-09";
const TITLE = "Yamaha MT-09 SP — Interactive 3D Exploded View";
const DESCRIPTION =
  "Take the Yamaha MT-09 SP apart in 3D: explode the 890 cc CP3 hyper naked, open each part for Yamaha's specifications — Öhlins, KYB, Brembo Stylema, 6-axis IMU — switch on the lights and ride it through desert and city. Built with Three.js and React.";

// og:image / twitter:image come from opengraph-image.png and twitter-image.png
// next to this file (Next adds them, with their alt text, automatically)
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "Yamaha MT-09 SP",
    "MT-09",
    "MT-09 SP 2024",
    "hyper naked",
    "CP3 engine",
    "Öhlins",
    "Brembo Stylema",
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
};

export const viewport: Viewport = {
  // The dark graphite studio
  themeColor: MT09_SP.theme.studio.day,
};

// Structured data: this page is an interactive showcase *about* the bike —
// not a product listing (nothing is sold, and it isn't Yamaha's page)
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
    name: "Yamaha MT-09 SP",
    brand: { "@type": "Brand", name: "Yamaha" },
    model: "MT-09 SP",
    vehicleModelDate: "2024",
    color: "Icon Performance",
    weight: { "@type": "QuantitativeValue", value: 194, unitCode: "KGM" },
    vehicleEngine: {
      "@type": "EngineSpecification",
      engineDisplacement: { "@type": "QuantitativeValue", value: 890, unitCode: "CMQ" },
      enginePower: { "@type": "QuantitativeValue", value: 87.5, unitCode: "KWT" },
      torque: { "@type": "QuantitativeValue", value: 93, unitCode: "NU" },
    },
  },
  isBasedOn: Object.values(MT09_SP.sources).map((s) => s.url),
};

export default function Mt09Layout({ children }: { children: React.ReactNode }) {
  return (
    <ShowroomLayout bike={MT09_SP} jsonLd={jsonLd}>
      {children}
    </ShowroomLayout>
  );
}
