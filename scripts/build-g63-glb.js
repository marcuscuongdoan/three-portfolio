/**
 * Builds the Mercedes-AMG G 63 GLB for the showroom (/g63).
 *
 * The source (public/models/cars/G63.glb) is a W463 G 63 with no usable
 * materials (every slot is a black "fallback Material"), the car along -X and
 * oversized (its wheelbase is 3.11 m). This bakes the node transforms, scales
 * it to the real 2,850 mm wheelbase, turns it to showroom model space (front
 * -Z, +Y up, right +X, centred), splits the meshes into connected pieces and
 * sorts them into part nodes — bonnet, grille, the four doors, tailgate,
 * wheels, brakes, lights, body — and gives every material slot a real
 * material. Each wheel's node sits on its axle so it can spin.
 *
 * Usage: node scripts/build-g63-glb.js <source.glb> <output.glb>
 */

/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script */
const fs = require("fs");
const { split, gather, writeDracoGlb } = require("./lib/glb-tools");

const WHEELBASE = 2.85;

// sRGB hex → linear RGBA
const lin = (hex, alpha = 1) => [
  ...[1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }),
  alpha,
];
const mat = (name, hex, metal, rough, extra = {}) => {
  const { alpha, clearcoat, emissive } = extra;
  const m = { name, pbrMetallicRoughness: { baseColorFactor: lin(hex, alpha ?? 1), metallicFactor: metal, roughnessFactor: rough } };
  if (alpha !== undefined) {
    m.alphaMode = "BLEND";
    m.doubleSided = true;
  }
  if (clearcoat) m.extensions = { KHR_materials_clearcoat: { clearcoatFactor: clearcoat, clearcoatRoughnessFactor: 0.06 } };
  if (emissive) m.emissiveFactor = lin(emissive).slice(0, 3);
  return m;
};

const M = {
  paint: mat("M_Paint", "#16181c", 0.6, 0.28, { clearcoat: 1 }),
  // AMG colour package: mirrors, bumpers, wheel-arch flares and the spare
  // wheel cover ring stay obsidian black whatever the body colour
  accent: mat("M_Paint_Accent", "#16181c", 0.6, 0.28, { clearcoat: 1 }),
  trim: mat("M_Trim_Black", "#0e0f11", 0, 0.55),
  chrome: mat("M_Chrome", "#dfe2e6", 1, 0.08),
  grille: mat("M_Grille_Mesh", "#121315", 0.4, 0.35),
  glass: mat("M_Glass", "#0d1318", 0, 0.04, { alpha: 0.8 }),
  headlight: mat("M_Headlight_Lens", "#f4f7fa", 0, 0.03, { alpha: 0.35 }),
  drl: mat("M_DRL", "#f2f5f8", 0, 0.1, { alpha: 0.7 }),
  amber: mat("M_Amber_Lens", "#f08a1c", 0, 0.08, { alpha: 0.8 }),
  taillight: mat("M_Taillight_Lens", "#a5121b", 0, 0.08, { alpha: 0.88 }),
  mirror: mat("M_Mirror", "#e9eef0", 1, 0.03),
  plateFrame: mat("M_Plate_Frame", "#0b0b0c", 0, 0.5),
  plate: mat("M_Plate", "#f1f1ee", 0, 0.6),
  tyre: mat("M_Tyre", "#161617", 0, 0.88),
  tyreWall: mat("M_Tyre_Sidewall", "#202022", 0, 0.8),
  rim: mat("M_Rim", "#3a3c40", 0.85, 0.3),
  rimLip: mat("M_Rim_Lip", "#c9ccd0", 1, 0.18),
  disc: mat("M_Brake_Disc", "#9a9ca0", 1, 0.38),
  caliper: mat("M_Caliper", "#b3121b", 0.2, 0.35, { clearcoat: 0.6 }),
};

// Source material slot → output material (see the slot survey in the commit)
const SLOT = {
  0: M.rimLip,
  1: M.disc,
  2: M.caliper,
  3: M.rim,
  4: M.tyre,
  5: M.tyreWall,
  6: M.glass,
  7: M.trim,
  8: M.chrome,
  9: M.plateFrame,
  10: M.plate,
  11: M.grille,
  12: M.paint,
  13: M.drl,
  14: M.amber,
  15: M.chrome,
  16: M.mirror,
  17: M.chrome,
  18: M.headlight,
  19: M.chrome,
  20: M.amber,
  21: M.mirror,
  22: M.taillight,
};

// Matrix helpers (column-major, glTF order)
const mul = (a, b) => {
  const r = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) for (let l = 0; l < 4; l++) r[k * 4 + i] += a[l * 4 + i] * b[k * 4 + l];
  return r;
};
const local = (n) => {
  if (n.matrix) return n.matrix;
  const t = n.translation || [0, 0, 0];
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1];
  const s = n.scale || [1, 1, 1];
  return [
    (1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + z * w) * s[0], 2 * (x * z - y * w) * s[0], 0,
    2 * (x * y - z * w) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + x * w) * s[1], 0,
    2 * (x * z + y * w) * s[2], 2 * (y * z - x * w) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
};

// Every primitive in world space (node transforms baked; mirrored nodes get
// their winding flipped)
function load(file) {
  const b = fs.readFileSync(file);
  const jl = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + jl).toString());
  const bin = b.subarray(28 + jl);
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const read = (i) => {
    const a = j.accessors[i];
    const bv = j.bufferViews[a.bufferView];
    const n = { VEC3: 3, VEC2: 2, SCALAR: 1 }[a.type];
    const size = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[a.componentType];
    const stride = bv.byteStride || size * n;
    const off = (bv.byteOffset || 0) + (a.byteOffset || 0);
    const out = a.componentType === 5126 ? new Float32Array(a.count * n) : new Uint32Array(a.count * n);
    for (let k = 0; k < a.count; k++)
      for (let c = 0; c < n; c++) {
        const p = off + k * stride + c * size;
        out[k * n + c] =
          a.componentType === 5126 ? dv.getFloat32(p, true)
          : a.componentType === 5125 ? dv.getUint32(p, true)
          : a.componentType === 5123 ? dv.getUint16(p, true)
          : dv.getUint8(p);
      }
    return out;
  };
  const prims = [];
  const walk = (i, parent) => {
    const n = j.nodes[i];
    const w = mul(parent, local(n));
    if (n.mesh !== undefined)
      for (const p of j.meshes[n.mesh].primitives) {
        const P = read(p.attributes.POSITION);
        const N = read(p.attributes.NORMAL);
        const idx = read(p.indices);
        const det =
          w[0] * (w[5] * w[10] - w[9] * w[6]) - w[4] * (w[1] * w[10] - w[9] * w[2]) + w[8] * (w[1] * w[6] - w[5] * w[2]);
        const pos = new Float32Array(P.length);
        const nor = new Float32Array(N.length);
        for (let k = 0; k < P.length; k += 3) {
          for (let a = 0; a < 3; a++) {
            pos[k + a] = w[a] * P[k] + w[4 + a] * P[k + 1] + w[8 + a] * P[k + 2] + w[12 + a];
            nor[k + a] = w[a] * N[k] + w[4 + a] * N[k + 1] + w[8 + a] * N[k + 2];
          }
          const l = Math.hypot(nor[k], nor[k + 1], nor[k + 2]) || 1;
          for (let a = 0; a < 3; a++) nor[k + a] /= l;
        }
        if (det < 0)
          for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]];
        prims.push({ slot: p.material, pos, nor, idx });
      }
    (n.children || []).forEach((c) => walk(c, w));
  };
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  j.scenes[0].nodes.forEach((r) => walk(r, I));
  return prims;
}

const between = (v, a, b) => v >= a && v <= b;

async function main() {
  const [, , src, out] = process.argv;
  const prims = load(src);

  // Source frame: the car along X (front at -X), Y up, Z across. The wheels
  // are the four tyres (slot 4)
  const tyres = prims.filter((p) => p.slot === 4).map((p) => ({ p, c: split(p.pos, p.idx)[0] }));
  const xs = tyres.map((t) => t.c.center[0]);
  const wheelbase = Math.max(...xs) - Math.min(...xs);
  const s = WHEELBASE / wheelbase;
  const bb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
  for (const p of prims)
    for (let k = 0; k < p.pos.length; k += 3)
      for (let a = 0; a < 3; a++) {
        bb[a] = Math.min(bb[a], p.pos[k + a]);
        bb[a + 3] = Math.max(bb[a + 3], p.pos[k + a]);
      }
  const cx = (bb[0] + bb[3]) / 2;
  const cz = (bb[2] + bb[5]) / 2;
  console.log("source wheelbase", wheelbase.toFixed(3), "scale", s.toFixed(4));

  // To model space: x' = -(z - cz), z' = x - cx (a quarter turn about Y), scaled
  for (const p of prims)
    for (let k = 0; k < p.pos.length; k += 3) {
      const [x, y, z] = [p.pos[k], p.pos[k + 1], p.pos[k + 2]];
      p.pos[k] = -(z - cz) * s;
      p.pos[k + 1] = y * s;
      p.pos[k + 2] = (x - cx) * s;
      const [nx, nz] = [p.nor[k], p.nor[k + 2]];
      p.nor[k] = -nz;
      p.nor[k + 2] = nx;
    }
  prims.forEach((p) => (p.comps = split(p.pos, p.idx)));

  // Wheels: each tyre's corner and axle. The wheel slots (0-5: rim, disc,
  // caliper, tyre) go to the corner they sit at
  const cornerAt = (c) => `${c[0] < 0 ? "l" : "r"}${c[2] < 0 ? "f" : "r"}`;
  const axles = {};
  for (const t of tyres) {
    const c = split(t.p.pos, t.p.idx)[0].center;
    axles[cornerAt(c)] = c;
  }
  console.log("axles", Object.fromEntries(Object.entries(axles).map(([k, v]) => [k, v.map((x) => +x.toFixed(4))])));

  // Doors: the thin, tall body-colour side panels
  const doors = prims
    .filter((p) => p.slot === 12)
    .flatMap((p) => p.comps)
    .filter((c) => c.size[0] < 0.15 && c.size[1] > 1.1 && between(c.size[2], 0.75, 1.1))
    .map((c) => ({ side: c.center[0] < 0 ? "l" : "r", row: c.center[2] < -0.3 ? "f" : "r", z0: c.bb[2], z1: c.bb[5] }));
  console.log("doors", doors.map((d) => `${d.row}${d.side} ${d.z0.toFixed(2)}..${d.z1.toFixed(2)}`).join(" | "));

  const classify = (p, c) => {
    if (p.slot <= 5) {
      const corner = cornerAt(c.center);
      return p.slot === 1 ? `disc_${corner}` : p.slot === 2 ? `caliper_${corner}` : `wheel_${corner}`;
    }
    const [x, y, z] = c.center;
    const ax = Math.abs(x);
    const [sx, , sz] = c.size;
    // Lights first: lens slots are the same front to back
    if (p.slot === 22) return "taillight";
    if (p.slot === 13) return "headlight_drl";
    if (p.slot === 18 && z < -2.1) return "headlight_lens";
    if (p.slot === 14 || p.slot === 20 || (p.slot === 18 && ax < 0.8)) return "indicator";
    // Doors: anything on a door's side within its length (glass, frames,
    // handles, mirrors)
    for (const d of doors)
      if ((x < 0 ? "l" : "r") === d.side && ax > 0.62 && between(z, d.z0 - 0.02, d.z1 + 0.02) && sz < d.z1 - d.z0 + 0.06 && between(y, 0.5, 1.95))
        return `door_${d.row}${d.side}`;
    // Bonnet: the top of the nose ahead of the windscreen
    if (z < -1.0 && y > 1.03 && ax < 0.75 && sx > 0.03) return "hood";
    // Headlight housings either side of the grille
    if (z < -2.05 && between(y, 0.75, 1.1) && between(ax, 0.42, 0.85) && Math.max(...c.size) < 0.4) return "headlight_housing";
    // Grille and front bumper
    if (z < -2.12) return "front";
    // Tailgate (with the spare wheel and rear window), rear bumper
    if (z > 1.85 && y > 0.78) return "tailgate";
    if (z > 1.85) return "rear_bumper";
    return "body";
  };

  // AMG colour package parts stay black: mirrors, bumpers, wheel-arch flares,
  // spare wheel cover ring
  const accent = (group, c) => {
    const [x, y] = c.center;
    if (group === "front" || group === "rear_bumper") return true;
    if (group.startsWith("door_f") && y > 1.2 && Math.abs(x) > 0.92) return true;
    // Flares: low, outboard, short pieces around the arches
    if (group === "body" && Math.abs(x) > 0.85 && y < 1.05 && c.size[1] < 0.75 && c.size[2] < 1.3) return true;
    return false;
  };

  const nodes = new Map();
  for (const p of prims)
    for (const c of p.comps) {
      const group = classify(p, c);
      let material = SLOT[p.slot];
      if (material === M.paint && accent(group, c)) material = M.accent;
      const key = `${group}|${material.name}`;
      if (!nodes.has(key)) nodes.set(key, { group, material, pieces: [] });
      nodes.get(key).pieces.push({ p, tris: c.tris });
    }
  const byGroup = {};
  for (const n of nodes.values()) (byGroup[n.group] ??= []).push(n);
  for (const [g, ns] of Object.entries(byGroup))
    ns.forEach((n) => (n.name = ns.length === 1 ? g : `${g}_${n.material.name.replace(/^M_/, "").toLowerCase()}`));

  await writeDracoGlb(out, {
    root: "mercedes_amg_g63",
    asset: { generator: "three-portfolio scripts/build-g63-glb.js" },
    nodes: [...nodes.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((n) => {
        // Wheels spin about their own origin: put it on the axle
        const corner = n.group.startsWith("wheel_") ? n.group.slice(6, 8) : null;
        const origin = corner ? axles[corner] : [0, 0, 0];
        return { name: n.name, material: n.material, translation: origin, ...gather(n.pieces, origin) };
      }),
  });
}

main();
