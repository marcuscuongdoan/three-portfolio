"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { SUN_DIRECTION } from "@/config/bikeShowroom";

// How fast the world streams past at full ride speed, m/s
const WORLD_SPEED = 7;

/**
 * The world streaming past while riding: a looping 160 m route through desert
 * dunes and into a city and out again, under a hazy sky with distance fog.
 *
 * Route coordinate `w` runs 0..ROUTE; everything is placed in route space and
 * shown at z = wrap(w + travelled), so the bike seems to ride through it.
 */

const ROUTE = 160;
const TILE = 10;
const TILES = ROUTE / TILE;
const HALF_WIDTH = 45;
const CITY: [number, number] = [96, 152];
// Metres kept behind the bike before an item wraps to the far side (fogged)
const BEHIND = 40;
const AHEAD = 80;
const TAU = Math.PI * 2;

// Deterministic pseudo-random
const rand = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};
const smooth = THREE.MathUtils.smoothstep;

// Display z for route position w after travelling d metres
const displayZ = (w: number, d: number) => {
  const rel = (((w + d) % ROUTE) + ROUTE) % ROUTE;
  return rel - (ROUTE - BEHIND);
};

// 1 inside the city, ramping at its ends
const cityMix = (w: number, ramp: number) =>
  smooth(w, CITY[0] - ramp, CITY[0] + 2) * (1 - smooth(w, CITY[1] - 2, CITY[1] + ramp));

/**
 * Dune height at (x, w): flat on the track, swelling with distance from it;
 * sums of waves whose w-frequencies divide the route, so the loop is seamless.
 * Flattens out toward the city.
 */
const duneHeight = (x: number, w: number) => {
  const ax = Math.abs(x);
  const mask = smooth(ax, 2.4, 9);
  if (mask === 0) return 0;
  const p = (k: number) => (TAU * k * w) / ROUTE;
  let h = 0;
  // Big dunes with sharp-ish crests
  h += Math.pow(Math.sin(x * 0.11 + p(5)) * 0.5 + 0.5, 1.6) * 2.8;
  h += Math.pow(Math.sin(x * 0.23 - p(9) + 1.3) * 0.5 + 0.5, 1.4) * 1.5;
  // Rolling detail
  h += Math.sin(x * 0.5 + p(23) + 2.1) * 0.32;
  h += Math.sin(x * 1.3 - p(53)) * 0.07;
  const grow = Math.min(0.35 + ax * 0.06, 1.7);
  return Math.max(0, mask * grow * h * (1 - cityMix(w, 14)));
};

/* -------------------------------- Textures ------------------------------- */

const canvasTexture = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext("2d")!);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
};

// Wind ripples and grain on sand
const makeSandTexture = () =>
  canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = "#d6b484";
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 2) {
      const shade = Math.sin(y * 0.55 + Math.sin(y * 0.07) * 3) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(${shade > 0.5 ? "245,222,186" : "170,135,95"},${0.12 + Math.abs(shade - 0.5) * 0.18})`;
      ctx.fillRect(0, y, 256, 2);
    }
    for (let i = 0; i < 1600; i++) {
      ctx.fillStyle = rand(i) > 0.5 ? "rgba(120,92,60,0.25)" : "rgba(250,235,205,0.3)";
      ctx.fillRect(rand(i + 3000) * 256, rand(i + 6000) * 256, 1, 1);
    }
  });

// Tyre ruts and pebbles on packed dirt
const makeTrackTexture = () =>
  canvasTexture(128, 256, (ctx) => {
    ctx.fillStyle = "#bfa47c";
    ctx.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = rand(i + 50) > 0.5 ? "rgba(110,88,62,0.35)" : "rgba(230,214,184,0.35)";
      ctx.beginPath();
      ctx.arc(rand(i + 900) * 128, rand(i + 1900) * 256, 0.6 + rand(i + 2900) * 1.6, 0, TAU);
      ctx.fill();
    }
    [0.35, 0.65].forEach((u) => {
      const g = ctx.createLinearGradient((u - 0.07) * 128, 0, (u + 0.07) * 128, 0);
      g.addColorStop(0, "rgba(95,75,52,0)");
      g.addColorStop(0.5, "rgba(95,75,52,0.5)");
      g.addColorStop(1, "rgba(95,75,52,0)");
      ctx.fillStyle = g;
      ctx.fillRect((u - 0.07) * 128, 0, 0.14 * 128, 256);
    });
    // Soft sand edges
    const edge = ctx.createLinearGradient(0, 0, 128, 0);
    edge.addColorStop(0, "rgba(214,180,132,1)");
    edge.addColorStop(0.15, "rgba(214,180,132,0)");
    edge.addColorStop(0.85, "rgba(214,180,132,0)");
    edge.addColorStop(1, "rgba(214,180,132,1)");
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, 128, 256);
  });

// One 90 m × 10 m city tile: plaza, sidewalks, curbs, road with lane marks
const makeCityTexture = () =>
  canvasTexture(1024, 128, (ctx) => {
    const px = (m: number) => ((m + HALF_WIDTH) / (HALF_WIDTH * 2)) * 1024;
    ctx.fillStyle = "#8b8d92";
    ctx.fillRect(0, 0, 1024, 128);
    // Sidewalks
    ctx.fillStyle = "#b8b5ad";
    ctx.fillRect(px(-7.5), 0, px(-4) - px(-7.5), 128);
    ctx.fillRect(px(4), 0, px(7.5) - px(4), 128);
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    for (let y = 0; y < 128; y += 16) {
      ctx.fillRect(px(-7.5), y, px(-4) - px(-7.5), 1);
      ctx.fillRect(px(4), y, px(7.5) - px(4), 1);
    }
    // Road
    ctx.fillStyle = "#3b3e43";
    ctx.fillRect(px(-4), 0, px(4) - px(-4), 128);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = rand(i + 77) > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.12)";
      ctx.fillRect(px(-4) + rand(i + 4000) * (px(4) - px(-4)), rand(i + 5000) * 128, 1, 1);
    }
    // Curbs, edge lines, dashed centre line (3 m dash, 2 m gap)
    ctx.fillStyle = "#d9d6cf";
    ctx.fillRect(px(-4) - 2, 0, 3, 128);
    ctx.fillRect(px(4) - 1, 0, 3, 128);
    ctx.fillStyle = "rgba(240,240,235,0.9)";
    ctx.fillRect(px(-3.6), 0, 2, 128);
    ctx.fillRect(px(3.6) - 2, 0, 2, 128);
    for (let y = 0; y < 128; y += 64) ctx.fillRect(px(0) - 1.5, y, 3, 38);
  });

// Facade with a 4 × 4 grid of windows (one texture repeat = 4 floors × 4 bays)
// plus the matching mask of which windows are lit at night
const makeFacade = (wall: string, glass: string, seed: number) => {
  const cells = 4;
  const size = 256;
  const cell = size / cells;
  const lit: boolean[] = Array.from({ length: cells * cells }, (_, i) => rand(seed + i) > 0.55);
  const map = canvasTexture(size, size, (ctx) => {
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, size, size);
    for (let r = 0; r < cells; r++)
      for (let c = 0; c < cells; c++) {
        ctx.fillStyle = glass;
        ctx.fillRect(c * cell + cell * 0.18, r * cell + cell * 0.2, cell * 0.64, cell * 0.55);
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(c * cell + cell * 0.18, r * cell + cell * 0.2, cell * 0.64, cell * 0.08);
      }
  });
  const glow = canvasTexture(size, size, (ctx) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, size, size);
    for (let r = 0; r < cells; r++)
      for (let c = 0; c < cells; c++) {
        if (!lit[r * cells + c]) continue;
        ctx.fillStyle = "#fff";
        ctx.fillRect(c * cell + cell * 0.18, r * cell + cell * 0.2, cell * 0.64, cell * 0.55);
      }
  });
  return { map, glow };
};

const FACADES = [
  { wall: "#c9bfae", glass: "#3c4f63", color: "#ffffff" },
  { wall: "#7b8b99", glass: "#28394a", color: "#e6eef5" },
  { wall: "#a6644c", glass: "#2e3a45", color: "#ffffff" },
  { wall: "#dad6cf", glass: "#4d6276", color: "#ffffff" },
];

/* ---------------------------------- Sky ---------------------------------- */

const SKY_DAY = {
  horizon: new THREE.Color("#ead9bf"),
  mid: new THREE.Color("#b9d2e6"),
  top: new THREE.Color("#5f93c9"),
};
const SUN = new THREE.Vector3(...SUN_DIRECTION);
const SUN_FLAT = new THREE.Vector3(SUN.x, 0, SUN.z).normalize();
const SUN_GLOW_DAY = new THREE.Color("#fff1d2");
const SUN_GLOW_NIGHT = new THREE.Color("#2a3550");
const SKY_NIGHT = {
  horizon: new THREE.Color("#1b2333"),
  mid: new THREE.Color("#0d1424"),
  top: new THREE.Color("#05070f"),
};

// Vertex-coloured sky dome (no custom shader); recoloured when day/night shifts
const paintSky = (geometry: THREE.BufferGeometry, night: number) => {
  const pos = geometry.getAttribute("position");
  const col = geometry.getAttribute("color");
  const horizon = new THREE.Color().lerpColors(SKY_DAY.horizon, SKY_NIGHT.horizon, night);
  const mid = new THREE.Color().lerpColors(SKY_DAY.mid, SKY_NIGHT.mid, night);
  const top = new THREE.Color().lerpColors(SKY_DAY.top, SKY_NIGHT.top, night);
  const glow = new THREE.Color().lerpColors(SUN_GLOW_DAY, SUN_GLOW_NIGHT, night);
  const c = new THREE.Color();
  const dir = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i) / 140;
    if (h < 0.12) c.lerpColors(horizon, mid, smooth(h, -0.05, 0.12));
    else c.lerpColors(mid, top, smooth(h, 0.12, 0.7));
    // The sky brightens around the sun (moon at night), so the side the
    // light comes from reads even with the disc out of frame
    dir.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
    const toward = Math.max(dir.dot(SUN), 0);
    // …and the whole horizon on the sun's side warms up (in frame even when
    // the camera can't tilt up to the disc)
    const side = Math.max((dir.x * SUN_FLAT.x + dir.z * SUN_FLAT.z) / Math.max(Math.hypot(dir.x, dir.z), 1e-3), 0);
    const low = 1 - smooth(h, -0.02, 0.3);
    c.lerp(glow, Math.min(Math.pow(toward, 6) * 0.75 + Math.pow(side, 3) * low * 0.55, 0.9));
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
  return horizon;
};

/* --------------------------------- Layout -------------------------------- */

type ItemKind = "rock" | "shrub" | "acacia" | "mesa" | "building" | "lamp";

interface Item {
  kind: ItemKind;
  w: number;
  x: number;
  y: number;
  scale: [number, number, number];
  rotation: number;
  // Index into the kind's material list
  variant: number;
}

const inDesert = (w: number) => cityMix(w, 14) < 0.02;

const buildLayout = () => {
  const items: Item[] = [];
  let s = 1;
  const r = () => rand(s++);
  const side = () => (r() > 0.5 ? 1 : -1);

  // Desert: rocks + shrubs near the track, acacias, mesas on the skyline
  for (let i = 0; i < 160; i++) {
    const w = r() * ROUTE;
    if (!inDesert(w)) continue;
    const x = side() * (2 + r() * 12);
    const rock = r() > 0.45;
    const size = rock ? 0.08 + r() * 0.35 : 0.12 + r() * 0.3;
    items.push({
      kind: rock ? "rock" : "shrub",
      w,
      x,
      y: duneHeight(x, w),
      scale: [size, size * (0.6 + r() * 0.6), size],
      rotation: r() * TAU,
      variant: Math.floor(r() * 3),
    });
  }
  for (let i = 0; i < 26; i++) {
    const w = r() * ROUTE;
    if (!inDesert(w)) continue;
    const x = side() * (5 + r() * 22);
    const size = 0.8 + r() * 0.7;
    items.push({ kind: "acacia", w, x, y: duneHeight(x, w), scale: [size, size, size], rotation: r() * TAU, variant: 0 });
  }
  for (let i = 0; i < 12; i++) {
    const w = r() * ROUTE;
    if (!inDesert(w)) continue;
    const x = side() * (34 + r() * 10);
    const radius = 5 + r() * 7;
    items.push({
      kind: "mesa",
      w,
      x,
      y: duneHeight(x, w) - 1.5,
      scale: [radius, 5 + r() * 10, radius],
      rotation: r() * TAU,
      variant: Math.floor(r() * 3),
    });
  }

  // City: two rows of buildings each side, street lamps along the kerb
  [1, -1].forEach((sd) => {
    [
      { xMin: 9, xMax: 12, hMin: 9, hMax: 26 },
      { xMin: 20, xMax: 30, hMin: 18, hMax: 48 },
    ].forEach((row) => {
      let w = CITY[0] + 3;
      while (w < CITY[1] - 3) {
        const depth = 6 + r() * 7;
        const width = 6 + r() * 8;
        items.push({
          kind: "building",
          w: w + depth / 2,
          x: sd * (row.xMin + r() * (row.xMax - row.xMin) + width / 2),
          y: 0,
          scale: [width, row.hMin + r() * (row.hMax - row.hMin), depth],
          rotation: 0,
          variant: Math.floor(r() * FACADES.length),
        });
        w += depth + 1 + r() * 3;
      }
    });
    for (let w = CITY[0] + 4; w < CITY[1] - 2; w += 14) {
      items.push({ kind: "lamp", w, x: sd * 4.6, y: 0, scale: [1, 1, 1], rotation: sd > 0 ? Math.PI : 0, variant: 0 });
    }
  });
  return items;
};

// Per-tile ground: dune heightfield in the desert, flat city plaza in town
const buildTile = (index: number) => {
  const w0 = index * TILE;
  const city = cityMix(w0 + TILE / 2, 2) > 0.5;
  const segX = city ? 1 : 90;
  const segZ = city ? 1 : 10;
  const geometry = new THREE.PlaneGeometry(HALF_WIDTH * 2, TILE, segX, segZ);
  // Lay it flat: plane +Y becomes route-forward (+Z in tile space, 0..TILE)
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, TILE / 2);
  if (!city) {
    const pos = geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) pos.setY(i, duneHeight(pos.getX(i), w0 + pos.getZ(i)));
    geometry.computeVertexNormals();
  }
  return { index, city, geometry };
};

/* ------------------------------ Scene mutation --------------------------- */

// Mutations of memoised three objects live outside the component (the React
// Compiler forbids them inline)
const setFog = (fog: THREE.Fog, near: number, far: number, color: THREE.Color) => {
  fog.near = near;
  fog.far = far;
  fog.color.copy(color);
};
const setEmissive = (materials: THREE.MeshStandardMaterial[], intensity: number) =>
  materials.forEach((m) => {
    m.emissiveIntensity = intensity;
  });
const setOpacity = (material: THREE.Material, opacity: number) => {
  material.opacity = opacity;
};
const setTint = (material: THREE.SpriteMaterial, a: THREE.Color, b: THREE.Color, k: number) => {
  material.color.lerpColors(a, b, k);
};

// Soft round sprite: solid core fading out (sun disc / its halo)
const makeDiscTexture = (core: number) =>
  canvasSprite((ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(core, "rgba(255,255,255,1)");
    g.addColorStop(Math.min(core + 0.12, 1), "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
const canvasSprite = (draw: (ctx: CanvasRenderingContext2D) => void) => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  draw(canvas.getContext("2d")!);
  return new THREE.CanvasTexture(canvas);
};
// Day sun (warm, bright) → night moon (cool, dimmer)
const SUN_DAY = new THREE.Color(2.2, 2, 1.7);
const SUN_NIGHT = new THREE.Color(0.9, 0.95, 1.1);
const HALO_DAY = new THREE.Color("#ffd9a0");
const HALO_NIGHT = new THREE.Color("#5a6a90");

const setFade = (material: THREE.Material, fade: number) => {
  material.transparent = fade < 0.999;
  material.opacity = fade;
};

/* --------------------------------- World --------------------------------- */

export default function RideWorld({
  riding,
  rideLevel,
  lightsLevel,
  garageLevel,
  worldLevelRef,
}: {
  // The ride toggle: the world clears as soon as it goes off, without
  // waiting for the bike to coast down
  riding: boolean;
  rideLevel: React.RefObject<number>;
  lightsLevel: React.RefObject<number>;
  // Hand-off with the garage: the world only starts once the garage has
  // faded out, and reports its own reveal so the garage waits in turn
  garageLevel: React.RefObject<number>;
  worldLevelRef: React.RefObject<number>;
}) {
  const tiles = useMemo(() => Array.from({ length: TILES }, (_, i) => buildTile(i)), []);
  const items = useMemo(() => buildLayout(), []);

  const textures = useMemo(() => {
    const sand = makeSandTexture();
    sand.repeat.set(18, 2);
    const track = makeTrackTexture();
    track.repeat.set(1, 2.5);
    return { sand, track, city: makeCityTexture() };
  }, []);

  const materials = useMemo(() => {
    const standard = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 1, ...extra });
    return {
      sand: standard("#ffffff", { map: textures.sand }),
      track: standard("#ffffff", { map: textures.track, polygonOffset: true, polygonOffsetFactor: -2 }),
      city: standard("#ffffff", { map: textures.city, roughness: 0.9 }),
      rock: ["#8d7f6e", "#a39482", "#7a6d5e"].map((c) => standard(c, { flatShading: true })),
      shrub: ["#6f7d4a", "#808f55", "#5f6b3f"].map((c) => standard(c, { flatShading: true })),
      mesa: ["#b9785a", "#c78d68", "#a8694f"].map((c) => standard(c, { flatShading: true })),
      trunk: standard("#5a4632"),
      canopy: standard("#6b7b3f", { flatShading: true }),
      pole: standard("#4a4f57", { roughness: 0.6, metalness: 0.4 }),
      lamp: standard("#fff3d6", { emissive: new THREE.Color("#ffd99a"), emissiveIntensity: 0.2 }),
    };
  }, [textures]);

  // One material per building: its facade repeat depends on its size
  const facades = useMemo(() => FACADES.map((f, i) => makeFacade(f.wall, f.glass, 500 + i * 40)), []);
  const buildingMaterials = useMemo(
    () =>
      items.map((item) => {
        if (item.kind !== "building") return null;
        const facade = facades[item.variant]!;
        const map = facade.map.clone();
        const glow = facade.glow.clone();
        // A repeat covers 4 floors × 4 bays (~3.4 m × 3.2 m each)
        map.repeat.set(item.scale[0] / 12.8, item.scale[1] / 13.6);
        glow.repeat.copy(map.repeat);
        map.needsUpdate = glow.needsUpdate = true;
        return new THREE.MeshStandardMaterial({
          color: FACADES[item.variant]!.color,
          map,
          emissive: new THREE.Color("#ffd8a0"),
          emissiveMap: glow,
          emissiveIntensity: 0,
          roughness: 0.75,
          metalness: 0.1,
        });
      }),
    [items, facades],
  );
  const glowMaterials = useMemo(
    () => [...buildingMaterials.filter((m): m is THREE.MeshStandardMaterial => !!m), materials.lamp],
    [buildingMaterials, materials],
  );

  const geometries = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    const trunk = new THREE.CylinderGeometry(0.08, 0.12, 2.2, 6);
    trunk.translate(0, 1.1, 0);
    const canopy = new THREE.SphereGeometry(1, 10, 6);
    canopy.scale(1.6, 0.35, 1.6);
    canopy.translate(0, 2.3, 0);
    const mesa = new THREE.CylinderGeometry(0.85, 1, 1, 7);
    mesa.translate(0, 0.5, 0);
    const pole = new THREE.CylinderGeometry(0.07, 0.09, 6, 8);
    pole.translate(0, 3, 0);
    const arm = new THREE.BoxGeometry(1.4, 0.08, 0.08);
    arm.translate(0.7, 5.9, 0);
    const head = new THREE.BoxGeometry(0.5, 0.12, 0.25);
    head.translate(1.3, 5.8, 0);
    const track = new THREE.PlaneGeometry(1.7, TILE);
    track.rotateX(-Math.PI / 2);
    track.translate(0, 0.012, TILE / 2);
    return {
      box,
      trunk,
      canopy,
      mesa,
      pole,
      arm,
      head,
      track,
      rock: new THREE.DodecahedronGeometry(1, 0),
      shrub: new THREE.IcosahedronGeometry(1, 0),
    };
  }, []);

  const sky = useMemo(() => {
    const g = new THREE.SphereGeometry(140, 32, 16);
    g.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute("position").count * 3), 3));
    return g;
  }, []);
  const skyMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
      }),
    [],
  );
  const fog = useMemo(() => new THREE.Fog("#ead9bf", 1e4, 2e4), []);

  const world = useRef<THREE.Group>(null);
  const skyMesh = useRef<THREE.Mesh>(null);
  // Sun (moon at night) in the key light's direction, so the shadows have a source
  const sunMaterials = useMemo(() => {
    const sprite = (map: THREE.Texture, blending: THREE.Blending) =>
      new THREE.SpriteMaterial({
        map,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        blending,
      });
    return {
      disc: sprite(makeDiscTexture(0.42), THREE.NormalBlending),
      halo: sprite(makeDiscTexture(0), THREE.AdditiveBlending),
    };
  }, []);
  const sunGroup = useRef<THREE.Group>(null);
  const tileGroups = useRef<(THREE.Group | null)[]>([]);
  const itemGroups = useRef<(THREE.Group | null)[]>([]);
  const travelled = useRef(0);
  // 0..1 world reveal: slower than the ride itself, so the scenery emerges
  // out of the mist over a few seconds (and clears away faster)
  const reveal = useRef(0);
  const fogColor = useRef(new THREE.Color());
  const night = useRef(-1);
  const horizon = useRef(new THREE.Color("#ead9bf"));

  useFrame(({ scene, camera }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const ride = rideLevel.current;
    // Fog lives on the scene permanently (adding it later recompiles every
    // material); it only closes in while riding
    if (scene.fog !== fog) scene.fog = fog;

    const nightLevel = lightsLevel.current;
    if (Math.abs(nightLevel - night.current) > 0.004) {
      night.current = nightLevel;
      horizon.current.copy(paintSky(sky, nightLevel));
      setEmissive(glowMaterials.slice(0, -1), nightLevel * 1.3);
      setEmissive([materials.lamp], 0.2 + nightLevel * 3);
      setTint(sunMaterials.disc, SUN_DAY, SUN_NIGHT, nightLevel);
      setTint(sunMaterials.halo, HALO_DAY, HALO_NIGHT, nightLevel);
      if (sunGroup.current) sunGroup.current.scale.setScalar(1 - nightLevel * 0.45);
    }

    const revealTarget = riding && ride > 0.05 && garageLevel.current < 0.12 ? 1 : 0;
    // Fast exit (~0.25 s): exploding waits for it
    reveal.current = THREE.MathUtils.damp(reveal.current, revealTarget, revealTarget ? 0.9 : 14, delta);
    if (Math.abs(reveal.current - revealTarget) < 0.001) reveal.current = revealTarget;
    const r = reveal.current;
    worldLevelRef.current = r;
    const grow = smooth(r, 0, 0.45);

    // Mist the colour of the studio hides all but the ground by the bike,
    // then rolls back to the horizon haze. It never starts closer than the
    // camera-to-bike distance, so the bike itself stays clear
    if (r > 0.001 && revealTarget === 1) {
      if (scene.background instanceof THREE.Color) fogColor.current.copy(scene.background);
      fogColor.current.lerp(horizon.current, smooth(r, 0.1, 0.8));
      setFog(fog, THREE.MathUtils.lerp(6.5, 22, r), THREE.MathUtils.lerp(8, 85, r * r), fogColor.current);
    } else if (r > 0.001) {
      // Leaving: the mist rolls away instead of closing in, so nothing nearby
      // (e.g. parts flying out on explode) is swallowed by it
      const k = 1 / Math.max(r * r, 0.0001);
      setFog(fog, 22 * k, 85 * k, fog.color);
    } else {
      setFog(fog, 1e4, 2e4, horizon.current);
    }
    setOpacity(skyMaterial, smooth(r, 0.25, 1));
    setOpacity(sunMaterials.disc, smooth(r, 0.4, 1));
    setOpacity(sunMaterials.halo, smooth(r, 0.4, 1) * 0.55);
    if (sunGroup.current) sunGroup.current.visible = r > 0.4;
    if (skyMesh.current) skyMesh.current.visible = grow > 0.001;
    if (!world.current) return;
    world.current.visible = grow > 0.001;
    if (grow <= 0.001) return;
    // Everything rises out of the floor as the ride starts
    world.current.scale.y = Math.max(grow, 0.001);

    travelled.current += WORLD_SPEED * ride * delta;
    const d = travelled.current;

    tiles.forEach((tile, i) => {
      const g = tileGroups.current[i];
      if (!g) return;
      const z = displayZ(tile.index * TILE, d);
      g.position.z = z;
      g.visible = z + TILE > -AHEAD && z < BEHIND;
    });
    // Nothing may block the camera: buildings near it fade out (each has its
    // own material), small props near it shrink away
    const cx = camera.position.x;
    const cz = camera.position.z;
    items.forEach((item, i) => {
      const g = itemGroups.current[i];
      if (!g) return;
      const z = displayZ(item.w, d);
      g.position.z = z;
      g.visible = z > -AHEAD && z < BEHIND;
      if (!g.visible) return;
      if (item.kind === "building") {
        const dx = Math.max(Math.abs(cx - item.x) - item.scale[0] / 2, 0);
        const dz = Math.max(Math.abs(cz - z) - item.scale[2] / 2, 0);
        setFade(buildingMaterials[i]!, 0.12 + 0.88 * smooth(Math.hypot(dx, dz), 1.5, 7));
      } else {
        const near = smooth(Math.hypot(cx - item.x, cz - z), 0.8, 3.5);
        g.scale.setScalar(Math.max(near, 0.001));
      }
    });
  });

  const renderItem = (item: Item) => {
    switch (item.kind) {
      case "rock":
        return <mesh geometry={geometries.rock} material={materials.rock[item.variant]} scale={item.scale} castShadow />;
      case "shrub":
        return <mesh geometry={geometries.shrub} material={materials.shrub[item.variant]} scale={item.scale} castShadow />;
      case "mesa":
        return (
          <mesh
            geometry={geometries.mesa}
            material={materials.mesa[item.variant]}
            scale={item.scale}
            castShadow
            receiveShadow
          />
        );
      case "acacia":
        return (
          <group scale={item.scale}>
            <mesh geometry={geometries.trunk} material={materials.trunk} castShadow />
            <mesh geometry={geometries.canopy} material={materials.canopy} castShadow />
          </group>
        );
      case "lamp":
        return (
          <>
            <mesh geometry={geometries.pole} material={materials.pole} castShadow />
            <mesh geometry={geometries.arm} material={materials.pole} castShadow />
            <mesh geometry={geometries.head} material={materials.lamp} />
          </>
        );
      case "building":
        return (
          <mesh
            geometry={geometries.box}
            material={buildingMaterials[items.indexOf(item)]!}
            scale={item.scale}
            castShadow
            receiveShadow
          />
        );
    }
  };

  return (
    <>
      <mesh ref={skyMesh} geometry={sky} material={skyMaterial} renderOrder={-1} visible={false} raycast={() => null} />
      <group ref={sunGroup} visible={false}>
        <sprite
          position={[SUN.x * 120, SUN.y * 120, SUN.z * 120]}
          scale={40}
          material={sunMaterials.halo}
          renderOrder={-1}
          raycast={() => null}
        />
        <sprite
          position={[SUN.x * 118, SUN.y * 118, SUN.z * 118]}
          scale={9}
          material={sunMaterials.disc}
          renderOrder={-1}
          raycast={() => null}
        />
      </group>
      <group ref={world} visible={false}>
        {tiles.map((tile, i) => (
          <group
            key={`tile-${i}`}
            ref={(g) => {
              tileGroups.current[i] = g;
            }}
          >
            {tile.city ? (
              <mesh geometry={tile.geometry} material={materials.city} position-y={0.004} receiveShadow raycast={() => null} />
            ) : (
              <>
                <mesh geometry={tile.geometry} material={materials.sand} receiveShadow raycast={() => null} />
                <mesh geometry={geometries.track} material={materials.track} receiveShadow raycast={() => null} />
              </>
            )}
          </group>
        ))}
        {items.map((item, i) => (
          <group
            key={`item-${i}`}
            ref={(g) => {
              itemGroups.current[i] = g;
            }}
            position={[item.x, item.y, 0]}
            rotation-y={item.rotation}
          >
            {renderItem(item)}
          </group>
        ))}
      </group>
    </>
  );
}
