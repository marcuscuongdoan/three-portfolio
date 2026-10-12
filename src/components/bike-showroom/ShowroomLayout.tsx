import { Barlow_Condensed } from "next/font/google";
import { type BikeDefinition, showroomThemeStyle } from "@/config/bikeShowroom";
import "./bike-showroom.css";

// Condensed display face for the moto look; exposed through the `font-at` class
const barlow = Barlow_Condensed({
  variable: "--font-at-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  style: ["normal", "italic"],
});

/**
 * Server-rendered shell of a showroom route: font, theme colours, structured
 * data, and — since the 3D view is canvas-only — the bike's content as text
 * for search engines and screen readers (visually hidden).
 */
export default function ShowroomLayout({
  bike,
  jsonLd,
  children,
}: {
  bike: BikeDefinition;
  jsonLd: object;
  children: React.ReactNode;
}) {
  const fullName = `${bike.modelLine} ${bike.title}`;
  return (
    <div
      className={`${barlow.variable} theme-at ${bike.theme.dark ? "bk-dark" : ""}`}
      style={showroomThemeStyle(bike.theme)}
    >
      <script
        type="application/ld+json"
        // Static, built from our own config: safe to inline. `<` escaped so
        // no string in it can close the script tag
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {children}
      <section className="sr-only" aria-label={`${fullName} parts and specifications`}>
        <h2>{fullName} at a glance</h2>
        <ul>
          {bike.heroSpecs.map(([value, label]) => (
            <li key={label}>
              {value} — {label}
            </li>
          ))}
        </ul>
        <h3>Colours</h3>
        <ul>
          {bike.paint.liveries.map((l) => (
            <li key={l.id}>
              {l.name}
              {l.note && ` (${l.note})`}
            </li>
          ))}
        </ul>
        {bike.parts.map((part) => (
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
          {Object.values(bike.sources).map((s, i) => (
            <span key={s.url}>
              {i > 0 && " and "}
              <a href={s.url}>{s.label}</a>
            </span>
          ))}
          . Fan project, not affiliated with {bike.brand}.
          {bike.modelCredit && (
            <>
              {" 3D model: "}
              <a href={bike.modelCredit.url}>
                “{bike.modelCredit.title}” by {bike.modelCredit.author}
              </a>{" "}
              ({bike.modelCredit.license}), modified.
            </>
          )}
        </p>
      </section>
    </div>
  );
}
