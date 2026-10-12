/**
 * Rebuilds the gas turbine GLB for the plant showroom (/gas-turbine).
 *
 * The source is part_of_nuclear_power_plant_reactor.glb — a Blender export of
 * a packaged gas-turbine unit on a concrete pad (nodes GPA2_01…05, "ГПА" being
 * the Russian abbreviation for a gas-turbine unit) — whose meshes lump several
 * machines together: GPA2_03 holds the intake, the turbine train, the exhaust
 * duct and the stack; GPA2_05 both fuel modules and their pipework. This
 * splits every mesh into connected pieces, sorts the pieces into part nodes by
 * where they sit on the pad (intake_*, turbine_*, stack_*, …; the rules in
 * `classify` were checked against renders of each part), bakes the node
 * transforms into the vertices, keeps the source materials, and shrinks the
 * 2K concrete textures to 1K (they were ~90% of the file).
 *
 * Model space (the source's, unchanged): metres of the model, +Y up, pad
 * centred on the origin with its top at y = 0.05. The intake sits towards -X,
 * the stack towards +X.
 *
 * Usage: node scripts/build-gas-turbine-glb.js <source.glb> <output.glb> [--report]
 */

/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script */
const fs = require("fs");
const sharp = require("sharp");

const between = (v, a, b) => v >= a && v <= b;

// Centres of the two fuel module boxes (world x, z), 0.69 × 1.34 footprints
const FUEL_BOXES = {
  GPA2_05: { x: -0.17, z: -1.07 },
  "GPA2_05.001": { x: 1.84, z: -0.3 },
};

/**
 * Part of one connected piece, from its source node, material and bounds
 * (world space). The first rule that matches wins.
 */
function classify(node, material, c) {
  const [x, y, z] = c.center;
  const [sx, , sz] = c.size;

  if (node === "Cube.002") return "pad";
  // Lattice tower under the stack
  if (node === "Cube.003") return "stack";
  // Gabled module and its flat duct into the turbine train
  if (node === "GPA2_04") return "switchgear";
  // Transfer line between the two fuel modules
  if (node === "GPA2_05.002") return "fuelpipe";
  // The fuel modules are the two boxes (GPA2_05 by the switchgear house, its
  // copy GPA2_05.001 across the pad) with what sits on their roofs — the
  // hatches, ladder rails and nozzles inside the footprint, up to the railing
  // tops. Everything else in these nodes is pipework
  if ((node === "GPA2_05" || node === "GPA2_05.001") && material !== "paint_dark_gray") {
    const box = FUEL_BOXES[node];
    const inside = Math.abs(x - box.x) < 0.38 && Math.abs(z - box.z) < 0.7 && y < 1.1 && Math.max(sx, sz) < 1.4;
    if (inside) return node === "GPA2_05" ? "fuelskid" : "fueltank";
    return "fuelpipe";
  }
  // Grating floors, railings, cages and ladders: every platform on the pad
  if (/^GPA2_0[12]/.test(node) || /\.00[1-5]$/.test(node) || material === "paint_dark_gray") return "access";

  if (node === "GPA2_03") {
    if (material === "paint_gray") return "access";
    // Stack and its base, right of the train
    if (x > 0.85 && z < 0.35) return "stack";
    // Elevated duct from the stack base back over to the filter house: the
    // anti-icing line
    if (y > 1.25 && sx > 1.2) return "antiicing";
    if (between(x, -0.95, 0.9) && between(z, -0.2, 0.3) && y > 1.1) return "antiicing";
    // Intake filter house, its legs and inlet louvres, left of the train
    if (x < -0.97) return "intake";
    return "turbine";
  }
  return "unsorted";
}

/* ------------------------------- GLB reading ------------------------------ */

const COMPONENT = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const WIDTH = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function readGlb(file) {
  const buf = fs.readFileSync(file);
  const jsonLength = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString());
  const binStart = 20 + jsonLength;
  const bin = buf.subarray(binStart + 8, binStart + 8 + buf.readUInt32LE(binStart));
  return { json, bin };
}

// Tightly packed accessors only (all this file has)
function accessor({ json, bin }, index) {
  const a = json.accessors[index];
  const view = json.bufferViews[a.bufferView];
  const Type = COMPONENT[a.componentType];
  const start = bin.byteOffset + (view.byteOffset || 0) + (a.byteOffset || 0);
  const length = a.count * WIDTH[a.type];
  return new Type(bin.buffer.slice(start, start + length * Type.BYTES_PER_ELEMENT));
}

// Column-major local matrix of a node
function localMatrix(n) {
  if (n.matrix) return n.matrix.slice();
  const [tx, ty, tz] = n.translation || [0, 0, 0];
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale || [1, 1, 1];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + w * z) * sx, 2 * (x * z - w * y) * sx, 0,
    2 * (x * y - w * z) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + w * x) * sy, 0,
    2 * (x * z + w * y) * sz, 2 * (y * z - w * x) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return out;
}

function worldMatrices(json) {
  const world = new Map();
  const walk = (i, parent) => {
    const m = multiply(parent, localMatrix(json.nodes[i]));
    world.set(i, m);
    (json.nodes[i].children || []).forEach((c) => walk(c, m));
  };
  json.scenes[0].nodes.forEach((i) => walk(i, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
  return world;
}

/**
 * Connected pieces of a triangle list: vertices welded by position first (the
 * export splits them along UV seams and hard edges). Returns each triangle's
 * piece number.
 */
function pieces(position, index) {
  const count = position.length / 3;
  const byKey = new Map();
  const parent = new Int32Array(count);
  for (let v = 0; v < count; v++) {
    const key = `${Math.round(position[3 * v] * 1e4)},${Math.round(position[3 * v + 1] * 1e4)},${Math.round(position[3 * v + 2] * 1e4)}`;
    if (!byKey.has(key)) byKey.set(key, v);
    parent[v] = byKey.get(key);
  }
  const find = (v) => {
    while (parent[v] !== v) v = parent[v] = parent[parent[v]];
    return v;
  };
  for (let t = 0; t < index.length; t += 3) {
    const a = find(index[t]);
    parent[find(index[t + 1])] = a;
    parent[find(index[t + 2])] = a;
  }
  const ids = new Map();
  const tri = new Int32Array(index.length / 3);
  for (let t = 0; t < tri.length; t++) {
    const root = find(index[3 * t]);
    if (!ids.has(root)) ids.set(root, ids.size);
    tri[t] = ids.get(root);
  }
  return { tri, count: ids.size };
}

/* --------------------------------- Build ---------------------------------- */

async function main() {
  const [source, output] = process.argv.slice(2);
  const report = process.argv.includes("--report");
  if (!source || !output) throw new Error("Usage: build-gas-turbine-glb.js <source.glb> <output.glb>");
  const glb = readGlb(source);
  const { json } = glb;
  const world = worldMatrices(json);

  // part → material → { position, normal, uv } (world space)
  const parts = new Map();
  const bucket = (part, material) => {
    if (!parts.has(part)) parts.set(part, new Map());
    const byMaterial = parts.get(part);
    if (!byMaterial.has(material)) byMaterial.set(material, { position: [], normal: [], uv: [] });
    return byMaterial.get(material);
  };

  json.nodes.forEach((node, ni) => {
    if (node.mesh == null) return;
    const m = world.get(ni);
    // Normals: the transforms here are rotations + uniform scale, so the
    // upper 3×3 renormalised is enough
    json.meshes[node.mesh].primitives.forEach((prim) => {
      const position = accessor(glb, prim.attributes.POSITION);
      const normal = accessor(glb, prim.attributes.NORMAL);
      const uv = accessor(glb, prim.attributes.TEXCOORD_0);
      const index = accessor(glb, prim.indices);
      const material = json.materials[prim.material].name;

      const worldPos = new Float32Array(position.length);
      const worldNormal = new Float32Array(normal.length);
      for (let v = 0; v < position.length / 3; v++) {
        const [x, y, z] = [position[3 * v], position[3 * v + 1], position[3 * v + 2]];
        worldPos[3 * v] = m[0] * x + m[4] * y + m[8] * z + m[12];
        worldPos[3 * v + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
        worldPos[3 * v + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
        const [nx, ny, nz] = [normal[3 * v], normal[3 * v + 1], normal[3 * v + 2]];
        const wx = m[0] * nx + m[4] * ny + m[8] * nz;
        const wy = m[1] * nx + m[5] * ny + m[9] * nz;
        const wz = m[2] * nx + m[6] * ny + m[10] * nz;
        const l = Math.hypot(wx, wy, wz) || 1;
        worldNormal[3 * v] = wx / l;
        worldNormal[3 * v + 1] = wy / l;
        worldNormal[3 * v + 2] = wz / l;
      }

      const { tri, count } = pieces(worldPos, index);
      const bounds = Array.from({ length: count }, () => ({
        min: [Infinity, Infinity, Infinity],
        max: [-Infinity, -Infinity, -Infinity],
      }));
      for (let t = 0; t < tri.length; t++) {
        const b = bounds[tri[t]];
        for (let k = 0; k < 3; k++) {
          const v = index[3 * t + k];
          for (let a = 0; a < 3; a++) {
            b.min[a] = Math.min(b.min[a], worldPos[3 * v + a]);
            b.max[a] = Math.max(b.max[a], worldPos[3 * v + a]);
          }
        }
      }
      const partOf = bounds.map((b) =>
        classify(node.name, material, {
          center: b.min.map((v, a) => (v + b.max[a]) / 2),
          size: b.min.map((v, a) => b.max[a] - v),
        }),
      );

      for (let t = 0; t < tri.length; t++) {
        const out = bucket(partOf[tri[t]], material);
        for (let k = 0; k < 3; k++) {
          const v = index[3 * t + k];
          out.position.push(worldPos[3 * v], worldPos[3 * v + 1], worldPos[3 * v + 2]);
          out.normal.push(worldNormal[3 * v], worldNormal[3 * v + 1], worldNormal[3 * v + 2]);
          out.uv.push(uv[2 * v], uv[2 * v + 1]);
        }
      }
    });
  });

  if (report) {
    parts.forEach((byMaterial, part) =>
      console.log(part, [...byMaterial].map(([mat, d]) => `${mat}:${d.position.length / 9}`).join(" ")),
    );
  }
  if (parts.has("unsorted")) console.warn("Unsorted pieces left:", parts.get("unsorted").size);

  // ----- Write: one node per part and material, indexed (vertices deduplicated)
  const chunks = [];
  let offset = 0;
  const views = [];
  const accessors = [];
  const addView = (typed, target) => {
    const bytes = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
    const pad = (4 - (offset % 4)) % 4;
    if (pad) {
      chunks.push(Buffer.alloc(pad));
      offset += pad;
    }
    views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, ...(target && { target }) });
    chunks.push(bytes);
    offset += bytes.length;
    return views.length - 1;
  };
  const addAccessor = (typed, type, componentType, target, minmax) => {
    const view = addView(typed, target);
    const a = { bufferView: view, componentType, count: typed.length / WIDTH[type], type };
    if (minmax) {
      a.min = [Infinity, Infinity, Infinity];
      a.max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < typed.length; i += 3)
        for (let k = 0; k < 3; k++) {
          a.min[k] = Math.min(a.min[k], typed[i + k]);
          a.max[k] = Math.max(a.max[k], typed[i + k]);
        }
    }
    accessors.push(a);
    return accessors.length - 1;
  };

  const materialIndex = new Map(json.materials.map((m, i) => [m.name, i]));
  const meshes = [];
  const nodes = [];
  [...parts.keys()].sort().forEach((part) => {
    let n = 0;
    parts.get(part).forEach((data, material) => {
      const key = new Map();
      const position = [];
      const normal = [];
      const uv = [];
      const index = [];
      for (let v = 0; v < data.position.length / 3; v++) {
        const id = [
          data.position[3 * v], data.position[3 * v + 1], data.position[3 * v + 2],
          data.normal[3 * v], data.normal[3 * v + 1], data.normal[3 * v + 2],
          data.uv[2 * v], data.uv[2 * v + 1],
        ].join();
        let i = key.get(id);
        if (i === undefined) {
          i = position.length / 3;
          key.set(id, i);
          position.push(data.position[3 * v], data.position[3 * v + 1], data.position[3 * v + 2]);
          normal.push(data.normal[3 * v], data.normal[3 * v + 1], data.normal[3 * v + 2]);
          uv.push(data.uv[2 * v], data.uv[2 * v + 1]);
        }
        index.push(i);
      }
      const big = position.length / 3 > 65535;
      meshes.push({
        name: `${part}_${n}`,
        primitives: [
          {
            attributes: {
              POSITION: addAccessor(new Float32Array(position), "VEC3", 5126, 34962, true),
              NORMAL: addAccessor(new Float32Array(normal), "VEC3", 5126, 34962),
              TEXCOORD_0: addAccessor(new Float32Array(uv), "VEC2", 5126, 34962),
            },
            indices: addAccessor(big ? new Uint32Array(index) : new Uint16Array(index), "SCALAR", big ? 5125 : 5123, 34963),
            material: materialIndex.get(material),
          },
        ],
      });
      nodes.push({ name: `${part}_${n}`, mesh: meshes.length - 1 });
      n++;
    });
  });

  // Images: the concrete set comes down to 1K; the small metal ones stay
  const images = [];
  for (const image of json.images) {
    const view = json.bufferViews[image.bufferView];
    let bytes = glb.bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    let mimeType = image.mimeType;
    const meta = await sharp(bytes).metadata();
    if (meta.width > 1024) {
      const resized = sharp(bytes).resize(1024, 1024);
      bytes = await (mimeType === "image/png" ? resized.png({ compressionLevel: 9 }) : resized.jpeg({ quality: 82 })).toBuffer();
    }
    images.push({ name: image.name, mimeType, bufferView: addView(new Uint8Array(bytes)) });
  }

  const outJson = {
    asset: { version: "2.0", generator: "build-gas-turbine-glb.js" },
    scene: 0,
    scenes: [{ name: "Scene", nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes,
    materials: json.materials,
    textures: json.textures,
    samplers: json.samplers,
    images,
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: offset }],
  };

  const bin = Buffer.concat(chunks);
  const binPadded = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
  outJson.buffers[0].byteLength = binPadded.length;
  let jsonBuf = Buffer.from(JSON.stringify(outJson));
  jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(12);
  header.write("glTF", 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binPadded.length, 8);
  const chunkHeader = (length, type) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(length, 0);
    h.write(type, 4);
    return h;
  };
  fs.writeFileSync(
    output,
    Buffer.concat([header, chunkHeader(jsonBuf.length, "JSON"), jsonBuf, chunkHeader(binPadded.length, "BIN\0"), binPadded]),
  );
  console.log(`Wrote ${output}: ${nodes.length} nodes, ${(fs.statSync(output).size / 1e6).toFixed(2)} MB`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
