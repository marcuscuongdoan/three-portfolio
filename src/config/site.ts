// Canonical site URL — override per environment with NEXT_PUBLIC_SITE_URL
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://marcus-three-portfolio.vercel.app").replace(
  /\/$/,
  "",
);

// GA4 measurement ID (public: it ships in every page anyway). Override with
// NEXT_PUBLIC_GA_ID, or set it to an empty string to turn analytics off
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "G-4MZBL281P7";
// Only production builds report, so local dev doesn't pollute the numbers
export const ANALYTICS_ENABLED = process.env.NODE_ENV === "production" && GA_ID !== "";
