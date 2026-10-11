import type { Metadata, Viewport } from "next";
import { Barlow_Condensed } from "next/font/google";
import { BIKE_PARTS, HERO_SPECS, SOURCES } from "@/config/africaTwin";
import { SITE_URL } from "@/config/site";
import "./africa-twin.css";

// Condensed display face for the moto look; exposed through the `font-at` class
const barlow = Barlow_Condensed({
  variable: "--font-at-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  style: ["normal", "italic"],
});

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
  isBasedOn: Object.values(SOURCES).map((s) => s.url),
};

export default function AfricaTwinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${barlow.variable} theme-at`}>
      <script
        type="application/ld+json"
        // Static, built from our own config: safe to inline. `<` escaped so
        // no string in it can close the script tag
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {children}
      {/* The 3D view is canvas-only: the same content as text, for search
          engines and screen readers (visually hidden) */}
      <section className="sr-only" aria-label="Honda CRF1100L Africa Twin parts and specifications">
        <h2>Honda CRF1100L Africa Twin at a glance</h2>
        <ul>
          {HERO_SPECS.map(([value, label]) => (
            <li key={label}>
              {value} — {label}
            </li>
          ))}
        </ul>
        {BIKE_PARTS.map((part) => (
          <article key={part.id}>
            <h3>
              {part.name}: {part.kicker}
            </h3>
            <p>{part.summary}</p>
            <dl>
              {part.specs.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
        <p>
          Specifications from{" "}
          {Object.values(SOURCES).map((s, i) => (
            <span key={s.url}>
              {i > 0 && " and "}
              <a href={s.url}>{s.label}</a>
            </span>
          ))}
          . Fan project, not affiliated with Honda.
        </p>
      </section>
    </div>
  );
}
