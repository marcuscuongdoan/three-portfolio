"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { EXTRA_APPS, LAB_APPS, ShowcaseApp, WEB_APPS } from "@/data/apps";

const noSubscribe = () => () => {};

const SECTIONS = [
  { title: "Web products", apps: WEB_APPS },
  { title: "3D Lab", apps: LAB_APPS },
  { title: "More on this site", apps: EXTRA_APPS },
];

function Row({ app, current, onPick }: { app: ShowcaseApp; current: boolean; onPick: (app: ShowcaseApp) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(app)}
        aria-current={current ? "page" : undefined}
        className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-white/10 active:scale-[0.98] ${current ? "bg-white/10" : ""}`}
      >
        <span className="relative h-12 w-16 shrink-0 overflow-hidden rounded-xl" style={{ background: app.accent }}>
          {app.image && (
            // eslint-disable-next-line @next/next/no-img-element -- small local thumbnail
            <img src={app.image} alt="" className="h-full w-full object-cover" loading="lazy" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-moon-50">{app.name}</span>
          <span className="block truncate text-sm text-moon-400">{current ? "You are here" : app.tagline}</span>
        </span>
        <span aria-hidden className="pr-1 text-moon-400">
          {app.external ? "↗" : "→"}
        </span>
      </button>
    </li>
  );
}

/** Sheet listing every web product and 3D page: slides up on phones, a centred panel on wider screens */
export function ProjectSheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (app: ShowcaseApp) => void;
}) {
  const pathname = usePathname();
  // Portalled to <body>: the pages' headers animate transforms, which would trap a fixed overlay
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    // Hold the page still under the sheet (the owl's flight is the page scroll)
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      root.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-[#05071a]/60 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          // 3D pages listen for pointers on the window (orbit, intro skip)
          onPointerDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-sheet-title"
            data-own-scroll
            className="max-h-[85svh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl bg-[#141a3c] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 font-sans shadow-2xl sm:rounded-3xl sm:pb-4"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
            <div className="flex items-center justify-between px-2">
              <h2 id="project-sheet-title" className="text-lg font-bold text-moon-50">
                Projects
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-moon-200 hover:bg-white/20"
              >
                ✕
              </button>
            </div>
            {SECTIONS.map((section) => (
              <section key={section.title} className="mt-4">
                <p className="px-2 text-xs font-semibold uppercase tracking-[0.3em] text-lantern">
                  {section.title} <span className="text-moon-400">· {section.apps.length}</span>
                </p>
                <ul className="mt-1">
                  {section.apps.map((app) => (
                    <Row key={app.id} app={app} current={!app.external && pathname === app.url} onPick={onPick} />
                  ))}
                </ul>
              </section>
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * "Projects" button for the project pages: opens the sheet and goes straight
 * to the pick. Styled by the page, so it sits beside that page's own back link
 */
export function ProjectsMenu({ className, children }: { className: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const pick = (app: ShowcaseApp) => {
    setOpen(false);
    if (app.external) window.open(app.url, "_blank", "noopener,noreferrer");
    else if (app.url !== pathname) router.push(app.url);
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        onPointerDown={(e) => e.stopPropagation()}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={className}
      >
        {children ?? "Projects"}
      </button>
      <ProjectSheet open={open} onClose={() => setOpen(false)} onPick={pick} />
    </>
  );
}
