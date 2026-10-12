import type { PlantDefinition, PlantPart } from "@/config/gasTurbine";

interface PlantPartPanelProps {
  def: PlantDefinition;
  part: PlantPart;
  index: number;
  total: number;
  // What the part is doing in the simulation right now
  status: string;
  running: boolean;
  onClose: () => void;
  onStep: (delta: number) => void;
}

// Details for the open part: what it does, its live state, figures with
// sources. Mobile: a bottom sheet; md and up: a card on the right.
export default function PlantPartPanel({ def, part, index, total, status, running, onClose, onStep }: PlantPartPanelProps) {
  return (
    <aside
      key={part.id}
      className="at-panel at-panel-enter at-scroll fixed z-30 inset-x-0 bottom-0 h-[52dvh] overflow-y-auto rounded-t-2xl bg-white/95 shadow-[0_-12px_40px_rgba(15,23,42,0.18)] backdrop-blur-md md:inset-x-auto md:bottom-auto md:right-6 md:top-1/2 md:h-auto md:max-h-[78vh] md:w-[400px] md:-translate-y-1/2 md:rounded-2xl lg:right-10 lg:w-[440px]"
    >
      <div className="flex h-1.5 overflow-hidden rounded-t-2xl">
        <span className="flex-1 bg-[var(--bk-stripe-1)]" />
        <span className="flex-1 bg-[var(--bk-stripe-2)]" />
        <span className="flex-1 bg-[var(--bk-stripe-3)]" />
      </div>

      <div className="p-5 md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-at text-xs font-semibold uppercase tracking-[0.25em] text-[var(--bk-accent)]">
              {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")} · {part.kicker}
            </p>
            <h2 className="mt-1 font-at text-3xl font-bold uppercase italic leading-none text-slate-900 md:text-4xl">
              {part.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close part details"
            className="shrink-0 rounded-full border border-slate-200 p-2 text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-900"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Live state from the simulation */}
        <div
          className={`mt-4 flex items-start gap-2.5 rounded-lg border px-3 py-2 text-sm ${
            running ? "border-[var(--bk-accent)]/40 bg-[var(--bk-accent)]/10" : "border-slate-200"
          }`}
          aria-live="polite"
        >
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${running ? "animate-pulse bg-[var(--bk-accent)]" : "bg-slate-400"}`}
          />
          <p>
            <span className="font-at font-semibold uppercase tracking-wider text-slate-500">
              {running ? "Live · " : "Standby · "}
            </span>
            <span className="text-slate-900">{status}</span>
          </p>
        </div>

        <p className="mt-4 text-[15px] leading-relaxed text-slate-600">{part.summary}</p>

        <dl className="mt-5 divide-y divide-slate-100 border-y border-slate-100">
          {part.specs.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 py-2.5 text-sm">
              <dt className="text-slate-500">{label}</dt>
              <dd className="font-medium text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>

        {part.notes && (
          <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
            {part.notes.map((note) => (
              <li key={note} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--bk-accent)]" />
                {note}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 text-xs text-slate-400">
          Source:{" "}
          {part.sources.map((key, i) => (
            <span key={key}>
              {i > 0 && " · "}
              <a
                href={def.sources[key]!.url}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-slate-300 underline-offset-2 hover:text-slate-700"
              >
                {def.sources[key]!.label}
              </a>
            </span>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onStep(-1)}
            className="font-at text-sm font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-900"
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={() => onStep(1)}
            className="font-at text-sm font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-900"
          >
            Next →
          </button>
        </div>
      </div>
    </aside>
  );
}
