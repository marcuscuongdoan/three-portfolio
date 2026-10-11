import { sendGAEvent } from "@next/third-parties/google";
import { ANALYTICS_ENABLED } from "@/config/site";

/**
 * Sends a GA4 event (pageviews are tracked automatically). No-op outside
 * production, and never throws: analytics must not break the page.
 */
export const track = (name: string, params?: Record<string, string | number | boolean>) => {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return;
  try {
    sendGAEvent("event", name, params ?? {});
  } catch {
    // gtag blocked (ad blocker) or not loaded yet
  }
};
