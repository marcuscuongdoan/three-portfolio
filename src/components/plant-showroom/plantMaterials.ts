/**
 * Plant finishes: the paint each part of the unit wears, and the weathering
 * a few years outdoors puts on it — grime blotches, rust streaks running down
 * walls, dirt splashed up near the ground, dust on everything facing up, heat
 * staining and soot on the stack, oil stains on the pad.
 *
 * The weathering is projected triplanar in world space (the source UVs are
 * laid out for tiling steel swatches, not for dirt), from one procedural
 * noise texture, injected into the standard material with onBeforeCompile.
 * Every finished material shares one shader program.
 */

import * as THREE from "three";

export interface Finish {
  color: string;
  metalness: number;
  roughness: number;
  // 0..1 amounts of each kind of weathering
  grime?: number;
  streaks?: number;
  dust?: number;
  // Heat staining from y0 up to y1 (world), soot strongest at the top
  heat?: [number, number];
  // Corrugated cladding: ridges per world unit, on walls
  corrugate?: number;
  // Bar grating on upward faces: bar spacing, world units
  grating?: number;
  // Oil and water stains on upward faces
  stains?: number;
  // Keep the source textures (colour, roughness, normal), tiled this many times
  keepMaps?: number;
}

// Pad top, world y (pad 0.1 thick, lifted to sit on y = 0)
const GROUND_Y = 0.1;

/*
 * Paint by part, then by source material ("*" for any). Colours follow what
 * such units usually wear: light grey enclosures (RAL 7035-ish), an off-white
 * turbine package, a heat-resistant grey stack, aluminium jacketing on the
 * hot (insulated) duct, corrugated cladding on the switchgear house,
 * safety-yellow handrails, galvanised gratings and steelwork, and brown for
 * the fuel oil lines (the colour pipe-marking schemes give combustible fluids).
 */
const FINISHES: Record<string, Record<string, Finish>> = {
  intake: { "*": { color: "#c3c6c1", metalness: 0.15, roughness: 0.6, grime: 0.6, streaks: 0.7, dust: 0.6 } },
  turbine: { "*": { color: "#d3cdbd", metalness: 0.12, roughness: 0.55, grime: 0.5, streaks: 0.5, dust: 0.5 } },
  stack: {
    "*": { color: "#a9acae", metalness: 0.12, roughness: 0.55, grime: 0.5, streaks: 0.7, dust: 0.3, heat: [1.75, 2.3] },
  },
  antiicing: { "*": { color: "#d9dde1", metalness: 0.3, roughness: 0.42, grime: 0.3, streaks: 0.3, dust: 0.4 } },
  switchgear: {
    "*": { color: "#aab3b9", metalness: 0.3, roughness: 0.5, grime: 0.5, streaks: 0.8, dust: 0.5, corrugate: 170 },
  },
  fuelskid: { "*": { color: "#bdb6a1", metalness: 0.18, roughness: 0.55, grime: 0.6, streaks: 0.8, dust: 0.5 } },
  fueltank: { "*": { color: "#dedfd8", metalness: 0.12, roughness: 0.5, grime: 0.5, streaks: 1, dust: 0.5 } },
  fuelpipe: { "*": { color: "#86633a", metalness: 0.2, roughness: 0.5, grime: 0.4, streaks: 0.3, dust: 0.4 } },
  access: {
    // Handrails, ladder cages
    paint_gray: { color: "#e0b62a", metalness: 0.1, roughness: 0.55, grime: 0.5, dust: 0.3 },
    // Floor gratings
    paint_dark_gray: { color: "#959ca1", metalness: 0.6, roughness: 0.5, grime: 0.7, dust: 0.4, grating: 0.03 },
    // Galvanised steelwork
    "*": { color: "#a4aaae", metalness: 0.65, roughness: 0.45, grime: 0.5, streaks: 0.4, dust: 0.3 },
  },
  pad: { "*": { color: "#ffffff", metalness: 0, roughness: 1, grime: 0.6, stains: 1, keepMaps: 3 } },
};

export const finishFor = (partId: string, materialName: string): Finish | undefined => {
  const byMaterial = FINISHES[partId];
  return byMaterial?.[materialName] ?? byMaterial?.["*"];
};

/* --------------------------------- Noise ---------------------------------- */

// Tileable value noise: lattice of `cells` × `cells`, wrapping
const valueNoise = (size: number, cellsX: number, cellsY: number, seed: number) => {
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const lattice = Array.from({ length: cellsX * cellsY }, rand);
  const at = (x: number, y: number) => lattice[((y + cellsY) % cellsY) * cellsX + ((x + cellsX) % cellsX)]!;
  const out = new Float32Array(size * size);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const fx = (px / size) * cellsX;
      const fy = (py / size) * cellsY;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx);
      const sy = ty * ty * (3 - 2 * ty);
      const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
      const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
      out[py * size + px] = a + (b - a) * sy;
    }
  }
  return out;
};

const fbm = (size: number, cellsX: number, cellsY: number, octaves: number, seed: number) => {
  const out = new Float32Array(size * size);
  let amp = 0.5;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const layer = valueNoise(size, cellsX << o, cellsY << o, seed + o * 101);
    for (let i = 0; i < out.length; i++) out[i]! += layer[i]! * amp;
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i]! /= total;
  return out;
};

let noiseTexture: THREE.DataTexture | null = null;

/**
 * R: large blotches · G: fine speckle · B: streaks (stretched 16:1 along V,
 * so they run down walls) · A: stain spots
 */
const getNoise = () => {
  if (noiseTexture) return noiseTexture;
  const size = 256;
  const r = fbm(size, 4, 4, 4, 11);
  const g = fbm(size, 32, 32, 2, 23);
  const b = fbm(size, 32, 2, 3, 37);
  const a = fbm(size, 8, 8, 3, 53);
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = r[i]! * 255;
    data[i * 4 + 1] = g[i]! * 255;
    data[i * 4 + 2] = b[i]! * 255;
    data[i * 4 + 3] = a[i]! * 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  noiseTexture = texture;
  return texture;
};

/* --------------------------------- Shader --------------------------------- */

const VERTEX_HEAD = /* glsl */ `
  varying vec3 vPlantPos;
  varying vec3 vPlantNormal;
`;
const VERTEX_BODY = /* glsl */ `
  vPlantPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vPlantNormal = normalize(mat3(modelMatrix) * objectNormal);
`;

const FRAGMENT_HEAD = /* glsl */ `
  varying vec3 vPlantPos;
  varying vec3 vPlantNormal;
  uniform sampler2D uPlantNoise;
  uniform float uGrime;
  uniform float uStreaks;
  uniform float uDust;
  uniform vec2 uHeat;
  uniform float uCorrugate;
  uniform float uGrating;
  uniform float uStains;
  uniform float uGround;
  vec4 plantTri(vec3 p, vec3 w) {
    return texture2D(uPlantNoise, p.yz) * w.x + texture2D(uPlantNoise, p.xz) * w.y + texture2D(uPlantNoise, p.xy) * w.z;
  }
`;

// After the base colour (and its map) is in
const FRAGMENT_COLOR = /* glsl */ `
  vec3 pN = normalize(vPlantNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 pP = vPlantPos;
  vec3 pW = pow(abs(pN), vec3(4.0));
  pW /= (pW.x + pW.y + pW.z);
  vec4 pLarge = plantTri(pP * 0.45, pW);
  vec4 pFine = plantTri(pP * 3.5, pW);
  float pUp = pN.y;
  float pSide = 1.0 - abs(pN.y);
  // Across-the-wall coordinate of a vertical face
  float pAcross = abs(pN.x) > abs(pN.z) ? pP.z : pP.x;

  // Paint that has weathered unevenly, plus fine speckle
  float pGrime = smoothstep(0.38, 0.82, pLarge.r) * uGrime;
  diffuseColor.rgb *= (1.0 - 0.32 * pGrime) * (0.93 + 0.14 * pFine.g);

  // Rust and dirt streaks running down walls from ledges and bolts
  float pStreak = smoothstep(0.58, 0.9, texture2D(uPlantNoise, vec2(pAcross * 2.2, pP.y * 0.22)).b);
  pStreak *= pSide * uStreaks * (0.55 + 0.45 * pLarge.g);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.33, 0.21, 0.12) * (0.7 + 0.3 * pFine.g), 0.5 * pStreak);

  // Dirt splashed up from the ground
  float pDirt = (1.0 - smoothstep(0.0, 0.28, pP.y - uGround)) * pSide * uGrime;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.26, 0.23, 0.19), 0.55 * pDirt * (0.6 + 0.4 * pLarge.r));

  // Dust settled on everything facing up
  float pDust = smoothstep(0.55, 0.95, pUp) * uDust * (0.45 + 0.55 * pLarge.b);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.6, 0.57, 0.52), 0.4 * pDust);

  // Heat: blued, browned steel towards the outlet, soot at the very top
  float pHeat = uHeat.y > uHeat.x ? smoothstep(uHeat.x, uHeat.y, pP.y) : 0.0;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.26, 0.27), 0.5 * pHeat * (0.5 + 0.5 * pLarge.r));
  float pSoot = uHeat.y > uHeat.x ? smoothstep(uHeat.y - 0.12, uHeat.y, pP.y) : 0.0;
  diffuseColor.rgb *= 1.0 - 0.5 * pSoot;

  // Oil and water stains on the slab
  float pStain = smoothstep(0.58, 0.72, plantTri(pP * 0.28, pW).a) * smoothstep(0.8, 1.0, pUp) * uStains;
  diffuseColor.rgb *= 1.0 - 0.45 * pStain;

  // Bar grating: bright bars over dark gaps, antialiased
  float pBars = 1.0;
  if (uGrating > 0.0 && pUp > 0.9) {
    vec2 gc = pP.xz / vec2(uGrating, uGrating * 3.0);
    vec2 gl = abs(fract(gc - 0.5) - 0.5) / max(fwidth(gc), vec2(1e-4));
    pBars = 1.0 - min(min(gl.x * 0.5, gl.y), 1.0);
    diffuseColor.rgb *= mix(0.32, 1.1, pBars);
  }
`;

const FRAGMENT_ROUGHNESS = /* glsl */ `
  roughnessFactor = clamp(roughnessFactor + 0.22 * pGrime + 0.25 * pStreak + 0.3 * pDust + 0.2 * pDirt - 0.15 * pStain, 0.04, 1.0);
  metalnessFactor *= 1.0 - 0.5 * max(pDust, pStreak);
`;

// Corrugated cladding: tilt the normal across each ridge
const FRAGMENT_NORMAL = /* glsl */ `
  if (uCorrugate > 0.0 && pSide > 0.7) {
    vec3 pT = abs(pN.x) > abs(pN.z) ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
    vec3 pBent = normalize(pN + pT * cos(pAcross * uCorrugate) * 0.45);
    normal = normalize((viewMatrix * vec4(pBent, 0.0)).xyz);
  }
`;

const inject = (source: string, anchor: string, code: string, after = true) => {
  if (!source.includes(anchor)) throw new Error(`Plant material: shader chunk ${anchor} not found`);
  return source.replace(anchor, after ? `${anchor}\n${code}` : `${code}\n${anchor}`);
};

// Tile the source textures (the pad's concrete) `times` across their UVs
const tileMaps = (m: THREE.MeshStandardMaterial, times: number) => {
  const tile = (t: THREE.Texture | null) => {
    if (!t) return t;
    const copy = t.clone();
    copy.wrapS = copy.wrapT = THREE.RepeatWrapping;
    copy.repeat.set(times, times);
    copy.needsUpdate = true;
    return copy;
  };
  m.map = tile(m.map);
  m.normalMap = tile(m.normalMap);
  m.roughnessMap = m.roughnessMap === m.metalnessMap ? (m.metalnessMap = tile(m.roughnessMap)) : tile(m.roughnessMap);
};

/**
 * Paints and weathers a (cloned, per-part) material in place. Materials
 * without a finish are left as they are.
 */
export const applyFinish = (material: THREE.Material, finish: Finish | undefined) => {
  const m = material as THREE.MeshStandardMaterial;
  if (!finish || !m.isMeshStandardMaterial) return;

  if (finish.keepMaps) tileMaps(m, finish.keepMaps);
  else {
    // The source steel swatches only add a faint brushed grain at this scale:
    // the paint replaces them
    m.map = null;
    m.metalnessMap = null;
    m.roughnessMap = null;
  }
  m.color.set(finish.color);
  m.metalness = finish.metalness;
  m.roughness = finish.roughness;

  const uniforms = {
    uPlantNoise: { value: getNoise() },
    uGrime: { value: finish.grime ?? 0 },
    uStreaks: { value: finish.streaks ?? 0 },
    uDust: { value: finish.dust ?? 0 },
    uHeat: { value: new THREE.Vector2(...(finish.heat ?? [0, 0])) },
    uCorrugate: { value: finish.corrugate ?? 0 },
    uGrating: { value: finish.grating ?? 0 },
    uStains: { value: finish.stains ?? 0 },
    uGround: { value: GROUND_Y },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = inject(shader.vertexShader, "#include <common>", VERTEX_HEAD);
    shader.vertexShader = inject(shader.vertexShader, "#include <project_vertex>", VERTEX_BODY);
    shader.fragmentShader = inject(shader.fragmentShader, "#include <common>", FRAGMENT_HEAD);
    shader.fragmentShader = inject(shader.fragmentShader, "#include <color_fragment>", FRAGMENT_COLOR);
    shader.fragmentShader = inject(shader.fragmentShader, "#include <metalnessmap_fragment>", FRAGMENT_ROUGHNESS);
    shader.fragmentShader = inject(shader.fragmentShader, "#include <normal_fragment_maps>", FRAGMENT_NORMAL);
  };
  // One program for every finish: the differences are all uniforms
  m.customProgramCacheKey = () => "plant-finish";
  m.needsUpdate = true;
};
