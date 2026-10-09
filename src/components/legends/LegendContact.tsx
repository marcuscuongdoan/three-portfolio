"use client";

import { motion } from "framer-motion";
import SectionLayout from "@/components/SectionLayout";
import { LolSectionTitle } from "@/components/legends/LolOrnaments";
import { useCharacterAnimation } from "@/hooks/useCharacterAnimation";
import { useContactForm } from "@/hooks/useContactForm";
import { SECTION_SHOTS } from "@/config/sectionShots";

const STATUS_STYLES = {
  success: "border-lol-blue-200/60 bg-lol-blue-400/20 text-lol-blue-100",
  error: "border-lol-red/60 bg-lol-red/10 text-lol-red",
  loading: "border-lol-gold-400 bg-lol-gold-500/30 text-lol-gold-100",
  idle: "",
};

const labelClass =
  "block font-lol font-semibold uppercase tracking-[0.15em] text-xs text-lol-gold-200 mb-2";
const inputClass = "lol-input px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base";

export default function LegendContact() {
  const { containerRef } = useCharacterAnimation(SECTION_SHOTS.contact);
  const { formData, handleChange, handleSubmit, status, isSending } =
    useContactForm();

  return (
    <SectionLayout
      id="contact"
      ref={containerRef}
      className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12 justify-start items-center"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
        className="w-full max-w-2xl"
      >
        <LolSectionTitle
          eyebrow="Invite to party"
          title="Get In Touch"
          align="left"
          className="mb-6"
        />

        <form onSubmit={handleSubmit} className="lol-frame p-5 sm:p-8 space-y-4 sm:space-y-5">
          <p className="text-sm sm:text-base text-lol-grey-100">
            Have a question or want to work together? Feel free to reach out!
          </p>

          <div>
            <label htmlFor="name" className={labelClass}>
              Name <span className="text-lol-red">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className={inputClass}
              placeholder="Your summoner name"
            />
          </div>

          <div>
            <label htmlFor="email" className={labelClass}>
              Email Address{" "}
              <span className="text-lol-grey-200 normal-case tracking-normal">(Optional)</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={inputClass}
              placeholder="your.email@example.com"
            />
          </div>

          <div>
            <label htmlFor="content" className={labelClass}>
              Message <span className="text-lol-red">*</span>
            </label>
            <textarea
              id="content"
              name="content"
              value={formData.content}
              onChange={handleChange}
              required
              rows={5}
              className={`${inputClass} resize-none`}
              placeholder="Your message..."
            />
          </div>

          {status.type !== "idle" && (
            <motion.div
              role={status.type === "error" ? "alert" : "status"}
              aria-live="polite"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3 sm:p-4 border text-sm ${STATUS_STYLES[status.type]}`}
            >
              {status.message}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={isSending}
            className="lol-button lol-button-primary w-full px-6 py-3 text-sm sm:text-base active:scale-[0.98]"
          >
            {isSending ? "Sending..." : "Send Message"}
          </button>
        </form>
      </motion.div>
    </SectionLayout>
  );
}
