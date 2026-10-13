"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useProgress } from "@react-three/drei";
import { LAB_APPS, WEB_APPS } from "@/data/apps";
import { LAST_STOP, STOP_INDEX } from "@/components/owl-world/flightPath";
import { useOwlWorld } from "@/components/owl-world/owlStore";
import { flyTo, useFlightScroll } from "@/components/owl-world/useFlightScroll";
import ContactCard from "@/components/owl-world/ContactCard";
import LeaveModal from "@/components/owl-world/LeaveModal";
import CvModal from "@/components/owl-world/CvModal";
import { MailboxTooltip } from "@/components/owl-world/Mailbox";
import MuseumCarousel, { usePortrait } from "@/components/owl-world/MuseumCarousel";
import { useWorld3DStore } from "@/store/useWorld3DStore";
import "@/components/owl-world/owl-world.css";

const OwlScene = dynamic(() => import("@/components/owl-world/OwlScene"), { ssr: false });

// Stops that hold for an extra screen of scroll
const HOLD_STOPS = new Set<number>([STOP_INDEX.museum, STOP_INDEX.contact]);

// The last stop is home again
const uiStop = (s: number | null) => (s === LAST_STOP ? STOP_INDEX.home : s);

const NAV = [
  { label: "Home", section: "home" },
  { label: "Product", section: "product" },
  { label: "Contact", section: "contact" },
] as const;
type Section = (typeof NAV)[number]["section"];

const sectionOf = (stop: number): Section =>
  stop === STOP_INDEX.contact ? "contact" : stop === STOP_INDEX.home || stop === LAST_STOP ? "home" : "product";

function goToSection(section: Section) {
  const at = useOwlWorld.getState().nearestStop;
  if (section === "product") flyTo(STOP_INDEX.museum);
  else if (section === "contact") flyTo(STOP_INDEX.contact);
  // From the museum on, home is ahead: fly the return leg rather than rewind
  else flyTo(at >= STOP_INDEX.museum ? LAST_STOP : STOP_INDEX.home);
}

function TopNav() {
  const nearest = useOwlWorld((s) => s.nearestStop);
  // Where a nav click is heading wins over where the owl is right now, so the
  // menu answers the click at once
  const navTarget = useOwlWorld((s) => s.navTarget);
  const current = sectionOf(navTarget ?? nearest);
  return (
    <header className="fixed inset-x-0 top-0 z-40 pointer-events-none">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 pt-4 sm:px-8 sm:pt-6">
        <button
          type="button"
          onClick={() => goToSection("home")}
          className="pointer-events-auto hidden text-lg font-bold tracking-tight text-moon-50 owl-ink sm:block"
        >
          marcus<span className="text-lantern">.</span>
        </button>
        <nav aria-label="Sections" className="owl-glass pointer-events-auto mx-auto flex rounded-full p-1 sm:mx-0">
          {NAV.map((item) => {
            const active = current === item.section;
            return (
              <button
                key={item.section}
                type="button"
                onClick={() => goToSection(item.section)}
                aria-current={active ? "true" : undefined}
                className={`relative min-h-11 rounded-full px-4 text-sm font-medium transition-colors sm:px-6 ${active ? "text-ink" : "text-moon-200 hover:text-moon-50"}`}
              >
                {active && (
                  <motion.span
                    layoutId="owl-nav-pill"
                    className="absolute inset-0 rounded-full bg-lantern"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <span className="hidden w-[84px] sm:block" aria-hidden />
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
            onClick={() => flyTo(STOP_INDEX.loop)}
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
            onClick={() => flyTo(STOP_INDEX.loop)}
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
  [STOP_INDEX.loop]: {
    kicker: "Taking off",
    title: "One lap around the old tree",
    body: "Then straight down the valley — past everything I've built. Keep scrolling.",
    align: "center",
  },
  [STOP_INDEX.web]: {
    kicker: "01 · Web products",
    title: "Shipped for real users",
    body: "Client and product work in production: concerts, DeFi analytics, AI design tools, on-chain FX. Click a card to visit.",
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
  return (
    <motion.div key={`cap-${stop}`} className="pointer-events-none fixed inset-x-0 z-20" style={center ? { top: "5.5rem" } : { bottom: "2rem" }} {...fade}>
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
      <div className="mx-auto flex min-h-full max-w-7xl items-end justify-end px-4 pb-4 pt-[34svh] sm:px-8 md:items-center md:pb-0 md:pt-24">
        <ContactCard />
      </div>
    </motion.div>
  );
}

function StopDots() {
  const nearest = useOwlWorld((s) => s.nearestStop);
  const at = uiStop(nearest);
  const labels = ["Home", "Take-off", "Web products", "3D Lab", "Museum", "Contact"];
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
  [STOP_INDEX.loop]: "Web products",
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
  const placement = isContact ? "hidden md:flex" : active === STOP_INDEX.museum && portrait ? "hidden" : "flex";
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

  return (
    <main className="relative bg-night">
      <div className="fixed inset-0 z-0">
        <OwlScene />
      </div>

      {/* One full-screen snap section per stop; they only carry the scroll */}
      <div aria-hidden className="relative z-10 pointer-events-none">
        {Array.from({ length: LAST_STOP + 1 }, (_, i) => (
          // The museum and contact stops are two screens tall: they hold for a
          // whole extra screen of scrolling, so landing there doesn't carry on
          // straight into the next leg
          <section key={i} id={`owl-stop-${i}`} className={`${HOLD_STOPS.has(i) ? "h-[200svh]" : "h-svh"} snap-start snap-always`} />
        ))}
      </div>

      <TopNav />
      <StopDots />
      <Overlays />
      <NextStep />
      <MailboxTooltip />
      <LeaveModal />
      <CvModal />
      <Loader />
    </main>
  );
}
