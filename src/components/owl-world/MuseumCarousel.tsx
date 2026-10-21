"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LAB_APPS } from "@/data/apps";
import { useOwlWorld } from "@/components/owl-world/owlStore";

/**
 * The museum's walls can be too small to read at full-arc distance, so a
 * swipeable row of cards names every frame. The centred card's frame is lit
 * (and, on phones, the one the camera closes in on); tapping it opens the app.
 */

// Matches PORTRAIT_ASPECT in flightPath (width / height < 0.9)
const PORTRAIT_QUERY = "(max-aspect-ratio: 9/10)";

export function usePortrait() {
  const subscribe = useCallback((cb: () => void) => {
    const mq = window.matchMedia(PORTRAIT_QUERY);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PORTRAIT_QUERY).matches,
    () => false,
  );
}

export default function MuseumCarousel() {
  const row = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const { setMuseumFocus, setHoveredApp, setPendingApp } = useOwlWorld.getState();

  // Focus the centred card's frame; clear it on the way out
  useEffect(() => {
    const id = LAB_APPS[index]!.id;
    setMuseumFocus(id);
    setHoveredApp(id);
  }, [index, setMuseumFocus, setHoveredApp]);
  useEffect(
    () => () => {
      setMuseumFocus(null);
      setHoveredApp(null);
    },
    [setMuseumFocus, setHoveredApp],
  );

  const onScroll = () => {
    const el = row.current;
    if (!el) return;
    const centre = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    Array.from(el.children).forEach((child, i) => {
      const c = child as HTMLElement;
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - centre);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    if (best !== index) setIndex(best);
  };

  const scrollToCard = (i: number) => {
    const el = row.current;
    const card = el?.children[i] as HTMLElement | undefined;
    if (!el || !card) return;
    el.scrollTo({ left: card.offsetLeft + card.offsetWidth / 2 - el.clientWidth / 2, behavior: "smooth" });
  };

  return (
    <div className="fixed inset-x-0 bottom-3 z-30">
      <div
        ref={row}
        onScroll={onScroll}
        role="list"
        aria-label="3D lab apps"
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-[calc(50%-min(38vw,12rem))] pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        // Sideways swipes browse the cards; they mustn't scroll the page
        style={{ touchAction: "pan-x" }}
      >
        {LAB_APPS.map((app, i) => (
          <div key={app.id} role="listitem" className="w-[76vw] max-w-sm shrink-0 snap-center">
            <button
              type="button"
              onClick={() => (i === index ? setPendingApp(app) : scrollToCard(i))}
              className={`owl-glass block w-full overflow-hidden rounded-3xl text-left transition duration-300 ${i === index ? "scale-100 opacity-100" : "scale-95 opacity-60"}`}
              style={i === index ? { boxShadow: `0 0 0 2px ${app.accent}, 0 18px 40px -18px ${app.accent}` } : undefined}
            >
              {app.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- local preview, already loaded as a texture
                <img src={app.image} alt="" className="aspect-[2/1] w-full object-cover short:landscape:hidden" />
              ) : (
                <div className="flex aspect-[2/1] w-full items-center justify-center text-lg font-bold text-white short:landscape:hidden" style={{ background: `linear-gradient(135deg, #1d1a24, ${app.accent})` }}>
                  {app.name}
                </div>
              )}
              <div className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-moon-50">{app.name}</p>
                  <p className="truncate text-xs text-moon-200">{app.tagline}</p>
                </div>
                <span className="shrink-0 rounded-full bg-lantern px-3 py-1.5 text-xs font-semibold text-ink">Open →</span>
              </div>
            </button>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-center gap-1.5" aria-hidden>
        {LAB_APPS.map((app, i) => (
          <span key={app.id} className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-lantern" : "w-1.5 bg-moon-50/40"}`} />
        ))}
      </div>
    </div>
  );
}
