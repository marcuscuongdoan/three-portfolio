import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Procedural trees: branching bark (tapered cylinders, each limb splitting
 * into thinner ones) and foliage made of leaf cards — quads textured with a
 * painted cluster of leaves, cut out by alpha. The cards get "spherical"
 * normals (pointing out from the crown's centre) so the crown shades as one
 * soft volume instead of a mess of flat planes.
 */

export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rand = () => number;

// ---------------------------------------------------------------- textures

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, rand: Rand) => void, seed: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext("2d")!, mulberry32(seed));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const hsl = (h: number, s: number, l: number) => `hsl(${h} ${s}% ${l}%)`;

/** A twig with broad leaves fanning off it, on transparency */
export function makeLeafTexture(seed = 1) {
  return canvasTexture(
    256,
    256,
    (ctx, rand) => {
      const twigs = 5;
      for (let t = 0; t < twigs; t++) {
        const a0 = (t / twigs) * Math.PI * 2 + rand() * 0.6;
        const len = 70 + rand() * 45;
        ctx.strokeStyle = "rgba(70,52,35,0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(128, 128);
        ctx.lineTo(128 + Math.cos(a0) * len, 128 + Math.sin(a0) * len);
        ctx.stroke();
        const leaves = 7 + Math.floor(rand() * 4);
        for (let i = 0; i < leaves; i++) {
          const k = 0.25 + (i / leaves) * 0.8;
          const bx = 128 + Math.cos(a0) * len * k;
          const by = 128 + Math.sin(a0) * len * k;
          const side = i % 2 ? 1 : -1;
          const a = a0 + side * (0.6 + rand() * 0.5);
          const L = 16 + rand() * 12;
          const W = L * (0.38 + rand() * 0.12);
          ctx.save();
          ctx.translate(bx, by);
          ctx.rotate(a);
          // Leaf: pointed ellipse, darker toward the base, a pale midrib
          const g = ctx.createLinearGradient(0, 0, L * 2, 0);
          const hue = 88 + rand() * 30;
          const light = 26 + rand() * 18;
          g.addColorStop(0, hsl(hue, 45, light - 8));
          g.addColorStop(1, hsl(hue - 6, 50, light + 8));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(L * 0.8, -W, L * 2, 0);
          ctx.quadraticCurveTo(L * 0.8, W, 0, 0);
          ctx.fill();
          ctx.strokeStyle = hsl(hue, 30, light + 18);
          ctx.globalAlpha = 0.5;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(2, 0);
          ctx.lineTo(L * 1.8, 0);
          ctx.stroke();
          ctx.restore();
        }
      }
    },
    seed,
  );
}

/** Needle sprays for the pines */
export function makeNeedleTexture(seed = 2) {
  return canvasTexture(
    256,
    128,
    (ctx, rand) => {
      // A central twig along the card with needles off both sides, drooping
      for (let s = 0; s < 3; s++) {
        const y0 = 40 + s * 24 + rand() * 8;
        ctx.strokeStyle = "rgba(60,45,30,0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(4, y0);
        ctx.quadraticCurveTo(128, y0 - 6, 252, y0 + 8);
        ctx.stroke();
        for (let x = 8; x < 248; x += 3) {
          const y = y0 + ((x - 4) / 248) * 8;
          const len = 14 + rand() * 14 * (1 - x / 400);
          for (const side of [-1, 1]) {
            const hue = 120 + rand() * 25;
            ctx.strokeStyle = hsl(hue, 35, 18 + rand() * 16);
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 6 + rand() * 6, y + side * len);
            ctx.stroke();
          }
        }
      }
    },
    seed,
  );
}

/** Grass blades for ground tufts: fine, varied, curving, paler at the tips */
export function makeGrassTexture(seed = 3) {
  return canvasTexture(
    128,
    128,
    (ctx, rand) => {
      for (let i = 0; i < 70; i++) {
        const x = 8 + rand() * 112;
        const h = 45 + rand() * 80;
        const lean = (rand() - 0.5) * 50;
        const w = 1.2 + rand() * 2.2;
        // Mostly green, a few olive or straw blades among them
        const hue = rand() < 0.15 ? 55 + rand() * 15 : 80 + rand() * 30;
        const g = ctx.createLinearGradient(0, 128, 0, 128 - h);
        g.addColorStop(0, hsl(hue, 40, 12));
        g.addColorStop(0.6, hsl(hue, 45, 28 + rand() * 10));
        g.addColorStop(1, hsl(hue - 5, 40, 42 + rand() * 12));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - w, 128);
        ctx.quadraticCurveTo(x + lean * 0.2, 128 - h * 0.55, x + lean, 128 - h);
        ctx.quadraticCurveTo(x + lean * 0.2 + w * 0.6, 128 - h * 0.55, x + w, 128);
        ctx.fill();
      }
    },
    seed,
  );
}

/** Soft blotches of greens and earth, for the ground under the grass */
export function makeGroundTexture(seed = 5) {
  const tex = canvasTexture(
    256,
    256,
    (ctx, rand) => {
      ctx.fillStyle = "#4f6040";
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 140; i++) {
        const x = rand() * 256;
        const y = rand() * 256;
        const r = 10 + rand() * 40;
        const c = rand() < 0.25 ? hsl(45 + rand() * 10, 25, 30 + rand() * 8) : hsl(85 + rand() * 25, 25 + rand() * 15, 26 + rand() * 12);
        // Drawn at the wrapped positions too, so the tile has no seams
        for (const ox of [-256, 0, 256])
          for (const oy of [-256, 0, 256]) {
            const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
            g.addColorStop(0, c);
            g.addColorStop(1, "rgba(0,0,0,0)");
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = g;
            ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
          }
      }
      ctx.globalAlpha = 1;
    },
    seed,
  );
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Vertical bark furrows */
export function makeBarkTexture(seed = 4) {
  const tex = canvasTexture(
    128,
    256,
    (ctx, rand) => {
      ctx.fillStyle = "#5b4433";
      ctx.fillRect(0, 0, 128, 256);
      for (let i = 0; i < 90; i++) {
        const x = rand() * 128;
        const w = 1 + rand() * 4;
        ctx.fillStyle = rand() < 0.5 ? `rgba(30,20,14,${0.3 + rand() * 0.4})` : `rgba(140,115,90,${0.15 + rand() * 0.25})`;
        ctx.beginPath();
        let y = 0;
        ctx.moveTo(x, 0);
        while (y < 256) {
          y += 10 + rand() * 20;
          ctx.lineTo(x + (rand() - 0.5) * 6, y);
        }
        ctx.lineTo(x + w, 256);
        ctx.lineTo(x + w, 0);
        ctx.fill();
      }
    },
    seed,
  );
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// --------------------------------------------------------------- materials

/** Foliage cards keep their outward normal on both faces (no back-face flip) */
export function foliageMaterial(map: THREE.Texture, extra: THREE.MeshStandardMaterialParameters = {}) {
  const m = new THREE.MeshStandardMaterial({
    map,
    alphaTest: 0.45,
    alphaToCoverage: true,
    side: THREE.DoubleSide,
    roughness: 0.85,
    metalness: 0,
    ...extra,
  });
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_begin>",
      THREE.ShaderChunk.normal_fragment_begin.replaceAll("normal *= faceDirection;", ""),
    );
  };
  m.customProgramCacheKey = () => "foliage";
  return m;
}

/** The solid part of a crown: its vertex colours carry the shading */
export function crownMaterial(color: THREE.ColorRepresentation) {
  return new THREE.MeshStandardMaterial({ color, vertexColors: true, roughness: 0.9, metalness: 0 });
}

// ---------------------------------------------------------------- geometry

const UP = new THREE.Vector3(0, 1, 0);

interface Limb {
  a: THREE.Vector3;
  b: THREE.Vector3;
  r0: number;
  r1: number;
}

// Limbs thinner than this get no rounded joint: too fine to see, too many to pay for
const JOINT_MIN_RADIUS = 0.03;

function limbGeometry(limbs: Limb[], radial = 7) {
  const parts = limbs.flatMap(({ a, b, r0, r1 }) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    // Trunks and boughs are close enough to show their facets
    const sides = r0 > 0.1 ? 12 : radial;
    const g = new THREE.CylinderGeometry(r1, r0, len, sides, 1, true);
    // Bark texture runs along the limb, about one repeat per metre
    const uv = g.attributes.uv!;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(r0 * 12)), uv.getY(i) * len);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()));
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    if (r1 < JOINT_MIN_RADIUS) return [g];
    // A ball at the far end rounds the elbow into the next limb (or caps the tip)
    const joint = new THREE.SphereGeometry(r1, sides, Math.max(4, sides >> 1));
    joint.translate(b.x, b.y, b.z);
    return [g, joint];
  });
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

// Vertex colour multipliers for foliage: healthy, and turning rust-brown
// (over a green material, the rust reads as olive-bronze)
const GREEN = [0.96, 1, 0.9] as const;
const RUST = [1.5, 0.82, 0.5] as const;

class CardBuilder {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  idx: number[] = [];
  // Per vertex: distance from the crown's centre, and the card's own tone
  depth: number[] = [];
  tone: number[] = [];
  rust: number[] = [];
  /** A quad centred at `c`, spanning `u` and `v` (half extents), lit as if on a sphere round `centre` */
  add(c: THREE.Vector3, u: THREE.Vector3, v: THREE.Vector3, centre: THREE.Vector3, uv: [number, number, number, number] = [0, 0, 1, 1]) {
    const base = this.pos.length / 3;
    const corners: [number, number, number, number][] = [
      [-1, -1, uv[0], uv[1]],
      [1, -1, uv[2], uv[1]],
      [1, 1, uv[2], uv[3]],
      [-1, 1, uv[0], uv[3]],
    ];
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    // A cheap hash of the card's index: each card a shade lighter or darker
    const hash = Math.sin(base * 12.9898) * 43758.5453;
    const tone = 0.86 + 0.24 * (hash - Math.floor(hash));
    // About a quarter of the cards are turning rust-brown
    const turn = Math.sin(base * 78.233) * 12543.21;
    const rust = turn - Math.floor(turn) < 0.25 ? 1 : 0;
    for (const [su, sv, tu, tv] of corners) {
      p.copy(c).addScaledVector(u, su).addScaledVector(v, sv);
      n.subVectors(p, centre).normalize().lerp(UP, 0.25).normalize();
      this.pos.push(p.x, p.y, p.z);
      this.nor.push(n.x, n.y, n.z);
      this.uv.push(tu, tv);
      this.depth.push(p.distanceTo(centre));
      this.tone.push(tone);
      this.rust.push(rust);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    // Vertex colours: deep inside the crown is in its own shade, the rim is lit
    const reach = Math.max(...this.depth, 1e-3);
    const col: number[] = [];
    this.depth.forEach((d, i) => {
      const lit = (0.45 + 0.55 * Math.pow(d / reach, 0.8)) * this.tone[i]!;
      const [r, g, b] = this.rust[i] ? RUST : GREEN;
      col.push(lit * r, lit * g, lit * b);
    });
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

function randomUnit(rand: Rand, out = new THREE.Vector3()) {
  do out.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
  while (out.lengthSq() > 1 || out.lengthSq() < 0.01);
  return out.normalize();
}

/** Turn `dir` by `angle` toward a random side, then lean it toward `bias` */
function spread(dir: THREE.Vector3, angle: number, rand: Rand, bias: THREE.Vector3, biasAmount: number) {
  const side = randomUnit(rand).cross(dir).normalize();
  return dir.clone().applyAxisAngle(side, angle).addScaledVector(bias, biasAmount).normalize();
}

export interface TreeGeometry {
  bark: THREE.BufferGeometry;
  // A light fringe of leaf cards over the crown
  leaves: THREE.BufferGeometry;
  // The crown's solid, softly lumpy volume (vertex coloured)
  crown: THREE.BufferGeometry;
}

// ------------------------------------------------------------------ crowns

interface Blob {
  c: THREE.Vector3;
  r: number;
}

// Directions a blob's reach is tested along against an `exclude`
const PROBES = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1], [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());

/** Shrink a blob until no part of it reaches into `exclude`; null if it can't fit */
function fitBlob(b: Blob, exclude?: (p: THREE.Vector3) => boolean): Blob | null {
  if (!exclude) return b;
  const p = new THREE.Vector3();
  for (const k of [1, 0.75, 0.55]) {
    const r = b.r * k;
    if (!exclude(b.c) && PROBES.every((d) => !exclude(p.copy(b.c).addScaledVector(d, r)))) return { c: b.c, r };
  }
  return null;
}

/**
 * Lumpy spheres merged into one crown: each a subdivided icosahedron pushed
 * in and out by a little noise, its bottom flattened, lit on top and in the
 * crown's shade underneath and toward the middle. Normals lean out from
 * `centre` so the crown shades as one soft mass.
 */
function blobGeometry(blobs: Blob[], centre: THREE.Vector3, rand: Rand, detail = 2) {
  const reach = Math.max(...blobs.map((b) => b.c.distanceTo(centre) + b.r), 1e-3);
  const parts = blobs.map((b) => {
    const ico = new THREE.IcosahedronGeometry(1, detail);
    ico.deleteAttribute("normal");
    ico.deleteAttribute("uv");
    const g = mergeVertices(ico);
    ico.dispose();
    const pos = g.attributes.position!;
    const phase = [rand() * 6.3, rand() * 6.3, rand() * 6.3, rand() * 6.3];
    const tone = 0.88 + rand() * 0.22;
    const [cr, cg, cb] = rand() < 0.33 ? RUST : GREEN;
    const col = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n =
        0.16 * Math.sin(v.x * 4.1 + phase[0]!) * Math.sin(v.y * 3.7 + phase[1]!) * Math.sin(v.z * 4.3 + phase[2]!) +
        0.07 * Math.sin(v.x * 9 + v.z * 7 + phase[3]!);
      const top = v.y * 0.5 + 0.5;
      const k = b.r * (1 + n);
      pos.setXYZ(i, b.c.x + v.x * k, b.c.y + v.y * k * (v.y < 0 ? 0.72 : 1), b.c.z + v.z * k);
      v.fromBufferAttribute(pos, i);
      const lit = (0.5 + 0.5 * top) * (0.68 + 0.32 * Math.min(1, v.distanceTo(centre) / reach)) * tone;
      col.set([lit * cr, lit * cg, lit * cb], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    // Lean the normals out from the crown's centre
    const nor = g.attributes.normal!;
    const n = new THREE.Vector3();
    const out = new THREE.Vector3();
    for (let i = 0; i < nor.count; i++) {
      n.fromBufferAttribute(nor, i);
      out.fromBufferAttribute(pos, i).sub(centre).normalize();
      n.lerp(out, 0.45).normalize();
      nor.setXYZ(i, n.x, n.y, n.z);
    }
    return g;
  });
  const merged = mergeGeometries(parts)!;
  parts.forEach((g) => g.dispose());
  return merged;
}

/** Leaf cards scattered over the blobs' surfaces, mostly on their upper sides */
function fringeCards(cards: CardBuilder, blobs: Blob[], centre: THREE.Vector3, size: number, perBlob: number, rand: Rand, exclude?: (p: THREE.Vector3) => boolean) {
  const d = new THREE.Vector3();
  const u = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (const b of blobs) {
    for (let k = 0; k < perBlob; k++) {
      randomUnit(rand, d);
      d.y = Math.abs(d.y) * 0.8 - 0.15;
      d.normalize();
      const c = b.c.clone().addScaledVector(d, b.r * (0.88 + rand() * 0.2));
      if (exclude?.(c)) continue;
      const s = size * (0.55 + rand() * 0.4);
      randomUnit(rand, u).multiplyScalar(s / 2);
      v.crossVectors(randomUnit(rand, new THREE.Vector3()), u).normalize().multiplyScalar(s / 2);
      if (v.lengthSq() < 1e-6) continue;
      cards.add(c, u.clone(), v.clone(), centre);
    }
  }
}

export interface BroadleafOptions {
  seed: number;
  height?: number;
  trunkRadius?: number;
  // Where the trunk first forks, as a share of the height
  forkAt?: number;
  levels?: number;
  // Every limb also leans this way (e.g. away from something it must clear)
  lean?: THREE.Vector3;
  // Leaf card size; the crown's blobs are sized from it too
  cardSize?: number;
  // Leaf cards over each blob
  fringe?: number;
  // Big blobs through the middle of the crown
  innerBlobs?: number;
  // Nothing of the crown (blob or card) reaches where this returns true
  exclude?: (p: THREE.Vector3) => boolean;
  // Subdivision of the crown's blobs: 1 (80 faces each) is plenty far off
  crownDetail?: number;
}

/** A broadleaf tree with its root at the origin */
export function broadleafTree({
  seed,
  height = 7,
  trunkRadius = 0.22,
  forkAt = 0.42,
  levels = 3,
  lean = new THREE.Vector3(),
  cardSize = 0.85,
  fringe = 6,
  innerBlobs = 2,
  exclude,
  crownDetail = 2,
}: BroadleafOptions): TreeGeometry {
  const rand = mulberry32(seed);
  const limbs: Limb[] = [];
  const tips: { p: THREE.Vector3; d: THREE.Vector3 }[] = [];

  const grow = (start: THREE.Vector3, dir: THREE.Vector3, len: number, r: number, level: number) => {
    // Two joints per limb so it bends instead of being dead straight
    const mid = start.clone().addScaledVector(dir, len * 0.5);
    const dir2 = spread(dir, 0.15 + rand() * 0.2, rand, UP, 0.12);
    const end = mid.clone().addScaledVector(dir2, len * 0.5);
    const rEnd = r * (level === levels ? 0.35 : 0.68);
    const rMid = (r + rEnd) / 2;
    limbs.push({ a: start, b: mid, r0: r, r1: rMid }, { a: mid, b: end, r0: rMid, r1: rEnd });
    if (level === levels) {
      tips.push({ p: end, d: dir2 });
      // Leaves along the last limbs too, not only at their very ends
      tips.push({ p: mid, d: dir });
      return;
    }
    const n = level === 0 ? 3 + Math.floor(rand() * 2) : 2 + Math.floor(rand() * 2);
    for (let i = 0; i < n; i++) {
      const angle = (level === 0 ? 0.55 : 0.45) + rand() * 0.45;
      const child = spread(dir2, angle, rand, UP, 0.25).addScaledVector(lean, 0.35).normalize();
      grow(end, child, len * (0.62 + rand() * 0.18), rEnd, level + 1);
    }
  };
  grow(new THREE.Vector3(), UP.clone(), height * forkAt, trunkRadius, 0);

  // The crown's centre for the spherical normals
  const centre = tips.reduce((c, t) => c.add(t.p), new THREE.Vector3()).divideScalar(tips.length);
  centre.y -= height * 0.08;

  // Blobs: one round every few tips, spaced so they overlap a little...
  const blobs: Blob[] = [];
  const r0 = cardSize * 1.25;
  const order = tips.map((t) => t.p).sort(() => rand() - 0.5);
  for (const p of order) {
    if (blobs.some((b) => b.c.distanceTo(p) < r0 * 1.1)) continue;
    const fit = fitBlob({ c: p.clone().addScaledVector(UP, cardSize * 0.15), r: r0 * (0.85 + rand() * 0.4) }, exclude);
    if (fit) blobs.push(fit);
  }
  // ...and a few big ones through the middle, so no sky shows through the crown
  const box = new THREE.Box3().setFromPoints(tips.map((t) => t.p));
  const mid = box.getCenter(new THREE.Vector3());
  const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const inner = Math.max(r0, Math.min(half.x, half.z) * 0.7);
  for (let k = 0; k < innerBlobs; k++) {
    const c = k === 0 ? mid.clone() : mid.clone().add(randomUnit(rand, new THREE.Vector3()).multiply(half).multiplyScalar(0.5));
    const fit = fitBlob({ c, r: inner * (k === 0 ? 1 : 0.75) }, exclude);
    if (fit) blobs.push(fit);
  }
  const cards = new CardBuilder();
  fringeCards(cards, blobs, centre, cardSize, fringe, rand, exclude);
  return { bark: limbGeometry(limbs), leaves: cards.build(), crown: blobGeometry(blobs, centre, rand, crownDetail) };
}

export interface ConiferOptions {
  seed: number;
  height?: number;
  trunkRadius?: number;
  width?: number;
}

/** A pine: one straight trunk, whorls of drooping branches, needle cards along them */
export function coniferTree({ seed, height = 8, trunkRadius = 0.18, width = 2.4 }: ConiferOptions): TreeGeometry {
  const rand = mulberry32(seed);
  const limbs: Limb[] = [{ a: new THREE.Vector3(), b: new THREE.Vector3(0, height, 0), r0: trunkRadius, r1: 0.02 }];
  const cards = new CardBuilder();
  const centre = new THREE.Vector3(0, height * 0.45, 0);
  const firstWhorl = height * 0.18;
  const gap = 0.42;
  for (let y = firstWhorl; y < height - 0.3; y += gap * (0.8 + rand() * 0.4)) {
    const k = (y - firstWhorl) / (height - firstWhorl); // 0 at the bottom, 1 at the top
    const reach = width * (1 - k) * (0.85 + rand() * 0.3) + 0.25;
    const count = 5 + Math.floor(rand() * 3);
    const turn = rand() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const a = turn + (i / count) * Math.PI * 2 + rand() * 0.3;
      const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const droop = 0.15 + (1 - k) * 0.25;
      const tip = new THREE.Vector3(0, y, 0).addScaledVector(out, reach).add(new THREE.Vector3(0, -droop * reach + 0.15, 0));
      limbs.push({ a: new THREE.Vector3(0, y, 0), b: tip, r0: trunkRadius * 0.28 * (1 - k * 0.6), r1: 0.012 });
      // Needle cards lying along the branch, roughly horizontal, tilted a little
      const along = tip.clone().sub(new THREE.Vector3(0, y, 0));
      const len = along.length();
      along.normalize();
      const across = new THREE.Vector3().crossVectors(along, UP).normalize();
      const tilt = (rand() - 0.5) * 0.5;
      const half = new THREE.Vector3().copy(along).multiplyScalar(len * 0.55);
      const side = across.clone().multiplyScalar(0.32 + (1 - k) * 0.12).applyAxisAngle(along, tilt);
      const mid = new THREE.Vector3(0, y, 0).addScaledVector(along, len * 0.55);
      // One spray per branch: a needle fringe round the tiers
      cards.add(mid, half, side, centre);
    }
  }
  // The leader at the very top
  const topMid = new THREE.Vector3(0, height - 0.2, 0);
  cards.add(topMid, new THREE.Vector3(0, 0.45, 0), new THREE.Vector3(0.22, 0, 0), centre, [0, 0, 1, 1]);
  cards.add(topMid, new THREE.Vector3(0, 0.45, 0), new THREE.Vector3(0, 0, 0.22), centre, [0, 0, 1, 1]);
  return { bark: limbGeometry(limbs, 6), leaves: cards.build(), crown: coniferTiers(height, width, firstWhorl, rand) };
}

/**
 * A pine's body: stacked cones, narrowing up the trunk, each skirt drooping in
 * scallops, lit on top and shaded under each tier and toward the bottom
 */
function coniferTiers(height: number, width: number, from: number, rand: Rand) {
  const tiers = 6;
  const parts: THREE.BufferGeometry[] = [];
  for (let t = 0; t < tiers; t++) {
    const k = t / (tiers - 1);
    const h = height * 0.3 * (1 - k * 0.45);
    const r = width * (1 - k * 0.85) * 0.95 + 0.3;
    const base = from + (height - from - h * 0.8) * Math.pow(k, 0.9);
    const cone = new THREE.ConeGeometry(r, h, 14, 3);
    cone.deleteAttribute("normal");
    cone.deleteAttribute("uv");
    const g = mergeVertices(cone);
    cone.dispose();
    const pos = g.attributes.position!;
    const col = new Float32Array(pos.count * 3);
    const phase = rand() * 6.3;
    const tone = 0.88 + rand() * 0.2;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);
      const rad = Math.hypot(x, z);
      if (rad > 1e-4) {
        const a = Math.atan2(z, x);
        const rim = rad / r;
        // Scalloped, drooping skirt; a little unevenness all over
        y -= rim * rim * (0.5 + 0.5 * Math.sin(a * 6 + phase)) * h * 0.18;
        const wobble = 1 + 0.07 * Math.sin(a * 9 + phase * 2 + y * 3);
        x *= wobble;
        z *= wobble;
      }
      const up = (y + h / 2) / h;
      const lit = (0.5 + 0.5 * Math.min(1, Math.max(0, up))) * (0.78 + 0.22 * k) * tone;
      col.set([lit * 0.92, lit, lit * 0.95], i * 3);
      pos.setXYZ(i, x, y + base + h / 2, z);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    // Lean normals up and out from the trunk so each tier reads as soft foliage
    const nor = g.attributes.normal!;
    const n = new THREE.Vector3();
    const out = new THREE.Vector3();
    for (let i = 0; i < nor.count; i++) {
      n.fromBufferAttribute(nor, i);
      out.set(pos.getX(i), r * 0.6, pos.getZ(i)).normalize();
      n.lerp(out, 0.4).normalize();
      nor.setXYZ(i, n.x, n.y, n.z);
    }
    parts.push(g);
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((g) => g.dispose());
  return merged;
}

/** A low shrub: a few lumpy blobs in a squashed dome with a leaf fringe, no visible wood */
export function bushGeometry(seed: number, radius = 0.7): { crown: THREE.BufferGeometry; leaves: THREE.BufferGeometry } {
  const rand = mulberry32(seed);
  const centre = new THREE.Vector3(0, radius * 0.2, 0);
  const blobs: Blob[] = [{ c: new THREE.Vector3(0, radius * 0.45, 0), r: radius * 0.7 }];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rand() * 0.8;
    const d = radius * (0.45 + rand() * 0.2);
    blobs.push({ c: new THREE.Vector3(Math.cos(a) * d, radius * (0.3 + rand() * 0.15), Math.sin(a) * d), r: radius * (0.45 + rand() * 0.15) });
  }
  const cards = new CardBuilder();
  fringeCards(cards, blobs, centre, radius * 1.1, 4, rand);
  return { crown: blobGeometry(blobs, centre, rand), leaves: cards.build() };
}

/**
 * One tuft of grass: three cards round the centre, each bending outward and
 * over as it rises (a few rows of vertices, so the wind bends it too)
 */
export function grassTuftGeometry(width = 0.55, height = 0.4): THREE.BufferGeometry {
  const rows = 3;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const n = new THREE.Vector3();
  for (let c = 0; c < 3; c++) {
    const a = (c / 3) * Math.PI;
    const along = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const out = new THREE.Vector3(-along.z, 0, along.x).multiplyScalar(c % 2 ? 1 : -1);
    const base = pos.length / 3;
    for (let r = 0; r <= rows; r++) {
      const k = r / rows;
      // The card droops outward more toward its top, and sinks a little
      const bend = k * k * height * 0.45;
      const y = height * k * (1 - k * k * 0.12);
      for (const side of [-1, 1]) {
        const p = along.clone().multiplyScalar((side * width) / 2).addScaledVector(out, bend);
        pos.push(p.x, y, p.z);
        // Mostly up, so the tuft catches the sky like the meadow round it
        n.copy(out).multiplyScalar(0.35).add(new THREE.Vector3(0, 1, 0)).normalize();
        nor.push(n.x, n.y, n.z);
        uv.push(side < 0 ? 0 : 1, k);
      }
    }
    for (let r = 0; r < rows; r++) {
      const i = base + r * 2;
      idx.push(i, i + 1, i + 3, i, i + 3, i + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
