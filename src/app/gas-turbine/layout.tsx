import type { Metadata, Viewport } from "next";
import { Barlow_Condensed } from "next/font/google";
import { GAS_TURBINE, plantThemeStyle } from "@/config/gasTurbine";
import { SITE_URL } from "@/config/site";
// The plant page wears the bike showrooms' dark theme
import "@/components/bike-showroom/bike-showroom.css";

const barlow = Barlow_Condensed({
  variable: "--font-at-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  style: ["normal", "italic"],
});

const PATH = GAS_TURBINE.path;
const TITLE = "Station Blackout Gas Turbine — Interactive 3D Simulation";
const DESCRIPTION =
  "Explore a packaged gas-turbine unit — the kind a nuclear plant keeps as its alternate AC source — in 3D: open each part to see what it does, then simulate a station blackout and watch it start, pick up the safety buses inside 10 minutes and carry the shutdown loads. Built with Three.js and React.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "station blackout",
    "alternate AC source",
    "gas turbine generator",
    "nuclear power plant",
    "10 CFR 50.63",
    "emergency power",
    "aeroderivative gas turbine",
    "LM2500",
    "3D simulation",
    "digital twin",
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
  themeColor: GAS_TURBINE.theme.night,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: TITLE,
  description: DESCRIPTION,
  url: `${SITE_URL}${PATH}`,
  inLanguage: "en",
  author: { "@type": "Person", name: "Marcus Cuong Doan" },
  about: { "@type": "Thing", name: "Station blackout alternate AC gas turbine generator" },
  isBasedOn: Object.values(GAS_TURBINE.sources).map((s) => s.url),
};

export default function GasTurbineLayout({ children }: { children: React.ReactNode }) {
  const def = GAS_TURBINE;
  return (
    <div className={`${barlow.variable} theme-at bk-dark`} style={plantThemeStyle(def)}>
      <script
        type="application/ld+json"
        // Static, built from our own config: safe to inline. `<` escaped so
        // no string in it can close the script tag
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {children}
      {/* The 3D view is canvas-only: its content as text for search engines
          and screen readers */}
      <section className="sr-only" aria-label={`${def.title} parts and figures`}>
        <h2>{def.title} at a glance</h2>
        <ul>
          {def.heroSpecs.map(([value, label]) => (
            <li key={label}>
              {value} — {label}
            </li>
          ))}
        </ul>
        {def.parts.map((part) => (
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
          Sources:{" "}
          {Object.values(def.sources).map((s, i) => (
            <span key={s.url}>
              {i > 0 && "; "}
              <a href={s.url}>{s.label}</a>
            </span>
          ))}
          . Part roles are read from the 3D model; the simulation is illustrative.
        </p>
      </section>
    </div>
  );
}
