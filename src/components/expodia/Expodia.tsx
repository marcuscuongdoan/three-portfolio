"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Canvas } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import { ProjectsMenu } from "@/components/ProjectSheet";
import { track } from "@/lib/analytics";
import {
  COLOR_SWATCHES,
  OVERVIEW_SHOT,
  SLOT_BY_ID,
  SLOTS,
  TEMPLATES,
  TIER_INFO,
  TIERS,
  fitsSlot,
  slotLabel,
  surfacesOf,
  type BoothColors,
  type Tier,
} from "@/config/expodia";
import ExpodiaScene from "./ExpodiaScene";
import { startPersisting, storageBytes, surfaceAspect, useExpodia, type BoothConfig, type DockTab } from "./store";

// Practical localStorage budget in most browsers (UTF-16 code units)
const STORAGE_BUDGET = 5_000_000;
// Longest side of a stored picture; keeps a full Premium booth near 0.5 MB
const IMAGE_MAX = 512;

const COLOR_KEYS: { key: keyof BoothColors; label: string }[] = [
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "glow", label: "Light strip" },
];

const TABS: { id: DockTab; label: string }[] = [
  { id: "booth", label: "Booth" },
  { id: "expo", label: "Expo" },
  { id: "changes", label: "Changes" },
];

function fmtSize(units: number) {
  return units >= 1e6 ? `${(units / 1e6).toFixed(2)} MB` : `${Math.max(1, Math.round(units / 1e3))} KB`;
}

function timeAgo(at: number, now: number) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(at).toLocaleDateString();
}

// Center-crops to the surface's shape, scales down and re-encodes as JPEG
// (on white, so transparent logos stay readable)
async function prepareImage(file: File, aspect: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  let sw = bitmap.width;
  let sh = bitmap.height;
  if (sw / sh > aspect) sw = sh * aspect;
  else sh = sw / aspect;
  const scale = Math.min(1, IMAGE_MAX / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
      style={{ color: TIER_INFO[tier].color, background: `${TIER_INFO[tier].color}1f` }}
    >
      {tier}
    </span>
  );
}

// ---------------------------------------------------------------- loader

function LoadingOverlay() {
  const { progress, active, total, loaded } = useProgress();
  const [gone, setGone] = useState(false);
  const done = !active && progress >= 100;
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setGone(true), 600);
    return () => clearTimeout(t);
  }, [done]);
  if (gone) return null;
  return (
    <div className={`absolute inset-0 z-30 grid place-items-center bg-[#0b0f17] transition-opacity duration-500 ${done ? "pointer-events-none opacity-0" : ""}`}>
      <div className="w-64 text-center">
        <p className="text-sm text-white/70">Building the expo hall…</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-sky-400 transition-[width]" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-xs tabular-nums text-white/40">
          {Math.round(progress)}% · {loaded}/{total || "…"} files
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- booth tab

function ModelPicker({ slotId, booth }: { slotId: string; booth?: BoothConfig }) {
  const slot = SLOT_BY_ID[slotId]!;
  const currentTier = booth ? TEMPLATES[booth.template].tier : slot.tier;
  // Opens on the booth's tier (or the slot's own for an empty slot) until
  // the visitor picks another tab for this slot
  const [picked, setPicked] = useState<{ slot: string; tier: Tier } | null>(null);
  const tab = picked?.slot === slotId ? picked.tier : currentTier;
  const { place } = useExpodia.getState();

  return (
    <section>
      <h3 className="text-sm font-semibold">{booth ? "Model" : "Choose a booth"}</h3>
      <div role="tablist" className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-white/5 p-1">
        {TIERS.map((t) => {
          const fits = fitsSlot(t, slot.tier);
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              disabled={!fits}
              title={fits ? undefined : `Needs a ${TIER_INFO[t].footprint} m slot`}
              onClick={() => setPicked({ slot: slotId, tier: t })}
              className={`rounded-lg py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-35 ${tab === t ? "bg-white/15 text-white" : "text-white/60 hover:text-white"}`}
            >
              {t}
            </button>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {TIER_INFO[tab].templates.map((id) => {
          const t = TEMPLATES[id];
          const active = booth?.template === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                place(slotId, id);
                track("expodia_booth_placed", { template: id, slot_tier: slot.tier });
              }}
              className={`rounded-xl border p-2.5 text-left transition hover:bg-white/10 ${active ? "border-sky-400/70 bg-sky-400/10" : "border-white/10"}`}
            >
              <span className="block h-8 rounded-lg" style={{ background: `linear-gradient(135deg, ${t.colors.primary}, ${t.colors.primary} 55%, ${t.colors.secondary} 55%)` }} />
              <span className="mt-2 block text-sm font-semibold">{t.name}</span>
              <span className="block text-xs text-white/55">
                {t.products} products · 2 banners{t.video ? " · video" : ""}
              </span>
              <span className={`mt-1 block text-xs font-medium ${active ? "text-sky-300" : "text-white/40"}`}>{active ? "✓ In this slot" : booth ? "Switch to this" : "Place booth"}</span>
            </button>
          );
        })}
      </div>
      {slot.tier !== "Premium" && (
        <p className="mt-2 text-xs text-white/45">{slot.tier === "Basic" ? "Pro and Premium booths need a bigger slot." : "Premium booths need a 13 m slot."}</p>
      )}
    </section>
  );
}

function BoothCustomizer({ slotId, booth }: { slotId: string; booth: BoothConfig }) {
  const { setColor, resetColors, setImage, requestUpload } = useExpodia.getState();
  const surfaces = surfacesOf(booth.template);

  return (
    <>
      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Colours</h3>
          <button type="button" onClick={() => resetColors(slotId)} className="text-xs text-white/50 hover:text-white">
            Reset to default
          </button>
        </div>
        <div className="mt-2 space-y-3">
          {COLOR_KEYS.map(({ key, label }) => (
            <div key={key}>
              <div className="flex items-center gap-2">
                <label className="relative h-6 w-6 shrink-0 cursor-pointer overflow-hidden rounded-md border border-white/20" style={{ background: booth.colors[key] }} title="Custom colour">
                  <input type="color" value={booth.colors[key]} onChange={(e) => setColor(slotId, key, e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
                </label>
                <span className="text-sm text-white/75">{label}</span>
                <span className="ml-auto font-mono text-xs text-white/40">{booth.colors[key]}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`${label} ${c}`}
                    onClick={() => setColor(slotId, key, c)}
                    className={`h-5 w-5 rounded-md border transition hover:scale-110 ${booth.colors[key] === c ? "border-white" : "border-white/15"}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold">Images</h3>
        <p className="mt-0.5 text-xs text-white/45">Pick a local file here, or click a glowing box on the booth. Pictures are cropped to fit and stay in this browser.</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {surfaces.map((s) => {
            const url = booth.images[s.key];
            return (
              <div key={s.key} className="group relative">
                <button
                  type="button"
                  onClick={() => requestUpload(slotId, s.key)}
                  className="grid aspect-square w-full place-items-center overflow-hidden rounded-xl border border-dashed border-white/20 bg-white/5 text-white/40 transition hover:border-sky-400/60 hover:text-sky-300"
                >
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local data URL
                    <img src={url} alt={s.label} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xl leading-none">+</span>
                  )}
                </button>
                <span className="mt-0.5 block truncate text-center text-[11px] text-white/55">{s.label}</span>
                {url && (
                  <button
                    type="button"
                    aria-label={`Remove ${s.label} image`}
                    onClick={() => setImage(slotId, s.key, s.label, null)}
                    className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-[10px] text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function BoothTab({ uploadError }: { uploadError: string | null }) {
  const selected = useExpodia((s) => s.selected);
  const booth = useExpodia((s) => (s.selected ? s.booths[s.selected] : undefined));
  const seeded = useExpodia((s) => s.seeded);
  const { select, remove } = useExpodia.getState();

  if (!selected) {
    return (
      <div className="space-y-3">
        {seeded && (
          <p className="rounded-xl border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-sm text-sky-100">
            First visit: a few sample booths are already open. Make any slot yours — everything is saved in this browser.
          </p>
        )}
        <p className="text-sm text-white/65">Click a slot or booth in the expo to choose its tier and model, paint it and add product images.</p>
        {TIERS.map((tier) => (
          <div key={tier} className="rounded-xl bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <TierBadge tier={tier} />
              <span className="text-xs text-white/50">
                {TIER_INFO[tier].footprint}×{TIER_INFO[tier].footprint} m slot
              </span>
            </div>
            <p className="mt-1.5 text-sm text-white/75">{TIER_INFO[tier].templates.map((id) => TEMPLATES[id].name).join(" · ")}</p>
            <p className="text-xs text-white/45">{TEMPLATES[TIER_INFO[tier].templates[0]].products} product boxes · logo · 2 banners</p>
          </div>
        ))}
      </div>
    );
  }

  const slot = SLOT_BY_ID[selected]!;
  const surfaces = booth ? surfacesOf(booth.template) : [];
  const filled = booth ? surfaces.filter((s) => booth.images[s.key]).length : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            {slotLabel(selected)} <TierBadge tier={slot.tier} />
          </h2>
          <p className="mt-0.5 text-xs text-white/50">
            {slot.footprint}×{slot.footprint} m slot · {booth ? `${TEMPLATES[booth.template].name} · ${filled}/${surfaces.length} images` : "empty"}
          </p>
        </div>
        <button type="button" onClick={() => select(null)} className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-white/60 hover:bg-white/10">
          Deselect
        </button>
      </div>
      <ModelPicker slotId={selected} booth={booth} />
      {booth && <BoothCustomizer slotId={selected} booth={booth} />}
      {uploadError && <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-xs text-rose-200">{uploadError}</p>}
      {booth && (
        <button type="button" onClick={() => remove(selected)} className="w-full rounded-xl border border-white/10 px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10">
          Remove booth
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- expo + changes tabs

function ExpoTab({ onFocus }: { onFocus: (slot: string) => void }) {
  const booths = useExpodia((s) => s.booths);
  const log = useExpodia((s) => s.log);
  const expoName = useExpodia((s) => s.expoName);
  const storageError = useExpodia((s) => s.storageError);
  const selected = useExpodia((s) => s.selected);
  const { setExpoName, randomize, fillAll, clearSlots, resetAll } = useExpodia.getState();
  const used = useMemo(() => storageBytes({ expoName, booths, log }), [expoName, booths, log]);
  const entries = Object.entries(booths).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  const images = entries.reduce((n, [, b]) => n + Object.keys(b.images).length, 0);

  return (
    <div className="space-y-5">
      <div>
        <label className="text-xs uppercase tracking-wider text-white/45" htmlFor="expo-name">
          Expo name
        </label>
        <input
          id="expo-name"
          value={expoName}
          maxLength={40}
          onChange={(e) => setExpoName(e.target.value)}
          onBlur={(e) => !e.target.value.trim() && setExpoName("Expodia")}
          className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-sky-400/60"
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ["Booths", `${entries.length}/${SLOTS.length}`],
          ["Images", String(images)],
          ["Saved", fmtSize(used)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-white/5 px-2 py-2.5">
            <p className="text-lg font-semibold tabular-nums">{v}</p>
            <p className="text-[11px] text-white/45">{k}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {TIERS.map((tier) => {
          const total = SLOTS.filter((s) => s.tier === tier).length;
          const taken = entries.filter(([id]) => SLOT_BY_ID[id]?.tier === tier).length;
          return (
            <div key={tier}>
              <div className="flex justify-between text-xs">
                <span className="text-white/70">
                  {tier} slots <span className="text-white/35">· {TIER_INFO[tier].footprint} m</span>
                </span>
                <span className="tabular-nums text-white/50">
                  {taken}/{total}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full" style={{ width: `${(taken / total) * 100}%`, background: TIER_INFO[tier].color }} />
              </div>
            </div>
          );
        })}
        <div className="flex justify-between pt-1 text-xs text-white/50">
          <span>Browser storage</span>
          <span className="tabular-nums">{fmtSize(used)} of ~5 MB</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <div className={`h-full ${used / STORAGE_BUDGET > 0.85 ? "bg-rose-400" : "bg-white/40"}`} style={{ width: `${Math.min(100, (used / STORAGE_BUDGET) * 100)}%` }} />
        </div>
      </div>
      {storageError && <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-xs text-rose-200">{storageError}</p>}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          // Replaces every booth, so ask first when that would lose pictures
          onClick={() => (images === 0 || window.confirm(`Fill every slot with a random booth? The ${images} images you added will be removed.`)) && fillAll()}
          className="rounded-xl bg-sky-500 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-400"
        >
          Fill every slot
        </button>
        <button
          type="button"
          disabled={entries.length === 0}
          onClick={() => window.confirm(`Remove all ${entries.length} booths from the expo?`) && clearSlots()}
          className="rounded-xl border border-white/10 px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear all slots
        </button>
        <button type="button" onClick={randomize} className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/10">
          Shuffle samples
        </button>
        <button
          type="button"
          onClick={() => window.confirm("Clear every booth, image and change in this expo?") && resetAll()}
          className="rounded-xl border border-white/10 px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10"
        >
          Reset all
        </button>
      </div>

      {entries.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold">Booths</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {entries.map(([id, b]) => (
              <button
                key={id}
                type="button"
                onClick={() => onFocus(id)}
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition hover:bg-white/10 ${selected === id ? "border-sky-400/70 bg-sky-400/10" : "border-white/10"}`}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.colors.primary }} />
                {slotLabel(id)}
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

function ChangesTab({ onFocus }: { onFocus: (slot: string) => void }) {
  const log = useExpodia((s) => s.log);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (log.length === 0) return <p className="text-sm text-white/45">Nothing changed yet.</p>;
  return (
    <ol className="space-y-2">
      {log.map((e) => (
        <li key={e.id} className="text-sm">
          <div className="flex items-baseline justify-between gap-2">
            {e.slot && SLOT_BY_ID[e.slot] ? (
              <button type="button" onClick={() => onFocus(e.slot)} className="font-medium hover:underline" style={{ color: TIER_INFO[SLOT_BY_ID[e.slot]!.tier].color }}>
                {slotLabel(e.slot)}
              </button>
            ) : (
              <span className="font-medium text-white/60">Expo</span>
            )}
            <span className="shrink-0 text-xs text-white/35">{timeAgo(e.at, now)}</span>
          </div>
          <p className="text-white/75">{e.text}</p>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------- dock

// All settings live in one floating panel over the full-screen scene: a
// side dock on desktop, a bottom sheet on phones, collapsible on both
function Dock({ uploadError, onFocus }: { uploadError: string | null; onFocus: (slot: string) => void }) {
  const open = useExpodia((s) => s.dockOpen);
  const tab = useExpodia((s) => s.dockTab);
  const selected = useExpodia((s) => s.selected);
  const changes = useExpodia((s) => s.log.length);
  const { setDock } = useExpodia.getState();

  return (
    <>
      <aside
        aria-hidden={!open}
        inert={!open}
        className={`pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex max-h-[70dvh] flex-col rounded-t-2xl border border-white/10 bg-[#0d1320]/85 text-white shadow-2xl backdrop-blur-md transition-transform duration-300 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-18 sm:max-h-none sm:w-[24rem] sm:rounded-2xl ${
          open ? "translate-x-0 translate-y-0" : "translate-y-[calc(100%+1rem)] sm:translate-x-[calc(100%+1rem)] sm:translate-y-0"
        }`}
      >
        <div className="flex items-center gap-2 border-b border-white/10 p-2">
          <div role="tablist" className="grid flex-1 grid-cols-3 gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setDock(true, t.id)}
                className={`truncate rounded-lg px-1 py-1.5 text-sm font-medium transition ${tab === t.id ? "bg-white/15 text-white" : "text-white/55 hover:text-white"}`}
              >
                {t.label}
                {t.id === "booth" && selected && <span className="ml-1 text-xs text-white/45">{slotLabel(selected).split(" ")[1]}</span>}
                {t.id === "changes" && changes > 0 && <span className="ml-1 text-xs text-white/45">{changes}</span>}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setDock(false)}
            aria-label="Collapse panel"
            title="Collapse (Esc)"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4 rotate-90 sm:rotate-0" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          {tab === "booth" && <BoothTab uploadError={uploadError} />}
          {tab === "expo" && <ExpoTab onFocus={onFocus} />}
          {tab === "changes" && <ChangesTab onFocus={onFocus} />}
        </div>
      </aside>

      {!open && (
        <button
          type="button"
          onClick={() => setDock(true)}
          className="pointer-events-auto absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-full border border-white/15 bg-[#0d1320]/85 px-4 py-2 text-sm font-medium text-white shadow-xl backdrop-blur-md hover:bg-white/10 sm:bottom-auto sm:top-18"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path d="M2 4h7M12 4h2M2 12h2M7 12h7M10.5 2.5v3M5.5 10.5v3" strokeLinecap="round" />
          </svg>
          Customize
          {selected && <span className="text-xs text-white/50">{slotLabel(selected)}</span>}
        </button>
      )}
    </>
  );
}

// ---------------------------------------------------------------- page

export default function Expodia() {
  const hydrated = useExpodia((s) => s.hydrated);
  const expoName = useExpodia((s) => s.expoName);
  const count = useExpodia((s) => Object.keys(s.booths).length);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<{ slot: string; surface: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    const st = useExpodia.getState();
    st.hydrate();
    // Phones start with the whole scene in view
    if (window.matchMedia("(max-width: 640px)").matches) st.setDock(false);
    return startPersisting();
  }, []);

  // Opened straight from the store change so it still counts as part of the
  // click (browsers only open file pickers on a user gesture)
  useEffect(
    () =>
      useExpodia.subscribe((s, prev) => {
        if (!s.uploadRequest || s.uploadRequest === prev.uploadRequest) return;
        uploadTarget.current = { slot: s.uploadRequest.slot, surface: s.uploadRequest.surface };
        fileInput.current?.click();
      }),
    [],
  );

  // Esc toggles the dock (but not while typing the expo name)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || (e.target as HTMLElement | null)?.tagName === "INPUT") return;
      const st = useExpodia.getState();
      st.setDock(!st.dockOpen);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const target = uploadTarget.current;
    if (!file || !target) return;
    const b = useExpodia.getState().booths[target.slot];
    if (!b) return;
    const surface = surfacesOf(b.template).find((s) => s.key === target.surface);
    try {
      const url = await prepareImage(file, surfaceAspect[b.template]?.[target.surface] ?? 1);
      useExpodia.getState().setImage(target.slot, target.surface, surface?.label ?? target.surface, url);
      setUploadError(null);
      track("expodia_image_added", { surface: target.surface.replace(/_\d+$/, "") });
    } catch {
      setUploadError(`Couldn't read “${file.name}”. Try a JPG, PNG or WebP image.`);
    }
  };

  const focusSlot = (slot: string) => useExpodia.getState().select(slot, { panel: false });

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#0b0f17] text-white">
      <Canvas shadows camera={{ position: OVERVIEW_SHOT.position, fov: 50, near: 0.3, far: 5000 }} dpr={[1, 2]} gl={{ antialias: false, powerPreference: "high-performance" }}>
        <ExpodiaScene />
      </Canvas>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 bg-linear-to-b from-black/55 to-transparent p-4 pb-10 sm:p-6 sm:pb-14">
        <div className="min-w-0">
          <h1 className="line-clamp-2 wrap-break-word text-[2.5rem] font-black leading-[0.95] tracking-tight drop-shadow sm:text-6xl">{expoName || "Expodia"}</h1>
          <p className="mt-2 text-sm text-white/75">
            Virtual expo · {hydrated ? `${count} of ${SLOTS.length} booths open` : `${SLOTS.length} slots`}
          </p>
        </div>
        <div className="pointer-events-auto flex shrink-0 gap-2">
          <Link href="/" className="rounded-full border border-white/15 bg-[#0d1320]/80 px-3 py-1.5 text-xs backdrop-blur-md hover:bg-white/10">
            ← Home
          </Link>
          <ProjectsMenu className="rounded-full border border-white/15 bg-[#0d1320]/80 px-3 py-1.5 text-xs backdrop-blur-md hover:bg-white/10">Projects</ProjectsMenu>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex gap-2 text-xs text-white/70">
        <button
          type="button"
          onClick={() => {
            useExpodia.getState().select(null);
            useExpodia.getState().fly(OVERVIEW_SHOT);
          }}
          className="pointer-events-auto rounded-full border border-white/15 bg-[#0d1320]/80 px-3 py-1.5 text-white backdrop-blur-md hover:bg-white/10"
        >
          Overview
        </button>
        {["Drag to orbit", "Right-drag to pan", "Scroll to zoom", "Click a slot"].map((h) => (
          <span key={h} className="hidden rounded-full bg-black/45 px-2.5 py-1.5 backdrop-blur lg:inline">
            {h}
          </span>
        ))}
      </div>

      <Dock uploadError={uploadError} onFocus={focusSlot} />
      <LoadingOverlay />

      <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </main>
  );
}
