"use client";

import { useState, useOptimistic, useTransition } from "react";
import { motion } from "framer-motion";
import SectionLayout from "@/components/SectionLayout";
import { useCharacterAnimation } from "@/hooks/useCharacterAnimation";
import { useWorld3DStore } from "@/store/useWorld3DStore";

type FormStatus = {
  type: "idle" | "loading" | "success" | "error";
  message: string;
};

export default function Contact() {
  const { playCharacterAnimation } = useWorld3DStore();
  const [isPending, startTransition] = useTransition();
  
  // Use custom animation hook
  const { containerRef } = useCharacterAnimation({
    animation: {
      name: 'typing',
      loop: true,
      fadeTime: 0.5,
      lookAtCamera: true,
    },
    camera: {
      position: { x: 0.5, y: 1, z: 0.75 },
      lookAt: { x: -1.5, y: 2, z: 0 },
      duration: 1500,
    },
  });

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    content: "",
  });
  
  const [status, setStatus] = useState<FormStatus>({
    type: "idle",
    message: "",
  });

  // Optimistic status for immediate UI feedback
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(
    status,
    (_state, newStatus: FormStatus) => newStatus
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.name.trim() || !formData.content.trim()) {
      setStatus({
        type: "error",
        message: "Please fill in all required fields.",
      });
      return;
    }

    // Optimistically show loading state
    setOptimisticStatus({ type: "loading", message: "Sending message..." });

    startTransition(async () => {
      try {
        const response = await fetch("/api/contact", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });

        const data = await response.json();

        if (response.ok) {
          setStatus({
            type: "success",
            message: "Message sent successfully! I'll get back to you soon.",
          });
          setFormData({ name: "", email: "", content: "" });
          
          // Play wave/cheering animation if available
          playCharacterAnimation("cheering", false);
        } else {
          setStatus({
            type: "error",
            message: data.error || "Failed to send message. Please try again.",
          });
        }
      } catch (error) {
        setStatus({
          type: "error",
          message: "An error occurred. Please try again later.",
        });
      }
    });
  };

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
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 text-foreground text-center sm:text-left">Get In Touch</h2>
        <p className="text-base sm:text-lg mb-6 sm:mb-8 text-foreground/80 text-center sm:text-left">
          Have a question or want to work together? Feel free to reach out!
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Name Field */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg bg-background/50 border border-foreground/20 text-foreground placeholder-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/50 focus:border-transparent transition-all text-sm sm:text-base"
              placeholder="Your name"
            />
          </div>

          {/* Email Field (Optional) */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
              Email Address <span className="text-foreground/50">(Optional)</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg bg-background/50 border border-foreground/20 text-foreground placeholder-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/50 focus:border-transparent transition-all text-sm sm:text-base"
              placeholder="your.email@example.com"
            />
          </div>

          {/* Content Field */}
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-foreground mb-2">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              id="content"
              name="content"
              value={formData.content}
              onChange={handleChange}
              required
              rows={6}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg bg-background/50 border border-foreground/20 text-foreground placeholder-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/50 focus:border-transparent transition-all resize-none text-sm sm:text-base"
              placeholder="Your message..."
            />
          </div>

          {/* Status Message - Using optimistic state */}
          {optimisticStatus.type !== "idle" && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-lg ${
                optimisticStatus.type === "success"
                  ? "bg-green-500/20 text-green-300 border border-green-500/30"
                  : optimisticStatus.type === "error"
                  ? "bg-red-500/20 text-red-300 border border-red-500/30"
                  : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
              }`}
            >
              {optimisticStatus.message}
            </motion.div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={optimisticStatus.type === "loading" || isPending}
            className="w-full px-6 py-3 bg-foreground text-background font-semibold rounded-lg hover:bg-foreground/90 focus:outline-none focus:ring-2 focus:ring-foreground/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 text-sm sm:text-base"
          >
            {optimisticStatus.type === "loading" || isPending ? "Sending..." : "Send Message"}
          </button>
        </form>
      </motion.div>
    </SectionLayout>
  );
}
