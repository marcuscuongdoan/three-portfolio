"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useOwlWorld } from "@/components/owl-world/owlStore";
import { downloadCv } from "@/components/owl-world/Mailbox";
import { CV_FILENAME } from "@/config/site";

/** Asks before the mailbox hands over the CV */
export default function CvModal() {
  const open = useOwlWorld((s) => s.cvPrompt);
  const close = () => useOwlWorld.getState().setCvPrompt(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const download = () => {
    close();
    downloadCv();
  };

  return (
    <AnimatePresence>
      {open && (
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
            aria-labelledby="owl-cv-title"
            aria-describedby="owl-cv-desc"
            className="w-full max-w-sm overflow-hidden rounded-3xl bg-[#141a3c] shadow-2xl"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-2 bg-lantern" />
            <div className="p-6">
              {/* An envelope with the CV peeking out */}
              <div aria-hidden className="mx-auto mb-5 flex h-16 w-20 items-end justify-center rounded-xl bg-[#2f5d8a] shadow-inner">
                <motion.div
                  className="mb-2 h-12 w-14 rounded-md bg-[#f6eedf] p-1.5"
                  initial={{ y: 10 }}
                  animate={{ y: -6 }}
                  transition={{ type: "spring", stiffness: 160, damping: 12, delay: 0.1 }}
                >
                  <div className="h-1 w-8 rounded bg-[#2c2420]/60" />
                  <div className="mt-1 h-1 w-10 rounded bg-[#2c2420]/30" />
                  <div className="mt-1 h-1 w-7 rounded bg-[#2c2420]/30" />
                </motion.div>
              </div>
              <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-lantern">You&apos;ve got mail</p>
              <h2 id="owl-cv-title" className="mt-1 text-center text-2xl font-bold text-moon-50">
                Download my CV?
              </h2>
              <p id="owl-cv-desc" className="mt-2 text-center text-sm text-moon-200">
                Experience, skills and projects in one Word document.
              </p>
              <p className="mt-3 truncate rounded-xl bg-white/5 px-3 py-2 text-center text-xs text-moon-400">{CV_FILENAME}</p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={close}
                  className="min-h-12 flex-1 rounded-2xl border border-white/15 font-semibold text-moon-100 transition hover:bg-white/5"
                >
                  Not now
                </button>
                <button
                  ref={confirmRef}
                  type="button"
                  onClick={download}
                  className="min-h-12 flex-1 rounded-2xl bg-lantern font-semibold text-ink shadow-lg transition hover:bg-lantern-soft active:scale-[0.98]"
                >
                  Download CV ↓
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
