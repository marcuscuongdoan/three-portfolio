"use client";

import { useGLTF } from "@react-three/drei";
import { useWorld3DStore } from "@/store/useWorld3DStore";
import {
  MISS_FORTUNE_MODELS,
  MISS_FORTUNE_SKINS,
  MissFortuneVariant,
} from "@/config/missFortune";

interface MissFortuneSkinPanelProps {
  value: MissFortuneVariant;
  onChange: (variant: MissFortuneVariant) => void;
}

const VARIANTS = Object.keys(MISS_FORTUNE_MODELS) as MissFortuneVariant[];

export default function MissFortuneSkinPanel({
  value,
  onChange,
}: MissFortuneSkinPanelProps) {
  // The current skin stays on screen while the picked one downloads
  const isDownloading = useWorld3DStore((s) => s.isModelSwapping);

  return (
    <div className="fixed z-40 bottom-4 right-4 sm:bottom-auto sm:top-6 sm:right-6">
      <div className="lol-frame px-3 pt-2 pb-2.5">
        <p className="font-lol text-[10px] tracking-[0.3em] uppercase text-lol-gold-200 text-center mb-1.5">
          Gun Goddess · Skins
        </p>
        <div
          role="radiogroup"
          aria-label="Miss Fortune skin"
          className="flex items-start gap-1"
        >
          {VARIANTS.map((variant) => {
            const { label, swatch } = MISS_FORTUNE_SKINS[variant];
            const selected = variant === value;
            const loading = selected && isDownloading;
            return (
              <button
                key={variant}
                type="button"
                role="radio"
                aria-checked={selected}
                // Start downloading the (~12.5MB) model before the click lands
                onPointerEnter={() => useGLTF.preload(MISS_FORTUNE_MODELS[variant])}
                onClick={() => onChange(variant)}
                className="group flex flex-col items-center gap-1 w-14 focus:outline-none"
                style={{ minHeight: "44px" }}
              >
                {/* Gem: swatch inside a rotated gold setting */}
                <span
                  aria-hidden
                  className={`relative w-7 h-7 rotate-45 border-2 transition-all duration-300 ${
                    selected
                      ? "border-lol-gold-100 shadow-[0_0_12px_rgba(200,170,110,0.8)]"
                      : "border-lol-gold-400 group-hover:border-lol-gold-200 group-focus-visible:border-lol-gold-200"
                  }`}
                >
                  <span
                    className={`absolute inset-[3px] ${loading ? "animate-pulse" : ""}`}
                    style={{
                      background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.55), ${swatch} 55%)`,
                    }}
                  />
                </span>
                <span
                  className={`font-lol text-[10px] font-semibold uppercase tracking-wider mt-1 transition-colors ${
                    selected ? "text-lol-gold-100" : "text-lol-grey-100 group-hover:text-lol-gold-200"
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
