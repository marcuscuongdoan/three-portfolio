import * as THREE from "three";
import { mulberry32 } from "@/components/owl-world/foliage";

/**
 * Coursed stonework for the castle, its garden walls, the mailbox pillar and
 * the museum walls: one tiling texture, projected from three axes so blocks
 * are the same real size on every surface, whatever its UVs.
 */

// Metres the texture covers (8 courses: ~0.3 m each)
const STONE_TILE = 2.4;

// Rows of blocks of uneven length and tone, sunk mortar joints, a lit top
// edge and a shadowed bottom edge on each block. Tiles both ways.
function makeStoneTexture(seed = 7) {
  const size = 512;
  const rows = 8;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry32(seed);
  ctx.fillStyle = "#5a554d";
  ctx.fillRect(0, 0, size, size);
  const rowH = size / rows;
  const joint = 5;
  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    let x = -rand() * 80;
    while (x < size) {
      const w = 70 + rand() * 90;
      const tone = 0.72 + rand() * 0.26;
      const warm = (rand() - 0.5) * 10;
      // Drawn again where it crosses the edge, so the tile wraps
      for (const ox of [0, size, -size]) {
        const bx = x + ox + joint / 2;
        const bw = w - joint;
        const by = y + joint / 2;
        const bh = rowH - joint;
        if (bx > size || bx + bw < 0) continue;
        const l = Math.round(tone * 235);
        ctx.fillStyle = `rgb(${l + warm}, ${l}, ${l - warm - 6})`;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 6);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(bx + 3, by + 1, bw - 6, 3);
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(bx + 3, by + bh - 4, bw - 6, 3);
      }
      x += w;
    }
  }
  // Pitting and weathering over everything
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = rand() < 0.5 ? `rgba(0,0,0,${rand() * 0.16})` : `rgba(255,255,255,${rand() * 0.08})`;
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 3, 1 + rand() * 3);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// One texture for every stone material; it lives as long as the page
let texture: THREE.Texture | null = null;
const stoneTexture = () => (texture ??= makeStoneTexture());

/**
 * Stone that ignores the mesh's UVs: the texture is projected along the
 * three axes of `frame` (blended by the surface normal). `frame` maps world
 * space into the space the courses should follow, e.g. the inverse of the
 * castle's placement so blocks line up with its walls; left out, each mesh
 * uses its own axes. The texture's shading also bumps the normal, so joints
 * read as sunk. `tile` is the metres the texture spans (bigger, bigger blocks).
 *
 * Weathering (`weather`, 0..1) ages it: dark rain streaks running down,
 * rust-brown stains, and moss at the foot and on upward faces. It is noise in
 * the frame's space, so it drifts across blocks rather than repeating with them.
 */
export function stoneMaterial(
  color: THREE.ColorRepresentation,
  frame?: THREE.Matrix4,
  { tile = STONE_TILE, roughness = 0.95, bump = 1.2, weather = 1 } = {},
) {
  const mat = new THREE.MeshStandardMaterial({ color, map: stoneTexture(), roughness, metalness: 0 });
  const uniforms = { uStoneFrame: { value: frame ?? new THREE.Matrix4() }, uStoneScale: { value: 1 / tile }, uStoneBump: { value: bump }, uWeather: { value: weather } };
  // Into the frame's space: through the world for a shared frame, or straight from the mesh's own
  const toFrame = frame ? "uStoneFrame * modelMatrix" : "mat4(1.0)";
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("void main() {", "uniform mat4 uStoneFrame;\nvarying vec3 vStonePos;\nvarying vec3 vStoneNormal;\nvoid main() {")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vStonePos = (${toFrame} * vec4(transformed, 1.0)).xyz;
        vStoneNormal = mat3(${toFrame}) * objectNormal;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        `uniform float uStoneScale;
        uniform float uStoneBump;
        uniform float uWeather;
        float stoneHash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        float stoneNoise(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(stoneHash(i), stoneHash(i + vec3(1, 0, 0)), f.x), mix(stoneHash(i + vec3(0, 1, 0)), stoneHash(i + vec3(1, 1, 0)), f.x), f.y),
            mix(mix(stoneHash(i + vec3(0, 0, 1)), stoneHash(i + vec3(1, 0, 1)), f.x), mix(stoneHash(i + vec3(0, 1, 1)), stoneHash(i + vec3(1, 1, 1)), f.x), f.y),
            f.z);
        }
        float stoneFbm(vec3 p) {
          return 0.5 * stoneNoise(p) + 0.3 * stoneNoise(p * 2.03 + 1.7) + 0.2 * stoneNoise(p * 4.1 + 3.1);
        }
        varying vec3 vStonePos;
        varying vec3 vStoneNormal;
        float stoneH;
        float stoneFar;
        vec3 stonePerturb(vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float faceDir) {
          vec3 sx = normalize(dFdx(surfPos));
          vec3 sy = normalize(dFdy(surfPos));
          vec3 r1 = cross(sy, surfNorm);
          vec3 r2 = cross(surfNorm, sx);
          float det = dot(sx, r1) * faceDir;
          // Edge-on, the derivatives degenerate: keep the plain normal rather
          // than a NaN (which bloom smears into flickering black blocks)
          if (abs(det) < 1e-5) return surfNorm;
          vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
          vec3 n = abs(det) * surfNorm - grad;
          float len = length(n);
          return len > 1e-5 ? n / len : surfNorm;
        }
        void main() {`,
      )
      .replace(
        "#include <map_fragment>",
        `{
          vec3 w = pow(abs(vStoneNormal) / max(length(vStoneNormal), 1e-5), vec3(4.0));
          w /= max(w.x + w.y + w.z, 1e-5);
          vec3 p = vStonePos * uStoneScale;
          vec4 t = texture2D(map, p.zy) * w.x + texture2D(map, p.xz) * w.y + texture2D(map, p.xy) * w.z;
          stoneH = dot(t.rgb, vec3(0.333));
          diffuseColor *= t;
          // Fine detail fades with distance: past ~40 m it only shimmers
          stoneFar = smoothstep(12.0, 40.0, length(vViewPosition));
          // Weathering
          vec3 q = vStonePos;
          vec3 up = vStoneNormal / max(length(vStoneNormal), 1e-5);
          // Rain streaks: noise stretched tall, darkening in vertical runs
          float streak = smoothstep(0.5, 0.82, stoneNoise(vec3(q.x * 5.0, q.y * 0.45, q.z * 5.0)));
          diffuseColor.rgb *= 1.0 - streak * 0.38 * uWeather * (1.0 - stoneFar * 0.7);
          // Rust-brown stains, bleeding downward a little
          float stain = smoothstep(0.56, 0.78, stoneFbm(vec3(q.x * 0.9, q.y * 0.5, q.z * 0.9) + 11.0));
          float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          diffuseColor.rgb = mix(diffuseColor.rgb, lum * vec3(1.55, 0.82, 0.48), stain * 0.6 * uWeather);
          // Moss: thick at the foot, in patches on anything facing up
          float patches = smoothstep(0.42, 0.68, stoneFbm(q * 1.8 + 5.0));
          float foot = 1.0 - smoothstep(0.0, 1.4, q.y);
          float moss = patches * max(foot, smoothstep(0.55, 0.9, up.y) * 0.8);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.06, 0.085, 0.035) + lum * 0.25, moss * 0.75 * uWeather);
        }`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        normal = stonePerturb(-vViewPosition, normal, vec2(dFdx(stoneH), dFdy(stoneH)) * uStoneBump * (1.0 - stoneFar), faceDirection);`,
      );
  };
  mat.customProgramCacheKey = () => (frame ? "stone-framed" : "stone-local");
  return mat;
}

// Shared tones
export const STONE = { light: "#8a8172", dark: "#5f584e" };

/**
 * The cobbles of the road and the museum floor: stone courses laid flat,
 * smaller than the castle's blocks. In world space, so where the road runs
 * onto the floor the two line up
 */
export const cobbleMaterial = () => stoneMaterial("#7a7064", new THREE.Matrix4(), { tile: 1.3, bump: 1.6, weather: 0.7 });
