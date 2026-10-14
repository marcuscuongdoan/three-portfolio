import { projects } from "@/data/portfolio";

export type AppKind = "web" | "lab";

export interface ShowcaseApp {
  id: string;
  name: string;
  kind: AppKind;
  // One short line for the museum plaque and the flight cards
  tagline: string;
  description: string;
  url: string;
  // False for the 3D pages on this site (they open in the same tab)
  external: boolean;
  // Same-origin image (canvas textures need it); null draws a generated cover
  image: string | null;
  // Accent for the generated cover, the card stripe and the hover light
  accent: string;
}

const WEB_ACCENTS = ["#e07a8e", "#5b8fd6", "#9b7be0", "#4fb08a", "#e09a4f", "#d7699c"];

const WEB_TAGLINES: Record<number, string> = {
  2: "On-chain wallet analytics",
  3: "AI marketing design suite",
  5: "Game studio website",
  6: "Mental well-being community",
};

const webApps: ShowcaseApp[] = projects.map((p, i) => ({
  id: `web-${p.id}`,
  name: p.name,
  kind: "web",
  tagline: WEB_TAGLINES[p.id] ?? "Web product",
  description: p.description.replace(/\s+/g, " ").trim(),
  url: p.url,
  external: true,
  image: p.image,
  accent: WEB_ACCENTS[i % WEB_ACCENTS.length]!,
}));

// The interactive 3D pages that live on this site
const labApps: ShowcaseApp[] = [
  {
    id: "lab-africa-twin",
    name: "Honda Africa Twin",
    kind: "lab",
    tagline: "3D exploded-view showroom",
    description: "Take the CRF1100L apart, open every part for its specifications, then ride it through desert and city.",
    url: "/africa-twin",
    external: false,
    image: "/museum/africa-twin.webp",
    accent: "#d64541",
  },
  {
    id: "lab-mt-09",
    name: "Yamaha MT-09 SP",
    kind: "lab",
    tagline: "Hyper-naked, part by part",
    description: "Explode the 890 cc CP3 triple — Öhlins, KYB, Brembo Stylema, 6-axis IMU — and take it for a ride.",
    url: "/mt-09",
    external: false,
    image: "/museum/mt-09.webp",
    accent: "#3d6fd8",
  },
  {
    id: "lab-r-ninet",
    name: "BMW R nineT Pure",
    kind: "lab",
    tagline: "Boxer roadster teardown",
    description: "The 1,170 cc air/oil-cooled boxer in 3D: Paralever, shaft drive, twin discs and that round headlight.",
    url: "/r-ninet-pure",
    external: false,
    image: "/museum/r-ninet-pure.webp",
    accent: "#2f8fd0",
  },
  {
    id: "lab-g63",
    name: "Mercedes-AMG G 63",
    kind: "lab",
    tagline: "Doors, bonnet and V8 biturbo",
    description: "Lift the bonnet, swing out the doors and tailgate, read the specs, then drive it off-road.",
    url: "/g63",
    external: false,
    image: "/museum/g63.webp",
    accent: "#8a8f98",
  },
  {
    id: "lab-gas-turbine",
    name: "Gas Turbine Plant",
    kind: "lab",
    tagline: "Station blackout simulation",
    description: "A packaged gas-turbine unit: open each part, then simulate a blackout and watch it pick up the safety buses.",
    url: "/gas-turbine",
    external: false,
    image: "/museum/gas-turbine.webp",
    accent: "#e0a23a",
  },
  {
    id: "lab-legends-trial",
    name: "Legends Trial",
    kind: "lab",
    tagline: "Campfire character select",
    description: "A League-inspired camp at dusk: pick a legend, watch them step up to the fire.",
    url: "/trial",
    external: false,
    image: "/museum/trial.webp",
    accent: "#c89b3c",
  },
  {
    id: "lab-miss-fortune",
    name: "Miss Fortune Skins",
    kind: "lab",
    tagline: "Animated skin showcase",
    description: "Swap Miss Fortune's skins live on an animated 3D model, League of Legends client style.",
    url: "/legends/miss-fortune",
    external: false,
    image: "/museum/miss-fortune.webp",
    accent: "#0ac8b9",
  },
];

export const WEB_APPS = webApps;
export const LAB_APPS = labApps;
export const SHOWCASE_APPS: ShowcaseApp[] = [...webApps, ...labApps];
