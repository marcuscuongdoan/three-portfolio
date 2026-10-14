import { useEffect } from "react";
import { LAST_STOP } from "@/components/owl-world/flightPath";
import { flight, useOwlWorld } from "@/components/owl-world/owlStore";

/**
 * The page scrolls through full-height sections, one per stop (plus "hold"
 * screens at the museum and contact); the scroll position is the flight's
 * target. Snapping is done here rather than by CSS: once a scroll gesture
 * starts toward the next section the page carries on there by itself, even
 * if the gesture stops halfway, and one gesture moves at most one section.
 * Nav clicks scroll over time so the whole flight in between plays. Arriving
 * at the last stop — the owl back on its branch — quietly rewinds to the top.
 */

const SNAP = "owl-snap";

let animation: number | null = null;
// Where the page last came to rest (a section top); a touch fling can carry
// one section on from here, no further
let restY = 0;
// When the current scripted scroll started; input right after it (a
// trackpad's inertial wheel events) shouldn't cancel it
let animationStart = 0;
const GRACE_MS = 400;
// Quiet time after the last scroll event that counts as "the gesture ended"
const IDLE_MS = 140;
// A wheel event this long after the last one starts a new gesture
const WHEEL_GAP_MS = 220;
// A wheel delta this much bigger than the one before (and at least this big)
// is a new swipe even without a gap
const FRESH_RATIO = 1.6;
const MIN_FRESH_DELTA = 20;

export const sectionHeight = () => document.getElementById("owl-stop-0")?.offsetHeight || window.innerHeight;
export const stopTop = (stop: number) => document.getElementById(`owl-stop-${stop}`)?.offsetTop ?? stop * sectionHeight();
const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;

/** Every place the page comes to rest: section tops, in order */
function snapPoints() {
  const max = maxScroll();
  return [...document.querySelectorAll<HTMLElement>("[data-snap]")].map((el) => Math.min(el.offsetTop, max)).sort((a, b) => a - b);
}

/**
 * Scroll position → flight progress. A stop followed by a hold screen keeps
 * its stop for that extra height; the last screen before the next stop is
 * the flight there.
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
  useOwlWorld.getState().setNavTarget(null);
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Scripted, eased scroll to `to` over `duration` ms */
function animateScroll(to: number, duration: number, navStop: number | null) {
  stopAnimation();
  const from = window.scrollY;
  if (Math.abs(to - from) < 1) return;
  useOwlWorld.getState().setNavTarget(navStop);
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
      restY = to;
      useOwlWorld.getState().setNavTarget(null);
    }
  };
  animation = requestAnimationFrame(step);
}

/** Scroll to a stop, flying through everything in between */
export function flyTo(stop: number) {
  const to = stopTop(stop);
  const screens = Math.abs(to - window.scrollY) / sectionHeight();
  if (screens < 0.01) return;
  // Paced to the owl's top speed in the scene (MAX_RATE) so it keeps up
  animateScroll(to, reducedMotion() ? 400 : Math.min(11000, Math.max(1800, screens * 2200)), stop);
}

function rewindHome() {
  window.scrollTo({ top: 0, behavior: "instant" });
  restY = 0;
  flight.target = 0;
  flight.current = 0;
  flight.velocity = 0;
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

    // The touch gesture under way
    restY = 0;
    let direction = 0;
    let lastY = window.scrollY;
    let touching = false;
    let idle = 0;
    let lastWheel = 0;
    let lastAbs = 0;

    const nextFrom = (y: number, dir: number) => {
      const points = snapPoints();
      return dir > 0 ? points.find((p) => p > y + 2) : [...points].reverse().find((p) => p < y - 2);
    };

    /** One section up or down, eased */
    const step = (dir: number) => {
      const y = window.scrollY;
      const target = nextFrom(y, dir);
      if (target === undefined) return;
      const screens = Math.abs(target - y) / sectionHeight();
      animateScroll(target, reducedMotion() ? 300 : Math.max(900, screens * 2000), null);
    };

    /** A touch (or scrollbar) gesture is over: carry on to the next section the way it went */
    const settle = () => {
      if (animation !== null || touching) return;
      const y = window.scrollY;
      const points = snapPoints();
      const at = points.find((p) => Math.abs(p - y) < 2);
      if (at !== undefined) {
        restY = at;
        return;
      }
      const target = nextFrom(y, direction >= 0 ? 1 : -1) ?? (direction >= 0 ? points[points.length - 1]! : points[0]!);
      const screens = Math.abs(target - y) / sectionHeight();
      animateScroll(target, reducedMotion() ? 250 : Math.max(650, screens * 2000), null);
    };

    const onScroll = () => {
      const y = window.scrollY;
      flight.target = Math.min(LAST_STOP, Math.max(0, progressAt(y)));
      if (animation !== null) {
        lastY = y;
        return;
      }
      if (Math.abs(y - lastY) > 0.5) direction = Math.sign(y - lastY);
      lastY = y;

      // One gesture moves one section at most: a fling that would carry past
      // the next section (from where the page last rested) stops on it
      const limit = nextFrom(restY, direction);
      if (limit !== undefined && (direction > 0 ? y > limit : y < limit)) {
        window.scrollTo(0, limit);
        lastY = limit;
      }
      window.clearTimeout(idle);
      idle = window.setTimeout(settle, IDLE_MS);
    };

    // Wheels and trackpads: each gesture is exactly one section. Events that
    // keep coming without a pause (a trackpad's momentum) belong to the
    // gesture already handled and are dropped
    const onWheel = (e: WheelEvent) => {
      // Leave alone: sideways scrolling, and anything with its own scroll
      // (a long message in the textarea)
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if ((e.target as Element | null)?.closest?.("textarea, [data-own-scroll]")) return;
      e.preventDefault();
      // Not while a dialog is up
      const ui = useOwlWorld.getState();
      if (ui.pendingApp || ui.cvPrompt) return;
      const now = performance.now();
      const abs = Math.abs(e.deltaY);
      const quiet = now - lastWheel > WHEEL_GAP_MS;
      // Momentum only ever dies away; a sharp rise means a fresh swipe on
      // top of the last one's tail, which would otherwise never go quiet
      const fresh = abs > MIN_FRESH_DELTA && abs > lastAbs * FRESH_RATIO;
      lastWheel = now;
      lastAbs = abs;
      if (abs < 4 || animation !== null || !(quiet || fresh)) return;
      step(Math.sign(e.deltaY));
    };

    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      // Typing in the form, or Space pressing a button, isn't navigation
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (el?.tagName === "BUTTON" && e.key === " ") return;
      const ui = useOwlWorld.getState();
      if (ui.pendingApp || ui.cvPrompt) return;
      const dir = e.key === "ArrowDown" || e.key === "PageDown" || (e.key === " " && !e.shiftKey) ? 1 : e.key === "ArrowUp" || e.key === "PageUp" || (e.key === " " && e.shiftKey) ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      if (animation === null) step(dir);
    };

    // A finger on the screen takes over from a scripted scroll
    const onTouchStart = () => {
      touching = true;
      if (animation !== null && performance.now() - animationStart > GRACE_MS) {
        stopAnimation();
        restY = window.scrollY;
      }
    };
    const onTouchEnd = () => {
      touching = false;
      // Momentum keeps sending scroll events; settle once they stop
      window.clearTimeout(idle);
      idle = window.setTimeout(settle, IDLE_MS);
    };

    let raf = 0;
    const watch = () => {
      if (animation === null && flight.target > LAST_STOP - 0.002 && Math.abs(flight.current - LAST_STOP) < 0.004) {
        rewindHome();
        restY = 0;
        lastY = 0;
      }
      raf = requestAnimationFrame(watch);
    };
    raf = requestAnimationFrame(watch);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKey);
    onScroll();
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(idle);
      stopAnimation();
      html.classList.remove(SNAP);
      window.history.scrollRestoration = "auto";
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
}
