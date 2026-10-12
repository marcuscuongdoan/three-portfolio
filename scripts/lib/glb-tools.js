/**
 * Shared helpers for the showroom model build scripts (build-*-glb.js):
 * splitting a mesh into connected pieces, gathering pieces into one mesh, and
 * writing a Draco-compressed GLB.
 */

/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script */
const fs = require("fs");
const draco3d = require("draco3d");

// Connected pieces (vertices welded by position), with their bounds
function split(pos, idx) {
  const V = pos.length / 3;
  const par = new Int32Array(V).map((_, i) => i);
  const find = (x) => {
    while (par[x] !== x) x = par[x] = par[par[x]];
    return x;
  };
  const union = (a, b) => {
    a = find(a);
    b = find(b);
    if (a !== b) par[a] = b;
  };
  const seen = new Map();
  for (let i = 0; i < V; i++) {
    const k = `${Math.round(pos[3 * i] * 1e4)},${Math.round(pos[3 * i + 1] * 1e4)},${Math.round(pos[3 * i + 2] * 1e4)}`;
    const e = seen.get(k);
    if (e === undefined) seen.set(k, i);
    else union(i, e);
  }
  for (let t = 0; t < idx.length; t += 3) {
    union(idx[t], idx[t + 1]);
    union(idx[t], idx[t + 2]);
  }
  const comps = new Map();
  for (let t = 0; t < idx.length; t += 3) {
    const r = find(idx[t]);
    let c = comps.get(r);
    if (!c) comps.set(r, (c = { tris: [], bb: [1e9, 1e9, 1e9, -1e9, -1e9, -1e9] }));
    c.tris.push(t / 3);
    for (let q = 0; q < 3; q++) {
      const v = idx[t + q];
      for (let a = 0; a < 3; a++) {
        c.bb[a] = Math.min(c.bb[a], pos[3 * v + a]);
        c.bb[a + 3] = Math.max(c.bb[a + 3], pos[3 * v + a]);
      }
    }
  }
  return [...comps.values()].map((c) => ({
    ...c,
    center: [0, 1, 2].map((a) => (c.bb[a] + c.bb[a + 3]) / 2),
    size: [0, 1, 2].map((a) => c.bb[a + 3] - c.bb[a]),
  }));
}

/**
 * One mesh from pieces ({ p: { pos, nor, idx }, tris }), positions relative
 * to `origin`
 */
function gather(pieces, origin = [0, 0, 0]) {
  const pos = [];
  const nor = [];
  const idx = [];
  let vc = 0;
  for (const { p, tris } of pieces) {
    const map = new Map();
    for (const t of tris)
      for (let q = 0; q < 3; q++) {
        const v = p.idx[3 * t + q];
        let nv = map.get(v);
        if (nv === undefined) {
          map.set(v, (nv = vc++));
          for (let a = 0; a < 3; a++) {
            pos.push(p.pos[3 * v + a] - origin[a]);
            nor.push(p.nor[3 * v + a]);
          }
        }
        idx.push(nv);
      }
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), idx: new Uint32Array(idx) };
}

// Draco-encodes one mesh; decodes it back for the accessor counts and bounds
function encode(em, dm, pos, nor, idx) {
  const builder = new em.MeshBuilder();
  const mesh = new em.Mesh();
  const vc = pos.length / 3;
  const posId = builder.AddFloatAttributeToMesh(mesh, em.POSITION, vc, 3, pos);
  const norId = builder.AddFloatAttributeToMesh(mesh, em.NORMAL, vc, 3, nor);
  builder.AddFacesToMesh(mesh, idx.length / 3, idx);
  const encoder = new em.Encoder();
  encoder.SetAttributeQuantization(em.POSITION, 14);
  encoder.SetAttributeQuantization(em.NORMAL, 10);
  encoder.SetSpeedOptions(3, 3);
  encoder.SetEncodingMethod(em.MESH_EDGEBREAKER_ENCODING);
  const encoded = new em.DracoInt8Array();
  const len = encoder.EncodeMeshToDracoBuffer(mesh, encoded);
  const bytes = Buffer.alloc(len);
  for (let i = 0; i < len; i++) bytes[i] = encoded.GetValue(i);
  [encoded, encoder, mesh, builder].forEach((o) => em.destroy(o));

  const decoder = new dm.Decoder();
  const buffer = new dm.DecoderBuffer();
  buffer.Init(new Int8Array(bytes.buffer, bytes.byteOffset, len), len);
  const back = new dm.Mesh();
  decoder.DecodeBufferToMesh(buffer, back);
  const arr = new dm.DracoFloat32Array();
  decoder.GetAttributeFloatForAllPoints(back, decoder.GetAttributeByUniqueId(back, posId), arr);
  const min = [1e9, 1e9, 1e9];
  const max = [-1e9, -1e9, -1e9];
  for (let i = 0; i < arr.size(); i++) {
    min[i % 3] = Math.min(min[i % 3], arr.GetValue(i));
    max[i % 3] = Math.max(max[i % 3], arr.GetValue(i));
  }
  const result = { bytes, posId, norId, points: back.num_points(), faces: back.num_faces(), min, max };
  [arr, back, buffer, decoder].forEach((o) => dm.destroy(o));
  return result;
}

/**
 * Writes a Draco-compressed GLB: one root node holding `nodes`, each
 * { name, material (glTF material JSON), pos, nor, idx, translation? }.
 * Nodes sharing a material object share the glTF material.
 */
async function writeDracoGlb(out, { root, nodes, asset }) {
  const em = await draco3d.createEncoderModule({});
  const dm = await draco3d.createDecoderModule({});
  const materials = [];
  const matIndex = new Map();
  const chunks = [];
  let offset = 0;
  const bufferViews = [];
  const accessors = [];
  const meshes = [];
  const gNodes = [];
  for (const n of nodes) {
    const d = encode(em, dm, n.pos, n.nor, n.idx);
    const pad = (4 - (d.bytes.length % 4)) % 4;
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: d.bytes.length });
    chunks.push(d.bytes, Buffer.alloc(pad));
    offset += d.bytes.length + pad;
    const pa = accessors.push({ componentType: 5126, count: d.points, type: "VEC3", min: d.min, max: d.max }) - 1;
    const na = accessors.push({ componentType: 5126, count: d.points, type: "VEC3" }) - 1;
    const ia = accessors.push({ componentType: 5125, count: d.faces * 3, type: "SCALAR" }) - 1;
    if (!matIndex.has(n.material)) matIndex.set(n.material, materials.push(n.material) - 1);
    meshes.push({
      name: n.name,
      primitives: [
        {
          attributes: { POSITION: pa, NORMAL: na },
          indices: ia,
          material: matIndex.get(n.material),
          extensions: {
            KHR_draco_mesh_compression: {
              bufferView: bufferViews.length - 1,
              attributes: { POSITION: d.posId, NORMAL: d.norId },
            },
          },
        },
      ],
    });
    const translation = n.translation && n.translation.some((v) => v) ? { translation: n.translation } : {};
    gNodes.push({ name: n.name, mesh: meshes.length - 1, ...translation });
    console.log(n.name.padEnd(34), n.idx.length / 3);
  }

  const used = new Set(["KHR_draco_mesh_compression"]);
  materials.forEach((m) => Object.keys(m.extensions || {}).forEach((e) => used.add(e)));
  const bin = Buffer.concat(chunks);
  const gltf = {
    asset: { version: "2.0", ...asset },
    extensionsUsed: [...used],
    extensionsRequired: ["KHR_draco_mesh_compression"],
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: root, children: gNodes.map((_, i) => i + 1) }, ...gNodes],
    meshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: bin.length }],
  };
  let json = Buffer.from(JSON.stringify(gltf));
  json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
  const chunk = (length, type) => {
    const c = Buffer.alloc(8);
    c.writeUInt32LE(length, 0);
    c.writeUInt32LE(type, 4);
    return c;
  };
  fs.writeFileSync(out, Buffer.concat([header, chunk(json.length, 0x4e4f534a), json, chunk(bin.length, 0x004e4942), bin]));
  console.log("wrote", out, (fs.statSync(out).size / 1e6).toFixed(2), "MB");
}

module.exports = { split, gather, encode, writeDracoGlb };
