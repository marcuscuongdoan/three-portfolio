import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: [path: string, priority: number][] = [
    ["", 1],
    ["/africa-twin", 0.8],
    ["/mt-09", 0.8],
    ["/r-ninet-pure", 0.8],
    ["/g63", 0.8],
    ["/gas-turbine", 0.8],
    ["/trial", 0.6],
    ["/3d-showcase", 0.6],
    ["/legends/miss-fortune", 0.5],
  ];
  return pages.map(([path, priority]) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "monthly",
    priority,
  }));
}
