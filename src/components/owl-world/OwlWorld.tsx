"use client";

import { Fragment, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useGLTF, useProgress } from "@react-three/drei";
import { LAB_APPS, WEB_APPS } from "@/data/apps";
import { HOLD_STOPS, LAST_STOP, STOP_INDEX } from "@/components/owl-world/flightPath";
import { useOwlWorld } from "@/components/owl-world/owlStore";
import { holdState, landed, pillTurn, TransitPill, transitState } from "@/components/owl-world/transit";
import { flyTo, useFlightScroll } from "@/components/owl-world/useFlightScroll";
import ContactCard from "@/components/owl-world/ContactCard";
import LeaveModal from "@/components/owl-world/LeaveModal";
import CvModal from "@/components/owl-world/CvModal";
import { MailboxTooltip } from "@/components/owl-world/Mailbox";
import MuseumCarousel, { usePortrait } from "@/components/owl-world/MuseumCarousel";
import SceneControls from "@/components/owl-world/SceneControls";
import { OWL_FULL_URL, OWL_LITE_URL, savedHighQuality } from "@/components/owl-world/quality";
import { useWorld3DStore } from "@/store/useWorld3DStore";
import "@/components/owl-world/owl-world.css";

const OwlScene = dynamic(() => import("@/components/owl-world/OwlScene"), { ssr: false });


// The last stop is home again
const uiStop = (s: number | null) => (s === LAST_STOP ? STOP_INDEX.home : s);

/** Home from anywhere: from the museum on, home is ahead, so fly the return leg rather than rewind */
function goHome() {
  const at = useOwlWorld.getState().nearestStop;
  flyTo(at >= STOP_INDEX.museum ? LAST_STOP : STOP_INDEX.home);
}

function TopNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 pointer-events-none">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 pt-4 sm:gap-3 sm:px-8 sm:pt-6">
        <button
          type="button"
          onClick={goHome}
          className="pointer-events-auto hidden text-lg font-bold tracking-tight text-moon-50 owl-ink sm:block"
        >
          marcus<span className="text-lantern">.</span>
        </button>
        {/* Pushed right on phones too, where the name is hidden */}
        <div className="ml-auto flex shrink-0 justify-end sm:min-w-[84px]">
          <SceneControls />
        </div>
      </div>
    </header>
  );
}

const MENU = [
  { n: "01", title: "Web products", sub: `${WEB_APPS.length} shipped builds`, stop: STOP_INDEX.web },
  { n: "02", title: "3D Lab", sub: `${LAB_APPS.length} interactive experiments`, stop: STOP_INDEX.lab },
  { n: "03", title: "The Museum", sub: "The 3D lab, hung on the walls", stop: STOP_INDEX.museum },
  { n: "04", title: "Contact", sub: "Send the owl a message", stop: STOP_INDEX.contact },
];

const fade = {
  initial: { opacity: 0, y: 18, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -10, filter: "blur(6px)" },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
};

function HomePanel() {
  return (
    <motion.div key="home" className="pointer-events-none fixed inset-0 z-20" {...fade}>
      <div className="mx-auto flex h-full max-w-7xl flex-col justify-end gap-6 px-4 pb-8 sm:px-8 sm:pb-12 md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl text-moon-50 owl-ink">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-lantern">Welcome to the nest</p>
          <h1 className="text-4xl font-bold leading-[1.05] sm:text-6xl lg:text-7xl">
            <span className="block">Hi, I&apos;m Cuong</span>
            <span className="block">
              <span className="align-middle text-2xl font-semibold text-lantern sm:text-4xl">aka </span>
              Marcus
            </span>
          </h1>
          <p className="mt-4 max-w-md text-base text-moon-200 sm:text-lg">
            Fullstack developer with a frontend focus. I build fast, interactive web apps with React, Next.js and Three.js.
          </p>
          <button
            type="button"
            onClick={() => flyTo(STOP_INDEX.web)}
            className="pointer-events-auto mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-lantern px-6 font-semibold text-ink shadow-lg transition hover:bg-lantern-soft active:scale-95 md:hidden"
          >
            Start the flight <span aria-hidden>→</span>
          </button>
        </div>

        <nav
          aria-label="Tour"
          className="owl-glass pointer-events-auto hidden w-[340px] self-center rounded-3xl p-5 md:mb-16 md:block"
        >
          <p className="px-2 text-xs font-semibold uppercase tracking-[0.3em] text-moon-400">The tour</p>
          <ol className="mt-3 space-y-1">
            {MENU.map((m) => (
              <li key={m.n}>
                <button
                  type="button"
                  onClick={() => flyTo(m.stop)}
                  className="group flex w-full items-center gap-4 rounded-2xl px-2 py-2.5 text-left transition hover:bg-white/10"
                >
                  <span className="text-sm font-semibold tabular-nums text-lantern">{m.n}</span>
                  <span className="flex-1">
                    <span className="block font-semibold text-moon-50">{m.title}</span>
                    <span className="block text-sm text-moon-400">{m.sub}</span>
                  </span>
                  <span aria-hidden className="text-moon-400 transition group-hover:translate-x-1 group-hover:text-moon-50">
                    →
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => flyTo(STOP_INDEX.web)}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-lantern font-semibold text-ink shadow-lg transition hover:bg-lantern-soft active:scale-[0.98]"
          >
            Start the flight <span aria-hidden>→</span>
          </button>
          <p className="mt-3 text-center text-xs text-moon-400">or just scroll</p>
          {/* The mailbox in the garden hands out the CV; this is the same for
              keyboard and screen-reader users */}
          <button
            type="button"
            onClick={() => useOwlWorld.getState().setCvPrompt(true)}
            className="sr-only focus:not-sr-only focus:mt-3 focus:block focus:w-full focus:rounded-xl focus:text-center focus:text-sm focus:text-lantern focus:underline"
          >
            Download my CV
          </button>
        </nav>
      </div>
    </motion.div>
  );
}

const CAPTIONS: Record<number, { kicker: string; title: string; body: string; align: "left" | "center" }> = {
  [STOP_INDEX.web]: {
    kicker: "01 · Web products",
    title: "Shipped for real users",
    body: "Client and product work in production: DeFi analytics, AI design tools, a game studio, a mental well-being community. Click a card to visit.",
    align: "left",
  },
  [STOP_INDEX.lab]: {
    kicker: "02 · 3D Lab",
    title: "Experiments that live on this site",
    body: "Exploded-view showrooms, a power-plant simulation and a League-style camp — all Three.js and React.",
    align: "left",
  },
  [STOP_INDEX.museum]: {
    kicker: "03 · The Museum",
    title: "The 3D lab, on three walls",
    body: "Every experiment that lives on this site. Hover a frame to light it up, click to step inside.",
    align: "center",
  },
};

function Caption({ stop }: { stop: number }) {
  const c = CAPTIONS[stop]!;
  const center = c.align === "center";
  // Centred captions hang below the scroll hint and transit pill up top
  return (
    <motion.div key={`cap-${stop}`} className={`pointer-events-none fixed inset-x-0 z-20 ${center ? "" : "bottom-24 md:bottom-8"}`} style={center ? { top: "6.5rem" } : undefined} {...fade}>
      <div className={`mx-auto max-w-7xl px-4 sm:px-8 ${center ? "text-center" : ""}`}>
        <div className={`owl-glass inline-block max-w-lg rounded-3xl px-6 py-5 text-left ${center ? "text-center" : ""}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-lantern">{c.kicker}</p>
          <h2 className="mt-1 text-2xl font-bold text-moon-50 sm:text-3xl">{c.title}</h2>
          <p className="mt-2 text-sm text-moon-200 sm:text-base">{c.body}</p>
        </div>
      </div>
    </motion.div>
  );
}

// Stays mounted for the whole visit so a half-written message survives a trip
// home and back; hidden (and inert) away from the contact stop
function ContactPanel({ visible }: { visible: boolean }) {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-20 overflow-y-auto"
      initial={false}
      animate={visible ? fade.animate : fade.initial}
      transition={fade.transition}
      inert={!visible}
      aria-hidden={!visible}
    >
      <div className="mx-auto flex min-h-full max-w-7xl items-end justify-end px-4 pb-4 pt-[34svh] short:pt-24 sm:px-8 md:items-center md:pb-0 md:pt-24 short:md:pt-20">
        <ContactCard />
      </div>
    </motion.div>
  );
}

function StopDots() {
  const nearest = useOwlWorld((s) => s.nearestStop);
  const at = uiStop(nearest);
  const labels = ["Home", "Web products", "3D Lab", "Museum", "Contact"];
  return (
    <nav aria-label="Flight progress" className="fixed left-3 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2.5 sm:flex">
      {labels.map((label, i) => (
        <button
          key={label}
          type="button"
          onClick={() => flyTo(i)}
          aria-label={label}
          aria-current={at === i ? "step" : undefined}
          className="group flex h-6 items-center gap-2"
        >
          <span className={`block rounded-full transition-all ${at === i ? "h-5 w-1.5 bg-moon-50" : "h-1.5 w-1.5 bg-moon-50/35 group-hover:bg-moon-50/70"}`} />
          <span className="text-xs font-medium text-moon-100 opacity-0 transition group-hover:opacity-100 owl-ink">{label}</span>
        </button>
      ))}
    </nav>
  );
}

// Where "Next" goes from each stop
const NEXT_LABEL: Record<number, string> = {
  [STOP_INDEX.web]: "3D Lab",
  [STOP_INDEX.lab]: "The Museum",
  [STOP_INDEX.museum]: "Contact",
  [STOP_INDEX.contact]: "Fly home",
};

/** A button to the next stop, for those who'd rather click than scroll */
function NextStep() {
  const active = uiStop(useOwlWorld((s) => s.activeStop));
  const portrait = usePortrait();
  const label = active !== null ? NEXT_LABEL[active] : undefined;
  const isContact = active === STOP_INDEX.contact;
  // The bottom of a phone screen is taken by the contact form / museum cards
  const placement = isContact ? "hidden md:flex short:landscape:hidden" : active === STOP_INDEX.museum && portrait ? "hidden" : "flex";
  return (
    <AnimatePresence>
      {label && (
        <motion.button
          key={label}
          type="button"
          onClick={() => flyTo(active! + 1)}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          // On phones the contact form fills the bottom; the button would sit on it
          className={`owl-glass group fixed bottom-4 right-4 z-30 min-h-12 items-center gap-3 rounded-full py-2 pl-5 pr-2 text-left sm:bottom-6 sm:right-6 ${placement}`}
        >
          <span className="leading-tight">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.3em] text-lantern">{isContact ? "Back to the nest" : "Next"}</span>
            <span className="block text-sm font-semibold text-moon-50">{label}</span>
          </span>
          <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-lantern text-ink transition group-hover:translate-x-0.5 group-active:scale-95">
            <motion.span animate={{ x: [0, 3, 0] }} transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}>
              →
            </motion.span>
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

// Stop names in flight order; scrolling on from contact flies home
const SECTION_NAMES = ["Home", "Web products", "3D Lab", "The Museum", "Contact"];

/**
 * The owl is at rest (not flying, not scrolled into a hold screen) and the
 * transit pill has faded right out, so the hint can have its spot
 */
function usePillGone() {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setGone((!transitState().moving || landed()) && !holdState() && pillTurn.shown < 0.03);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return gone;
}

/** One way to scroll: the gesture (which differs for mouse and touch) and where it goes */
function HintRow({ down, to }: { down: boolean; to: string }) {
  // A finger swipes the opposite way to a wheel
  const wheel = down ? "↓" : "↑";
  const finger = down ? "↑" : "↓";
  return (
    <>
      <motion.span
        className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs text-lantern"
        animate={{ y: down ? [0, 2, 0] : [0, -2, 0] }}
        transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
      >
        <span className="pointer-coarse:hidden">{wheel}</span>
        <span className="hidden pointer-coarse:inline">{finger}</span>
      </motion.span>
      <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.25em] text-lantern">
        <span className="pointer-coarse:hidden">{down ? "Scroll down" : "Scroll up"}</span>
        <span className="hidden pointer-coarse:inline">{down ? "Swipe up" : "Swipe down"}</span>
      </span>
      <span className="whitespace-nowrap text-sm font-semibold text-moon-50">{to}</span>
    </>
  );
}

/**
 * Whenever the owl is resting at a stop: where scrolling on and scrolling
 * back go. Up top in the transit pill's spot (empty while resting), the
 * two taking turns; on phones a little left of centre to clear the settings
 * button
 */
function ScrollHint() {
  const raw = useOwlWorld((s) => s.activeStop);
  const active = raw === LAST_STOP ? null : raw;
  const busy = useOwlWorld((s) => !s.loaded || s.navTarget !== null || !!s.pendingApp || s.cvPrompt);
  const pillGone = usePillGone();
  const resting = active !== null && !busy && pillGone ? active : null;
  // A short beat after landing, so a stop the owl only grazes doesn't flash it
  const [ready, setReady] = useState<number | null>(null);
  useEffect(() => {
    if (resting === null) return;
    const t = window.setTimeout(() => setReady(resting), 250);
    return () => window.clearTimeout(t);
  }, [resting]);
  const shown = resting !== null && ready === resting ? resting : null;
  // Hold the pill back until the hint has finished leaving (onExitComplete)
  useEffect(() => {
    if (shown !== null) pillTurn.hintUp = true;
  }, [shown]);
  useEffect(() => () => void (pillTurn.hintUp = false), []);

  const isContact = active === STOP_INDEX.contact;
  // A phone on its side has no room for it beside the contact form
  const placement = `left-[calc(50%-1.75rem)] top-4 -translate-x-1/2 sm:left-1/2 sm:top-6 ${isContact ? "short:landscape:hidden" : ""}`;
  return (
    <div aria-hidden className={`pointer-events-none fixed z-30 ${placement}`}>
      <AnimatePresence onExitComplete={() => (pillTurn.hintUp = false)}>
        {shown !== null && (
          <motion.div
            key={shown}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } }}
            // Out quickly: the pill is waiting on it
            exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
            className="owl-glass relative grid grid-cols-[auto_auto_1fr] items-center gap-x-2.5 gap-y-1.5 rounded-2xl py-2 pl-2.5 pr-4"
          >
            <HintRow down to={SECTION_NAMES[shown + 1] ?? "Home"} />
            {shown > 0 && <HintRow down={false} to={SECTION_NAMES[shown - 1]!} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Loader() {
  const { progress } = useProgress();
  const loaded = useOwlWorld((s) => s.loaded);
  return (
    <AnimatePresence>
      {!loaded && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-night"
          exit={{ opacity: 0, transition: { duration: 0.8 } }}
          role="status"
          aria-live="polite"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-moon-400">Waking the owl</p>
          <div className="h-1 w-56 overflow-hidden rounded-full bg-white/10">
            <motion.div className="h-full bg-lantern" animate={{ width: `${Math.max(4, progress)}%` }} transition={{ ease: "easeOut" }} />
          </div>
          <p className="text-sm tabular-nums text-moon-200">{Math.round(progress)}%</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// The frames are canvas-only; keyboard and screen-reader users get the same
// apps as a list of buttons (visible when focused)
function MuseumIndex() {
  const setPendingApp = useOwlWorld((s) => s.setPendingApp);
  return (
    <nav aria-label="Apps in the museum" className="sr-only focus-within:not-sr-only focus-within:fixed focus-within:bottom-4 focus-within:left-1/2 focus-within:z-30 focus-within:-translate-x-1/2">
      <ul className="owl-glass flex max-w-[90vw] flex-wrap justify-center gap-2 rounded-3xl p-3">
        {LAB_APPS.map((app) => (
          <li key={app.id}>
            <button
              type="button"
              onClick={() => setPendingApp(app)}
              className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-moon-50 focus:outline-none focus:ring-2 focus:ring-lantern"
            >
              {app.name}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Overlays() {
  const active = uiStop(useOwlWorld((s) => s.activeStop));
  const portrait = usePortrait();
  return (
    <>
      <AnimatePresence mode="wait">
        {active === STOP_INDEX.home && <HomePanel key="home" />}
        {/* On phones the museum carousel says it all; the caption would cover the frame */}
        {active !== null && CAPTIONS[active] && !(portrait && active === STOP_INDEX.museum) && <Caption key={`cap-${active}`} stop={active} />}
      </AnimatePresence>
      <ContactPanel visible={active === STOP_INDEX.contact} />
      {active === STOP_INDEX.museum && <MuseumIndex />}
      {active === STOP_INDEX.museum && portrait && <MuseumCarousel />}
    </>
  );
}

export default function OwlWorld() {
  useFlightScroll();

  // The contact form asks the "world" to celebrate a sent message
  useEffect(() => {
    const store = useWorld3DStore.getState();
    const previous = store.playCharacterAnimation;
    store.setPlayCharacterAnimation(() => {
      useOwlWorld.getState().doCheer();
      return true;
    });
    return () => useWorld3DStore.getState().setPlayCharacterAnimation(previous);
  }, []);

  // The scene waits for the saved quality setting, and starts over when it changes
  const highQuality = useOwlWorld((s) => s.highQuality);
  useEffect(() => {
    const high = savedHighQuality();
    // Start on the owl while the scene's code loads; only the one this setting uses
    useGLTF.preload(high ? OWL_FULL_URL : OWL_LITE_URL);
    useOwlWorld.getState().setHighQuality(high);
  }, []);

  return (
    <main className="relative bg-night">
      <div className="fixed inset-0 z-0">
        {highQuality !== null && <OwlScene key={highQuality ? "high" : "auto"} high={highQuality} />}
      </div>

      {/* One full-screen snap section per stop; they only carry the scroll.
          The last is a "large viewport" screen tall so a phone can always
          scroll all the way to it, whatever its address bar is doing */}
      <div aria-hidden className="relative z-10 pointer-events-none">
        {Array.from({ length: LAST_STOP + 1 }, (_, i) => (
          <Fragment key={i}>
            <section data-snap id={`owl-stop-${i}`} className={i === LAST_STOP ? "h-lvh" : "h-svh"} />
            {/* The museum and contact stops hold for an extra screen of
                scrolling, so landing there doesn't carry straight on. It is
                its own snap point: inside one tall section a phone's fling
                would sail right through */}
            {HOLD_STOPS.has(i) && <section data-snap className="h-svh" />}
          </Fragment>
        ))}
      </div>

      <TopNav />
      <StopDots />
      <Overlays />
      <NextStep />
      <ScrollHint />
      <TransitPill />
      <MailboxTooltip />
      <LeaveModal />
      <CvModal />
      <Loader />
    </main>
  );
}
