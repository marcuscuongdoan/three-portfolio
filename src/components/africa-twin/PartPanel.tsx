import { BikePart, SOURCES } from "@/config/africaTwin";

interface PartPanelProps {
  part: BikePart;
  index: number;
  total: number;
  onClose: () => void;
  onStep: (delta: number) => void;
}

// Details for the selected part: Honda's figures for it, with sources.
// Mobile: a bottom sheet over the lower half; md and up: a card on the right.
export default function PartPanel({ part, index, total, onClose, onStep }: PartPanelProps) {
  return (
    <aside
      key={part.id}
      className="at-panel-enter at-scroll fixed z-30 inset-x-0 bottom-0 h-[52dvh] overflow-y-auto rounded-t-2xl bg-white/95 shadow-[0_-12px_40px_rgba(15,23,42,0.18)] backdrop-blur-md md:inset-x-auto md:bottom-auto md:right-6 md:top-1/2 md:h-auto md:max-h-[78vh] md:w-[400px] md:-translate-y-1/2 md:rounded-2xl md:shadow-[0_20px_60px_rgba(15,23,42,0.2)] lg:right-10 lg:w-[440px]"
    >
      {/* Tricolour rule */}
      <div className="flex h-1.5 overflow-hidden rounded-t-2xl">
        <span className="flex-1 bg-[#e4002b]" />
        <span className="flex-1 bg-white" />
        <span className="flex-1 bg-[#1f3a93]" />
      </div>

      <div className="p-5 md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-at text-xs font-semibold uppercase tracking-[0.25em] text-[#e4002b]">
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
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#e4002b]" />
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
                href={SOURCES[key].url}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-slate-300 underline-offset-2 hover:text-slate-700"
              >
                {SOURCES[key].label}
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
