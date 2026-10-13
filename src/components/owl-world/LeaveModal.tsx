"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useOwlWorld } from "@/components/owl-world/owlStore";

/** Asks before leaving the owl's world for an app */
export default function LeaveModal() {
  const app = useOwlWorld((s) => s.pendingApp);
  const close = () => useOwlWorld.getState().setPendingApp(null);
  const router = useRouter();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!app) return;
    // Warm the route so the jump is quick
    if (!app.external) router.prefetch(app.url);
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [app, router]);

  const go = () => {
    if (!app) return;
    close();
    if (app.external) window.open(app.url, "_blank", "noopener,noreferrer");
    else router.push(app.url);
  };

  const host = app?.external ? new URL(app.url).host : null;

  return (
    <AnimatePresence>
      {app && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#05071a]/65 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="owl-leave-title"
            aria-describedby="owl-leave-desc"
            className="w-full max-w-md overflow-hidden rounded-3xl bg-[#141a3c] shadow-2xl"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-2" style={{ background: app.accent }} />
            {app.image && (
              // eslint-disable-next-line @next/next/no-img-element -- small local preview, already loaded as a texture
              <img src={app.image} alt="" className="aspect-[2/1] w-full object-cover" />
            )}
            <div className="p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-lantern">
                {app.external ? "Leaving the nest" : "Another page"}
              </p>
              <h2 id="owl-leave-title" className="mt-1 text-2xl font-bold text-moon-50">
                {app.name}
              </h2>
              <p id="owl-leave-desc" className="mt-2 text-sm text-moon-200">
                {app.external ? (
                  <>
                    This opens <span className="font-semibold text-moon-50">{host}</span> in a new tab. The owl will wait here.
                  </>
                ) : (
                  <>You&apos;re about to leave this page for the {app.name} experience. Your browser&apos;s back button brings you home.</>
                )}
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={close}
                  className="min-h-12 flex-1 rounded-2xl border border-white/15 font-semibold text-moon-100 transition hover:bg-white/5"
                >
                  Stay here
                </button>
                <button
                  ref={confirmRef}
                  type="button"
                  onClick={go}
                  className="min-h-12 flex-1 rounded-2xl bg-lantern font-semibold text-ink shadow-lg transition hover:bg-lantern-soft active:scale-[0.98]"
                >
                  {app.external ? "Open site ↗" : "Go there →"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
