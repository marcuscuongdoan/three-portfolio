import { useEffect } from "react";
import { LAST_STOP } from "@/components/owl-world/flightPath";
import { flight, useOwlWorld } from "@/components/owl-world/owlStore";

/**
 * The page scrolls through one full-height snap section per stop; the scroll
 * position is the flight's target. Nav clicks scroll there over time (snap
 * off meanwhile) so the whole flight in between plays. Arriving at the last
 * stop — the owl back on its branch — quietly rewinds the scroll to the top.
 */

const SNAP = "owl-snap";
const NO_SNAP = "owl-nosnap";

let animation: number | null = null;
// When the current nav flight started; input right after a click (a
// trackpad's inertial wheel events) shouldn't cancel it
let animationStart = 0;
const GRACE_MS = 400;
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);

const sectionHeight = () => document.getElementById("owl-stop-0")?.offsetHeight || window.innerHeight;
const stopTop = (stop: number) => document.getElementById(`owl-stop-${stop}`)?.offsetTop ?? stop * sectionHeight();

/**
 * Scroll position → flight progress. A section taller than the screen holds
 * its stop for the extra height; the last screen of each section is the
 * flight to the next stop.
 */
function progressAt(y: number) {
  const h = sectionHeight();
  for (let i = 0; i < LAST_STOP; i++) {
    const next = stopTop(i + 1);
    if (y < next) {
      const holdEnd = Math.max(stopTop(i), next - h);
      return y <= holdEnd ? i : i + (y - holdEnd) / (next - holdEnd);
    }
  }
  return LAST_STOP;
}

function stopAnimation() {
  if (animation === null) return;
  cancelAnimationFrame(animation);
  animation = null;
  document.documentElement.classList.remove(NO_SNAP);
  useOwlWorld.getState().setNavTarget(null);
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Scroll to a stop, flying through everything in between */
export function flyTo(stop: number) {
  stopAnimation();
  const h = sectionHeight();
  const from = window.scrollY;
  const to = stopTop(stop);
  const stops = Math.abs(to - from) / h;
  if (stops < 0.01) return;
  useOwlWorld.getState().setNavTarget(stop);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Paced to the owl's top speed in the scene (MAX_RATE) so it keeps up
  const duration = reduced ? 400 : Math.min(11000, Math.max(1800, stops * 2200));
  document.documentElement.classList.add(NO_SNAP);
  const start = performance.now();
  animationStart = start;
  // performance.now() rather than the rAF timestamp: the two can drift apart
  // when frames are slow, and this must track wall-clock time
  const step = () => {
    const t = Math.min(1, (performance.now() - start) / duration);
    window.scrollTo(0, from + (to - from) * easeInOut(t));
    if (t < 1) animation = requestAnimationFrame(step);
    else {
      animation = null;
      document.documentElement.classList.remove(NO_SNAP);
      useOwlWorld.getState().setNavTarget(null);
    }
  };
  animation = requestAnimationFrame(step);
}

function rewindHome() {
  const html = document.documentElement;
  html.classList.add(NO_SNAP);
  window.scrollTo({ top: 0, behavior: "instant" });
  flight.target = 0;
  flight.current = 0;
  flight.velocity = 0;
  requestAnimationFrame(() => html.classList.remove(NO_SNAP));
}

export function useFlightScroll() {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add(SNAP);
    // A reload mid-page restores the scroll; start the owl there too
    window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    flight.target = 0;
    flight.current = 0;

    const onScroll = () => {
      flight.target = Math.min(LAST_STOP, Math.max(0, progressAt(window.scrollY)));
    };
    // Any input of the user's own takes over from a nav flight
    const onUserInput = (e: Event) => {
      if (animation === null || performance.now() - animationStart < GRACE_MS) return;
      if (e instanceof WheelEvent && Math.abs(e.deltaY) < 2) return;
      if (e instanceof KeyboardEvent && !SCROLL_KEYS.has(e.key)) return;
      stopAnimation();
    };

    let raf = 0;
    const watch = () => {
      if (animation === null && flight.target > LAST_STOP - 0.002 && Math.abs(flight.current - LAST_STOP) < 0.004) {
        rewindHome();
      }
      raf = requestAnimationFrame(watch);
    };
    raf = requestAnimationFrame(watch);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onUserInput, { passive: true });
    window.addEventListener("touchstart", onUserInput, { passive: true });
    window.addEventListener("keydown", onUserInput);
    onScroll();
    return () => {
      cancelAnimationFrame(raf);
      stopAnimation();
      html.classList.remove(SNAP, NO_SNAP);
      window.history.scrollRestoration = "auto";
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onUserInput);
      window.removeEventListener("touchstart", onUserInput);
      window.removeEventListener("keydown", onUserInput);
    };
  }, []);
}
