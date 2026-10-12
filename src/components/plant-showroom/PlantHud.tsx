import {
  AMBIENT_C,
  DEADLINE,
  LOAD_STEPS,
  START_PHASES,
  STOP_PHASES,
  formatClock,
  type SimState,
} from "@/components/plant-showroom/plantSim";

const fmt = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function Reading({ label, value, unit, warn }: { label: string; value: string; unit: string; warn?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-widest text-slate-500">{label}</dt>
      <dd className={`font-at text-xl font-bold tabular-nums leading-tight ${warn ? "text-[#ffb347]" : "text-slate-900"}`}>
        {value}
        <span className="ml-1 text-xs font-semibold text-slate-500">{unit}</span>
      </dd>
    </div>
  );
}

/**
 * The control-room view of the run: the plant clock against the 10-minute
 * limit, the start (or stop) sequence, live readings and the load list.
 * `compact`: one line, for phones and while a part panel is open.
 */
export default function PlantHud({ state: s, compact }: { state: SimState; compact: boolean }) {
  const starting = s.mode === "starting" || s.mode === "running";
  const phases = starting ? START_PHASES : STOP_PHASES;
  const current = phases.indexOf(s.phase);
  const busTime = 445;
  const madeIt = starting && s.t >= busTime;

  if (compact) {
    return (
      <div className="at-chrome pointer-events-none flex items-center gap-3 rounded-full border border-white/15 bg-[rgba(12,14,18,0.72)] px-3 py-1.5 text-xs backdrop-blur">
        <span className={`h-2 w-2 rounded-full ${s.busLive ? "bg-[#9d8cff]" : "animate-pulse bg-[var(--bk-accent)]"}`} />
        <span className="font-at font-bold tabular-nums text-slate-900">
          {starting ? "T+" : "R+"}
          {formatClock(s.t)}
        </span>
        <span className="font-at font-semibold uppercase tracking-wider text-slate-600">{s.phase.label}</span>
        <span className="font-at font-bold tabular-nums text-slate-900">{fmt(s.mw, 1)} MW</span>
      </div>
    );
  }

  return (
    <section
      aria-label="Simulation"
      className="at-chrome at-scroll pointer-events-auto w-[320px] overflow-y-auto rounded-2xl border border-white/15 bg-[rgba(12,14,18,0.78)] p-4 backdrop-blur"
    >
      <div className="flex items-baseline justify-between">
        <p className="font-at text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          {starting ? "Since blackout" : "Since grid restored"}
        </p>
        <p className="font-at text-2xl font-extrabold tabular-nums text-slate-900">
          {starting ? "T+" : "R+"}
          {formatClock(s.t)}
        </p>
      </div>

      {starting && (
        <div className="mt-2">
          <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-400/30">
            <div
              className={`h-full ${madeIt ? "bg-[#9d8cff]" : "bg-[var(--bk-accent)]"}`}
              style={{ width: `${Math.min(s.t / DEADLINE, 1) * 100}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {madeIt
              ? `Safety bus live at T+${formatClock(busTime)} — inside the 10-minute limit`
              : "10-minute limit to power the safety buses (10 CFR 50.63)"}
          </p>
        </div>
      )}

      <ol className="mt-3 space-y-1">
        {phases.map((p, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={p.id} className="flex items-start gap-2 text-xs">
              <span
                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                  done ? "bg-[#9d8cff]" : active ? "animate-pulse bg-[var(--bk-accent)]" : "bg-slate-400/40"
                }`}
              />
              <div>
                <p className={`font-at text-sm font-semibold uppercase tracking-wide ${active ? "text-slate-900" : "text-slate-500"}`}>
                  {p.label}
                  <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-500 tabular-nums">
                    {formatClock(p.at)}
                  </span>
                </p>
                {active && <p className="text-slate-600">{p.detail}</p>}
              </div>
            </li>
          );
        })}
      </ol>

      <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2 border-t border-slate-400/30 pt-3">
        <Reading label="Shaft" value={fmt(s.rpm)} unit="rpm" />
        <Reading label="Freq" value={fmt(s.hz, 1)} unit="Hz" />
        <Reading label="Output" value={fmt(s.mw, 1)} unit="MW" />
        <Reading label="Exhaust" value={fmt(s.egt)} unit="°C" warn={s.egt > 600} />
        <Reading label="Fuel" value={fmt(s.fuel * 3.6, 2)} unit="t/h" />
        <Reading label="Air" value={fmt(s.air)} unit="kg/s" />
        <Reading label="Lube oil" value={fmt(s.lubeBar, 1)} unit="bar" />
        <Reading label="Voltage" value={fmt(s.voltage * 100)} unit="%" />
        <Reading label="Battery" value={fmt(s.battery * 100)} unit="%" warn={!s.busLive && s.battery < 0.97} />
      </dl>

      <div className="mt-3 border-t border-slate-400/30 pt-3">
        <p className="font-at text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          Safety bus · {s.busLive ? "live" : "dead"}
        </p>
        <ul className="mt-1.5 space-y-0.5 text-xs">
          {LOAD_STEPS.map(([, label, mw], i) => {
            const on = i < s.loadsOn;
            return (
              <li key={label} className={`flex justify-between gap-2 ${on ? "text-slate-900" : "text-slate-500"}`}>
                <span>
                  {on ? "●" : "○"} {label}
                </span>
                <span className="tabular-nums">{fmt(mw, 1)} MW</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[10px] leading-snug text-slate-500">
          Ambient {AMBIENT_C} °C, wet: anti-icing {s.antiIcing ? "on" : "off"}. Times, loads and readings are
          illustrative, scaled to the LM2500 reference.
        </p>
      </div>
    </section>
  );
}
