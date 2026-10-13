"use client";

import { useContactForm } from "@/hooks/useContactForm";

const field =
  "w-full rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-moon-50 placeholder-moon-400/70 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-lantern/70";

export default function ContactCard() {
  const { formData, handleChange, handleSubmit, status, isSending } = useContactForm();

  return (
    <section aria-labelledby="owl-contact-title" className="owl-glass pointer-events-auto w-full max-w-md rounded-3xl p-5 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-lantern">04 · Contact</p>
      <h2 id="owl-contact-title" className="mt-1 text-2xl font-bold text-moon-50 sm:text-3xl">
        Send the owl a letter
      </h2>
      <p className="mt-2 hidden text-sm text-moon-200 sm:block">A project, a question or just hello — it&apos;ll be delivered.</p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3 sm:mt-5">
        <div>
          <label htmlFor="owl-name" className="mb-1 block text-xs font-medium text-moon-100">
            Name <span className="text-red-300">*</span>
          </label>
          <input id="owl-name" name="name" required value={formData.name} onChange={handleChange} placeholder="Your name" className={field} />
        </div>
        <div>
          <label htmlFor="owl-email" className="mb-1 block text-xs font-medium text-moon-100">
            Email <span className="text-moon-400">(optional)</span>
          </label>
          <input id="owl-email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="you@example.com" className={field} />
        </div>
        <div>
          <label htmlFor="owl-content" className="mb-1 block text-xs font-medium text-moon-100">
            Message <span className="text-red-300">*</span>
          </label>
          <textarea id="owl-content" name="content" required rows={3} value={formData.content} onChange={handleChange} placeholder="Your message…" className={`${field} resize-none`} />
        </div>

        {status.type !== "idle" && (
          <p
            role={status.type === "error" ? "alert" : "status"}
            aria-live="polite"
            className={`rounded-xl px-4 py-2.5 text-sm ${
              status.type === "success"
                ? "bg-green-400/15 text-green-200"
                : status.type === "error"
                  ? "bg-red-400/15 text-red-200"
                  : "bg-white/10 text-moon-100"
            }`}
          >
            {status.message}
          </p>
        )}

        <button
          type="submit"
          disabled={isSending}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-lantern font-semibold text-ink shadow-lg transition hover:bg-lantern-soft active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSending ? "Sending…" : "Send message"}
        </button>
      </form>
    </section>
  );
}
