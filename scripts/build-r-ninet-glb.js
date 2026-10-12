/**
 * Rebuilds the BMW R nineT Pure GLB for the showroom (/r-ninet-pure).
 *
 * The source is BMW_R_nineT_Pure_2018_web.glb — a Draco-compressed web cut of
 * "BMW R 90 Pure" by Nieve5677 (CC BY 4.0), in metres, facing +Z — whose meshes
 * are grouped by material (one mesh holds both the exhaust headers and the
 * fork tubes, another the engine and gearbox, …). This splits every mesh into
 * connected pieces, sorts the pieces into part nodes by where they sit on the
 * bike (engine_*, forks_lower_*, swingarm_*, …), turns the bike to showroom
 * model space (front -Z, +Y up; wheels centred on their axles), keeps the
 * source materials (glass made plain see-through) and Draco-compresses it
 * again.
 *
 * The number plate is swapped for a BMW roundel on the plate holder.
 *
 * Usage: node scripts/build-r-ninet-glb.js <source.glb> <output.glb>
 */

/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script */
const fs = require("fs");
const draco3d = require("draco3d");
const { split, gather, writeDracoGlb } = require("./lib/glb-tools");

const between = (v, a, b) => v >= a && v <= b;

// Source material → the material family the part rules below test for
const FAMILY = {
  M_Steel_BrakeDisc: "brakedisk",
  M_Chrome: "chrome",
  M_Red: "red",
  M_White: "white",
  M_Metal_Grey: "gray",
  M_Engine_Black: "black",
  M_Frame_Black_Gloss: "black",
  M_Black_Satin: "black",
  M_Glass_Clear: "clearglass",
  M_Plate_Blue: "LicPlate",
  M_Plate_Yellow: "LicPlate",
  M_Plate_Black: "LicPlate",
  M_Plate_White: "LicPlate",
  M_Glass_Red: "redglass",
  M_Glass_Amber: "orangeglass",
  M_BMW_Blue: "blue",
  M_Aluminium_Brushed: "mattemetal",
  M_Mirror: "mirror",
  "M_Paint_CatalanoGrey.001": "carpaint",
  M_Leather_Seat: "black",
  M_Rim_Black_Alu: "rim",
  M_Rubber_Tire: "tire",
};

/**
 * Node group of one piece, from its material family and bounds (model space,
 * metres, front -Z). The first rule that matches wins.
 */
function classifyBase(c, m) {
  const [x, y, z] = c.center;
  const ax = Math.abs(x);
  const [sx, sy, sz] = c.size;
  const big = Math.max(sx, sy, sz);
  const front = z < 0;
  if (m === "tire" || m === "rim") return front ? "wheel_lf" : "wheel_lr";
  if (m === "brakedisk") return front ? "bikedisc_f" : "bikedisc_r";
  if (m === "LicPlate") return "taillight_plate";
  if (m === "redglass") return "taillight_lens";
  if (m === "orangeglass" || m === "clearglass") {
    if (z > 0.8 && ax < 0.06) return "taillight_lens";
    if (ax > 0.1 && between(y, 0.45, 0.56) && z < -0.6) return "reflector_f";
    if (ax > 0.08 && between(y, 0.55, 0.85) && (z < -0.35 || z > 0.75)) return "indicator";
  }
  if (m === "mirror") return "handlebars_mirror";
  if (m === "carpaint") return z < -0.5 ? "fender_f" : "bodywork_tank";
  if (m === "blue") return "bodywork_badge";
  // Headlight bucket, bezel, lens
  if (z < -0.55 && between(y, 0.72, 1.0) && ax < 0.12 && sy < 0.2 && !(between(y, 0.7, 0.76) && sx > 0.2))
    return m === "clearglass" && sx > 0.1 ? "headlight_lens" : "headlight_body";
  // Handlebars, switchgear, speedo
  if (y > 0.9 && (z < -0.3 || ax > 0.22)) return "handlebars";
  // Indicators and their stalks
  if (ax > 0.17 && between(y, 0.58, 0.7) && between(z, -0.5, -0.36)) return "indicator";
  if (between(y, 0.72, 0.85) && z > 0.78 && ax > 0.08) return "indicator";
  // Front fork: crowns + stanchions sprung, lowers / calipers unsprung
  if (z < -0.42 && ax < 0.2 && y < 0.98) {
    if (between(y, 0.25, 0.5) && between(z, -0.68, -0.55) && ax > 0.03 && ax < 0.13 && big < 0.16) return "caliper_f";
    if (y < 0.6) return "forks_lower";
    return "forks_upper";
  }
  // Seat and the tail
  if (y > 0.74 && between(z, 0.2, 0.86) && ax < 0.16 && (sz > 0.15 || sx > 0.2)) return "seat";
  if (z > 0.78 && y > 0.55) return "tail";
  // Exhaust: chrome headers, silencer on the left
  if (m === "chrome" && y < 0.45) return "exhaust";
  if (x < -0.08 && between(z, 0.35, 0.9) && between(y, 0.28, 0.58)) return "exhaust";
  // Aluminium tank side panels
  if (m === "mattemetal" && between(y, 0.5, 0.8) && between(z, -0.35, 0.25) && sz > 0.3) return "bodywork_trim";
  // Shock
  if (ax < 0.08 && sx < 0.12 && between(z, 0.25, 0.42) && between(y, 0.36, 0.7)) return "shock";
  // Paralever: swingarm, final drive (right side)
  if (between(z, 0.165, 0.9) && y < 0.5 && x > -0.08 && !(ax > 0.18 && y > 0.25 && z < 0.35)) return "swingarm";
  // Footrests
  if (ax > 0.18 && between(y, 0.22, 0.5) && between(z, 0.15, 0.6)) return "footrest";
  // Engine block
  if (y < 0.64 && between(z, -0.45, 0.25)) return "engine";
  return "frame";
}

// Bolts and rings on a hub spin with their wheel
const classifyWithHubs = (axles) => (c, m) => {
  const g = classifyBase(c, m);
  const [x, y, z] = c.center;
  const big = Math.max(...c.size);
  for (const [name, a] of [
    ["wheel_lf", axles.front],
    ["wheel_lr", axles.rear],
  ]) {
    const d = Math.hypot(y - a[1], z - a[2]);
    if (d < 0.115 && Math.abs(x) < 0.085 && big < 0.06 && !g.startsWith("wheel") && !g.startsWith("bikedisc") && g !== "swingarm")
      return `${name}_hub`;
  }
  return g;
};

// Source mesh names help only where they're one material on one part: the
// other meshes are material groups, so "RearSwingarm_FinalDrive" also holds
// the silencer end cap and "Frame_Main" gloss-black engine parts
const hint = (mesh, group) => {
  if (mesh === "Seat_Leather") return "seat";
  // The intake under the tank sits above the engine rule's box
  if (mesh === "Engine_Gearbox" && group === "frame") return "engine";
  return group;
};

async function load(file) {
  const b = fs.readFileSync(file);
  const jl = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + jl).toString());
  const bin = b.subarray(28 + jl);
  const dm = await draco3d.createDecoderModule({});
  const decoder = new dm.Decoder();
  const prims = [];
  for (const node of j.nodes) {
    if (node.mesh === undefined) continue;
    const p = j.meshes[node.mesh].primitives[0];
    const ext = p.extensions.KHR_draco_mesh_compression;
    const bv = j.bufferViews[ext.bufferView];
    const start = bv.byteOffset || 0;
    const data = bin.subarray(start, start + bv.byteLength);
    const buffer = new dm.DecoderBuffer();
    buffer.Init(new Int8Array(data.buffer, data.byteOffset, data.byteLength), data.byteLength);
    const mesh = new dm.Mesh();
    const status = decoder.DecodeBufferToMesh(buffer, mesh);
    if (!status.ok()) throw new Error(`${node.name}: ${status.error_msg()}`);
    const read = (id) => {
      const attr = decoder.GetAttributeByUniqueId(mesh, id);
      const arr = new dm.DracoFloat32Array();
      decoder.GetAttributeFloatForAllPoints(mesh, attr, arr);
      const out = new Float32Array(arr.size());
      for (let i = 0; i < out.length; i++) out[i] = arr.GetValue(i);
      dm.destroy(arr);
      return out;
    };
    const pos = read(ext.attributes.POSITION);
    const nor = read(ext.attributes.NORMAL);
    const nf = mesh.num_faces();
    const idx = new Uint32Array(nf * 3);
    const face = new dm.DracoInt32Array();
    for (let f = 0; f < nf; f++) {
      decoder.GetFaceFromMesh(mesh, f, face);
      for (let q = 0; q < 3; q++) idx[3 * f + q] = face.GetValue(q);
    }
    [face, mesh, buffer].forEach((o) => dm.destroy(o));
    // Node translation (wheels, discs), then a half turn about Y: front to -Z
    const t = node.translation || [0, 0, 0];
    for (let k = 0; k < pos.length; k += 3) {
      pos[k] = -(pos[k] + t[0]);
      pos[k + 1] += t[1];
      pos[k + 2] = -(pos[k + 2] + t[2]);
      nor[k] = -nor[k];
      nor[k + 2] = -nor[k + 2];
    }
    const material = j.materials[p.material];
    prims.push({
      name: node.name,
      material,
      family: FAMILY[material.name] ?? "black",
      pos,
      nor,
      idx,
      comps: split(pos, idx),
    });
  }
  return prims;
}

// Output material from the source one: transmission glass becomes plain
// alpha-blended glass (no transmission pass), and anisotropy goes (it needs
// UVs, which aren't kept)
function material(src) {
  const m = JSON.parse(JSON.stringify(src));
  m.name = m.name.replace(/\.\d+$/, "");
  const ext = m.extensions || {};
  delete ext.KHR_materials_anisotropy;
  if (ext.KHR_materials_transmission) {
    delete ext.KHR_materials_transmission;
    delete ext.KHR_materials_ior;
    const c = m.pbrMetallicRoughness.baseColorFactor || [1, 1, 1, 1];
    m.pbrMetallicRoughness.baseColorFactor = [c[0], c[1], c[2], m.name === "M_Glass_Clear" ? 0.28 : 0.7];
    m.alphaMode = "BLEND";
  }
  if (Object.keys(ext).length) m.extensions = ext;
  else delete m.extensions;
  return m;
}

// Number plate meshes dropped whole (the holder only loses its characters)
const PLATE_MESHES = ["LicensePlate_Plate", "LicensePlate_EU_Band", "LicensePlate_EU_Stars"];

/**
 * A flat BMW roundel on the number-plate holder, facing back: chrome rims, a
 * black ring with B M W across the top, and blue / white quarters (blue top
 * left and bottom right). Returns one mesh per material, in model space.
 */
async function roundel(prims) {
  const { FontLoader } = await import("three/examples/jsm/loaders/FontLoader.js");
  const THREE = await import("three");
  const fontPath = require.resolve("three").replace(/build[\\/].*$/, "examples/fonts/helvetiker_bold.typeface.json");
  const font = new FontLoader().parse(JSON.parse(fs.readFileSync(fontPath, "utf8")));
  const mat = (name) => prims.find((p) => p.material.name === name).material;

  // The plate's frame: centre, outward normal (towards the back), up, right
  const plate = prims.find((p) => p.name === "LicensePlate_Plate");
  // The plate itself is the widest piece (its "AU" letters have more triangles)
  const face = plate.comps.reduce((a, b) => (a.size[0] > b.size[0] ? a : b));
  const n = [0, 0, 0];
  for (const t of face.tris) {
    const v = [0, 1, 2].map((q) => plate.idx[3 * t + q]);
    const P = v.map((i) => [0, 1, 2].map((a) => plate.pos[3 * i + a]));
    const e1 = P[1].map((x, a) => x - P[0][a]);
    const e2 = P[2].map((x, a) => x - P[0][a]);
    const c = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    // Both faces of the plate: fold them onto the back-facing side
    const s = c[2] < 0 ? -1 : 1;
    for (let a = 0; a < 3; a++) n[a] += s * c[a];
  }
  const len = Math.hypot(...n);
  const N = n.map((x) => x / len);
  const upRaw = [0 - N[1] * N[0], 1 - N[1] * N[1], 0 - N[1] * N[2]];
  const ul = Math.hypot(...upRaw);
  const U = upRaw.map((x) => x / ul);
  const R = [U[1] * N[2] - U[2] * N[1], U[2] * N[0] - U[0] * N[2], U[0] * N[1] - U[1] * N[0]];
  // Front face of the plate, from its bounds along the normal
  let depth = -1e9;
  for (const t of face.tris)
    for (let q = 0; q < 3; q++) {
      const i = plate.idx[3 * t + q];
      depth = Math.max(depth, [0, 1, 2].reduce((s, a) => s + (plate.pos[3 * i + a] - face.center[a]) * N[a], 0));
    }

  const RADIUS = 0.064;
  const layers = new Map();
  const layer = (name) => {
    if (!layers.has(name)) layers.set(name, { name: "Logo", material: mat(name), pos: [], nor: [], idx: [] });
    return layers.get(name);
  };
  // 2D triangles (plate coords, metres) → model space, `lift` off the plate
  const put = (name, tris2d, lift) => {
    const l = layer(name);
    const off = depth + lift;
    for (const [a, b] of tris2d) {
      for (let k = 0; k < 3; k++) {
        l.pos.push(face.center[k] + N[k] * off + R[k] * a + U[k] * b);
        l.nor.push(N[k]);
      }
      l.idx.push(l.idx.length);
    }
  };
  const ring = (r0, r1, a0 = 0, a1 = Math.PI * 2, seg = 96) => {
    const out = [];
    const steps = Math.max(2, Math.ceil((seg * (a1 - a0)) / (Math.PI * 2)));
    for (let i = 0; i < steps; i++) {
      const t0 = a0 + ((a1 - a0) * i) / steps;
      const t1 = a0 + ((a1 - a0) * (i + 1)) / steps;
      const p = (r, t) => [r * Math.cos(t), r * Math.sin(t)];
      if (r0 === 0) out.push([0, 0], p(r1, t0), p(r1, t1));
      else out.push(p(r0, t0), p(r1, t0), p(r1, t1), p(r0, t0), p(r1, t1), p(r0, t1));
    }
    return out;
  };

  put("M_Frame_Black_Gloss", ring(0, RADIUS), 0.002);
  put("M_Chrome", ring(RADIUS * 0.93, RADIUS), 0.0025);
  put("M_Chrome", ring(RADIUS * 0.6, RADIUS * 0.65), 0.0025);
  const q = Math.PI / 2;
  // Quarters counter-clockwise from the top right: white, blue, white, blue
  ["M_White", "M_BMW_Blue", "M_White", "M_BMW_Blue"].forEach((m, i) =>
    put(m, ring(0, RADIUS * 0.6, i * q, (i + 1) * q, 64), 0.0025),
  );

  // B M W on the ring, upright to the centre, left to right over the top
  const mid = RADIUS * 0.79;
  [
    ["B", 140],
    ["M", 90],
    ["W", 40],
  ].forEach(([ch, deg]) => {
    const g = new THREE.ShapeGeometry(font.generateShapes(ch, RADIUS * 0.24));
    g.computeBoundingBox();
    const c = g.boundingBox.getCenter(new THREE.Vector3());
    const t = (deg * Math.PI) / 180;
    g.translate(-c.x, -c.y, 0);
    g.rotateZ(t - Math.PI / 2);
    g.translate(mid * Math.cos(t), mid * Math.sin(t), 0);
    const p = g.attributes.position.array;
    const index = g.index ? g.index.array : p.map((_, i) => i);
    const tris = [];
    for (let i = 0; i < index.length; i++) tris.push([p[3 * index[i]], p[3 * index[i] + 1]]);
    put("M_Chrome", tris, 0.0028);
  });

  return [...layers.values()].map((l) => ({
    ...l,
    pos: new Float32Array(l.pos),
    nor: new Float32Array(l.nor),
    idx: new Uint32Array(l.idx),
  }));
}

async function main() {
  const [, , src, out] = process.argv;
  const prims = await load(src);

  const tyres = prims
    .filter((p) => p.family === "tire")
    .flatMap((p) => p.comps)
    .sort((a, b) => b.tris.length - a.tris.length)
    .slice(0, 2);
  const front = tyres.find((c) => c.center[2] < 0).center;
  const rear = tyres.find((c) => c.center[2] > 0).center;
  console.log("axles", front.map((v) => v.toFixed(4)), rear.map((v) => v.toFixed(4)));
  const classify = classifyWithHubs({ front, rear });

  // The number plate goes: a BMW roundel takes its place on the holder
  const logo = await roundel(prims);
  const kept = (p, c) =>
    !PLATE_MESHES.includes(p.name) && !(p.name === "LicensePlate_Holder" && Math.max(...c.size) < 0.1);

  // Nodes: <group>_<material>, or just <group> when it has one material
  const nodes = new Map();
  const add = (group, material, piece) => {
    const key = `${group}|${material.name}`;
    if (!nodes.has(key)) nodes.set(key, { group, material, pieces: [] });
    nodes.get(key).pieces.push(piece);
  };
  for (const p of prims)
    for (const c of p.comps) if (kept(p, c)) add(hint(p.name, classify(c, p.family)), p.material, { p, tris: c.tris });
  for (const l of logo) add("taillight_logo", l.material, { p: l, tris: Array.from({ length: l.idx.length / 3 }, (_, i) => i) });
  const byGroup = {};
  for (const n of nodes.values()) (byGroup[n.group] ??= []).push(n);
  for (const [g, ns] of Object.entries(byGroup))
    ns.forEach((n) => {
      const mat = n.material.name.replace(/^M_/, "").replace(/\.\d+$/, "").toLowerCase();
      n.name = ns.length === 1 ? g : `${g}_${mat}`;
    });

  const converted = new Map();
  const out_ = (src) => {
    if (!converted.has(src)) converted.set(src, material(src));
    return converted.get(src);
  };
  await writeDracoGlb(out, {
    root: "bmw_r_ninet_pure",
    asset: {
      generator: "three-portfolio scripts/build-r-ninet-glb.js",
      copyright:
        '"BMW R 90 Pure" by Nieve5677 (https://sketchfab.com/iori308408), CC BY 4.0, modified — https://sketchfab.com/3d-models/bmw-r-90-pure-01cf4b2bbea447fa978b4f57b3ca1db9',
    },
    nodes: [...nodes.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((n) => {
        // Wheels spin about their own origin: put it on the axle
        const origin = n.group.startsWith("wheel_lf") ? front : n.group.startsWith("wheel_lr") ? rear : [0, 0, 0];
        return { name: n.name, material: out_(n.material), translation: origin, ...gather(n.pieces, origin) };
      }),
  });
}

// Run as a script; required, it lends its loader to one-off inspection scripts
if (require.main === module) main();
else module.exports = { load, classifyBase };
