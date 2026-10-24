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
  {
    id: "lab-3d-showcase",
    name: "3D Showcase",
    kind: "lab",
    tagline: "Gas station, traffic and subway",
    description: "I made this myself just for fun: twenty GLB models stream in with live progress, then come alive — cars refuel and back out, bikes loop the road, a train stops underground.",
    url: "/3d-showcase",
    external: false,
    image: "/museum/3d-showcase.webp",
    accent: "#f2a36b",
  },
  {
    id: "lab-expodia",
    name: "Expodia",
    kind: "lab",
    tagline: "Build your booth in a virtual expo",
    description: "Revived from a broken project once built at Arobaby: a 3D expo hall with 86 booth slots — pick a Basic, Pro or Premium booth, paint it, put your own product images on it, saved in your browser, while traffic loops the ring road.",
    url: "/expodia",
    external: false,
    image: "/museum/expodia.webp",
    accent: "#00a2c7",
  },
];

// Pages on this site that aren't hung in the museum (its walls hold nine)
const extraApps: ShowcaseApp[] = [
  {
    id: "extra-khoc-block",
    name: "Khóc Blóck",
    kind: "lab",
    tagline: "Metal light show to a rock chorus",
    description: "A portrait lit hit by hit to Phùng Khánh Linh's second chorus: strobes, chrome type and a torch under your cursor.",
    url: "/khoc-block",
    external: false,
    image: "/museum/khoc-block.webp",
    accent: "#9fb2d6",
  },
];

export const WEB_APPS = webApps;
export const LAB_APPS = labApps;
export const EXTRA_APPS = extraApps;
export const SHOWCASE_APPS: ShowcaseApp[] = [...webApps, ...labApps];
