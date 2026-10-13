import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

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

/** Grass blades for ground tufts */
export function makeGrassTexture(seed = 3) {
  return canvasTexture(
    128,
    128,
    (ctx, rand) => {
      for (let i = 0; i < 42; i++) {
        const x = 10 + rand() * 108;
        const h = 50 + rand() * 75;
        const lean = (rand() - 0.5) * 40;
        const w = 2 + rand() * 3;
        const hue = 75 + rand() * 30;
        const g = ctx.createLinearGradient(0, 128, 0, 128 - h);
        g.addColorStop(0, hsl(hue, 40, 14));
        g.addColorStop(1, hsl(hue, 45, 34 + rand() * 12));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - w, 128);
        ctx.quadraticCurveTo(x + lean * 0.3, 128 - h * 0.6, x + lean, 128 - h);
        ctx.quadraticCurveTo(x + lean * 0.3 + w * 0.5, 128 - h * 0.6, x + w, 128);
        ctx.fill();
      }
    },
    seed,
  );
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

// ---------------------------------------------------------------- geometry

const UP = new THREE.Vector3(0, 1, 0);

interface Limb {
  a: THREE.Vector3;
  b: THREE.Vector3;
  r0: number;
  r1: number;
}

function limbGeometry(limbs: Limb[], radial = 7) {
  const parts = limbs.map(({ a, b, r0, r1 }) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const g = new THREE.CylinderGeometry(r1, r0, len, radial, 1, true);
    // Bark texture runs along the limb, about one repeat per metre
    const uv = g.attributes.uv!;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(r0 * 12)), uv.getY(i) * len);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()));
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    return g;
  });
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

class CardBuilder {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  idx: number[] = [];
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
    for (const [su, sv, tu, tv] of corners) {
      p.copy(c).addScaledVector(u, su).addScaledVector(v, sv);
      n.subVectors(p, centre).normalize().lerp(UP, 0.25).normalize();
      this.pos.push(p.x, p.y, p.z);
      this.nor.push(n.x, n.y, n.z);
      this.uv.push(tu, tv);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
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
  leaves: THREE.BufferGeometry;
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
  cardSize?: number;
  cardsPerTip?: number;
  // Extra cards scattered through the crown's volume
  fillCards?: number;
  // Leaf cards for which this returns true are left out
  exclude?: (p: THREE.Vector3) => boolean;
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
  cardsPerTip = 7,
  fillCards = 40,
  exclude,
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

  const cards = new CardBuilder();
  const u = new THREE.Vector3();
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (const tip of tips) {
    for (let k = 0; k < cardsPerTip; k++) {
      c.copy(tip.p).addScaledVector(randomUnit(rand, u), cardSize * 0.55).addScaledVector(tip.d, cardSize * 0.2);
      if (exclude?.(c)) continue;
      const size = cardSize * (0.75 + rand() * 0.5);
      randomUnit(rand, u).multiplyScalar(size / 2);
      v.crossVectors(randomUnit(rand, c.clone()), u).normalize().multiplyScalar(size / 2);
      if (v.lengthSq() < 1e-6) continue;
      cards.add(c, u, v, centre);
    }
  }
  // Fill: cards through an ellipsoid round the tips, denser toward the middle
  const box = new THREE.Box3().setFromPoints(tips.map((t) => t.p));
  const mid = box.getCenter(new THREE.Vector3());
  const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5).addScalar(cardSize * 0.3);
  for (let k = 0; k < fillCards; k++) {
    randomUnit(rand, c).multiplyScalar(Math.pow(rand(), 0.6));
    c.multiply(half).add(mid);
    if (c.y < mid.y - half.y * 0.6) c.y = mid.y - half.y * 0.6 + rand() * 0.3;
    if (exclude?.(c)) continue;
    const size = cardSize * (0.9 + rand() * 0.5);
    randomUnit(rand, u).multiplyScalar(size / 2);
    v.crossVectors(randomUnit(rand, new THREE.Vector3()), u).normalize().multiplyScalar(size / 2);
    if (v.lengthSq() < 1e-6) continue;
    cards.add(c, u, v, centre);
  }
  return { bark: limbGeometry(limbs), leaves: cards.build() };
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
      cards.add(mid, half, side, centre);
      // A second, steeper card makes the spray read from above and below
      cards.add(mid, half, side.clone().applyAxisAngle(along, 1.2), centre);
    }
  }
  // The leader at the very top
  const topMid = new THREE.Vector3(0, height - 0.2, 0);
  cards.add(topMid, new THREE.Vector3(0, 0.45, 0), new THREE.Vector3(0.22, 0, 0), centre, [0, 0, 1, 1]);
  cards.add(topMid, new THREE.Vector3(0, 0.45, 0), new THREE.Vector3(0, 0, 0.22), centre, [0, 0, 1, 1]);
  return { bark: limbGeometry(limbs, 6), leaves: cards.build() };
}

/** A low shrub: leaf cards in a squashed dome, no visible wood */
export function bushGeometry(seed: number, radius = 0.7): THREE.BufferGeometry {
  const rand = mulberry32(seed);
  const cards = new CardBuilder();
  const centre = new THREE.Vector3(0, radius * 0.2, 0);
  const u = new THREE.Vector3();
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < 26; i++) {
    randomUnit(rand, c);
    c.y = Math.abs(c.y) * 0.75;
    c.multiplyScalar(radius * (0.4 + rand() * 0.6));
    const size = radius * (0.7 + rand() * 0.5);
    randomUnit(rand, u).multiplyScalar(size / 2);
    v.crossVectors(randomUnit(rand, new THREE.Vector3()), u).normalize().multiplyScalar(size / 2);
    cards.add(c.clone(), u.clone(), v.clone(), centre);
  }
  return cards.build();
}

/** Two crossed upright quads, base on the ground: one tuft of grass */
export function grassTuftGeometry(width = 0.55, height = 0.38): THREE.BufferGeometry {
  const cards = new CardBuilder();
  const centre = new THREE.Vector3(0, -2, 0); // normals mostly up: grass catches the sky
  for (const a of [0, Math.PI / 2]) {
    const u = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(width / 2);
    cards.add(new THREE.Vector3(0, height / 2, 0), u, new THREE.Vector3(0, height / 2, 0), centre);
  }
  return cards.build();
}
