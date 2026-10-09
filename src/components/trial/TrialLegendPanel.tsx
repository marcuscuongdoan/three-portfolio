import { Legend } from "@/config/trial";

interface TrialLegendPanelProps {
  legend: Legend;
  skinIndex: number;
  skinLoading: boolean;
  onSkinChange: (index: number) => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="font-lol text-xs tracking-[0.3em] uppercase text-[#f8e7b5]/80">{title}</h3>
      <div className="trial-divider mt-1.5 mb-3" />
      {children}
    </section>
  );
}

// Info for the focused legend: animated thumbnail, skin picker, skin facts,
// lore and abilities
export default function TrialLegendPanel({
  legend,
  skinIndex,
  skinLoading,
  onSkinChange,
}: TrialLegendPanelProps) {
  const { skin } = legend;

  return (
    <aside
      key={legend.id}
      // Mobile: a bottom section sized to TRIAL_MOBILE.panelFraction (56dvh) —
      // the camera frames the legend in the strip above it.
      // sm and up: a floating card on the right.
      className="trial-panel trial-panel-enter trial-scroll fixed z-30 inset-x-0 bottom-0 h-[56dvh] overflow-y-auto rounded-t-[10px] pb-[env(safe-area-inset-bottom)] sm:inset-x-auto sm:right-8 sm:top-1/2 sm:bottom-auto sm:h-auto sm:-translate-y-1/2 sm:w-[400px] sm:rounded-[6px] sm:pb-0 lg:right-[6vw] lg:w-[min(520px,40vw)] sm:max-h-[82vh]"
      style={{ "--trial-accent": legend.accent } as React.CSSProperties}
    >
      {/* Animated thumbnail */}
      <div className="relative aspect-video max-sm:aspect-[21/9] overflow-hidden rounded-t-[9px] sm:rounded-t-[5px] bg-black/40">
        <video
          key={legend.thumbnail.video}
          className="h-full w-full object-cover"
          src={legend.thumbnail.video}
          poster={legend.thumbnail.poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0616] via-transparent to-transparent" />
        <p className="absolute bottom-1.5 right-2.5 text-[10px] text-white/50">
          {legend.thumbnail.credit}
        </p>
      </div>

      <div className="p-5 sm:p-6 pt-3 sm:pt-4">
        <p className="text-[11px] tracking-[0.35em] uppercase text-white/60">{legend.title}</p>
        <h2 className="mt-0.5 font-lol text-3xl sm:text-4xl font-bold trial-gold-text">
          {legend.name}
        </h2>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] uppercase tracking-wider">
          <span className="rounded-sm border border-white/15 bg-white/5 px-2 py-0.5 text-white/80">
            {legend.region}
          </span>
          {legend.roles.map((role) => (
            <span
              key={role}
              className="rounded-sm border px-2 py-0.5"
              style={{ borderColor: `${legend.accent}66`, color: legend.accent }}
            >
              {role}
            </span>
          ))}
        </div>

        <Section title={skin.pickerLabel}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup">
            {legend.skins.map((option, i) => {
              const active = i === skinIndex;
              return (
                <button
                  key={option.modelPath}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onSkinChange(i)}
                  className={`group relative flex flex-col items-center gap-1.5 rounded border px-2 py-2.5 text-center transition-all ${
                    active
                      ? "border-[var(--trial-accent)] bg-white/10 shadow-[0_0_14px_color-mix(in_srgb,var(--trial-accent)_35%,transparent)]"
                      : "border-white/10 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.07]"
                  }`}
                >
                  <span
                    className={`relative h-7 w-7 rounded-full border-2 ${
                      active ? "border-white" : "border-white/30"
                    }`}
                    style={{ background: option.swatch }}
                  >
                    {active && skinLoading && (
                      <span className="absolute -inset-1 rounded-full border-2 border-white/80 border-t-transparent animate-spin" />
                    )}
                  </span>
                  <span className="font-lol text-[13px] font-semibold leading-tight text-[#f8e7b5]">
                    {option.label}
                  </span>
                  <span className="text-[10px] leading-tight text-white/55">{option.caption}</span>
                </button>
              );
            })}
          </div>
          {skinLoading && (
            <p className="mt-2 text-xs text-white/60">Loading {legend.skins[skinIndex]?.label}…</p>
          )}
        </Section>

        <Section title="Skin">
          <p className="font-lol text-lg text-[#f8e7b5]">{skin.name}</p>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
            {[
              ["Rarity", skin.rarity],
              ["Released", skin.released],
              ["Price", skin.price],
            ].map(([label, value]) => (
              <div key={label} className="rounded border border-white/10 bg-white/[0.03] px-2 py-1.5">
                <dt className="text-[10px] uppercase tracking-wider text-white/45">{label}</dt>
                <dd className="mt-0.5 text-white/90">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm leading-relaxed text-white/75">{skin.description}</p>
        </Section>

        <Section title="Lore">
          <p className="text-sm leading-relaxed text-white/75">{legend.lore}</p>
        </Section>

        <Section title="Abilities">
          <ul className="grid gap-1.5">
            {legend.abilities.map((ability) => (
              <li key={ability.key} className="flex items-center gap-3 text-sm">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border font-lol text-xs font-bold"
                  style={{ borderColor: `${legend.accent}88`, color: legend.accent }}
                >
                  {ability.key}
                </span>
                <span className="text-white/85">{ability.name}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </aside>
  );
}
