import * as THREE from "three";

/**
 * Each owl in its own finish. The model's armour is a dark blue metal with
 * warm brass trim; a paint takes the armour's brightness (dropping the blue)
 * and repaints it, leaving the brass, the glowing eyes and the detail maps
 * as they are.
 */

export interface OwlPaint {
  // Armour brightness = luminance * gain + lift, then tinted
  gain: number;
  lift: number;
  tint: THREE.ColorRepresentation;
  // Bare metal reflects the dark night; a paler, less metallic finish reads white
  metalness?: number;
  roughness?: number;
  // Wing and tail feathers each in a colour of the rainbow
  rainbow?: boolean;
}

export const OWL_PAINTS = {
  charcoal: { gain: 1.05, lift: 0.012, tint: "#d8d8dc" },
  silver: { gain: 1.9, lift: 0.08, tint: "#dfe5ee" },
  white: { gain: 2.6, lift: 0.55, tint: "#ffffff", metalness: 0.35, roughness: 1 },
} satisfies Record<string, OwlPaint>;

const RAINBOW = ["#ff3b30", "#ff8a00", "#ffd400", "#2fd158", "#1e90ff", "#4b3bff", "#a24bff"].map(
  (c) => new THREE.Color(c),
);
// Flight feathers shoulder → tip, red → violet; each covert matches the
// flight feather it lies over
const WING_BAND: Record<string, number> = {
  featherMid_a: 0, featherMid_b: 1, featherMid_c: 2, featherMid_d: 2, featherMid_e: 3,
  featherMid_f: 4, featherMid_g: 5, featherMid_h: 5, featherMid_i: 6,
  featherTop_a: 2, featherTop_b: 4, featherTop_c: 5, featherTop_d: 5,
  featherBttom_a: 2, featherBttom_b: 4, featherBttom_c: 5, featherBttom_d: 5,
};
// The seven tail feathers, owl's left → right
const TAIL_BAND: Record<string, number> = {
  tailFeather_c_l: 0, tailFeather_b_l: 1, tailFeather_a_l: 2, tailFeather_c: 3,
  tailFeather_a_r: 4, tailFeather_b_r: 5, tailFeather_c_r: 6,
};

/** Rainbow band of a bone, or -1: tip bones colour with their feather */
function bandOf(name: string) {
  const tail = TAIL_BAND[name.replace("_tip", "")];
  if (tail !== undefined) return tail;
  return WING_BAND[name.replace(/(_tip)?_[lr]$/, "")] ?? -1;
}

/**
 * Store on every mesh's geometry an `aRainbow` (rgb, mask) per vertex, from
 * the bone that moves it most. Meshes without feathers get a zero mask so a
 * shared material can read the attribute everywhere.
 */
function markRainbow(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isMesh || mesh.geometry.getAttribute("aRainbow")) return;
    const geo = mesh.geometry;
    const count = geo.getAttribute("position").count;
    const data = new Float32Array(count * 4);
    const joints = geo.getAttribute("skinIndex");
    const weights = geo.getAttribute("skinWeight");
    if (mesh.isSkinnedMesh && joints && weights) {
      const bands = mesh.skeleton.bones.map((b) => bandOf(b.name));
      for (let i = 0; i < count; i++) {
        let best = 0;
        for (let c = 1; c < 4; c++) if (weights.getComponent(i, c) > weights.getComponent(i, best)) best = c;
        const band = bands[joints.getComponent(i, best)] ?? -1;
        if (band < 0) continue;
        RAINBOW[band]!.toArray(data, i * 4);
        data[i * 4 + 3] = 1;
      }
    }
    geo.setAttribute("aRainbow", new THREE.BufferAttribute(data, 4));
  });
}

/** Give every mesh under `root` its own copy of the material, in `paint` */
export function paintOwl(root: THREE.Object3D, paint: OwlPaint) {
  const made = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  if (paint.rainbow) markRainbow(root);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material as THREE.MeshStandardMaterial;
    let mat = made.get(src);
    if (!mat) {
      mat = src.clone();
      if (paint.metalness !== undefined) mat.metalness = paint.metalness;
      if (paint.roughness !== undefined) mat.roughness = paint.roughness;
      const uniforms = {
        uPaint: { value: new THREE.Vector2(paint.gain, paint.lift) },
        uTint: { value: new THREE.Color(paint.tint) },
      };
      // Programs are cached by onBeforeCompile's source, the same for every paint
      mat.customProgramCacheKey = () => (paint.rainbow ? "owl-paint-rainbow" : "owl-paint");
      mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        if (paint.rainbow) {
          shader.vertexShader = shader.vertexShader
            .replace("void main() {", "attribute vec4 aRainbow;\nvarying vec4 vRainbow;\nvoid main() {")
            .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRainbow = aRainbow;");
        }
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "void main() {",
            `uniform vec2 uPaint;\nuniform vec3 uTint;\n${paint.rainbow ? "varying vec4 vRainbow;\n" : ""}void main() {`,
          )
          .replace(
            "#include <map_fragment>",
            `#include <map_fragment>
            {
              vec3 c = diffuseColor.rgb;
              // The brass trim is warm; the armour is cool
              float brass = smoothstep(0.015, 0.09, c.r - c.b);
              float lum = dot(c, vec3(0.299, 0.587, 0.114));
              vec3 painted = clamp(vec3(lum * uPaint.x + uPaint.y), 0.0, 1.0) * uTint;
              ${
                paint.rainbow
                  ? // Kept dark with no lift, so the metal's own detail shows through
                    "painted = mix(painted, clamp(vec3(lum * 1.6 + 0.01), 0.0, 1.0) * vRainbow.rgb, vRainbow.a);"
                  : ""
              }
              diffuseColor.rgb = mix(painted, c, brass);
            }`,
          );
      };
      made.set(src, mat);
    }
    mesh.material = mat;
  });
  return [...made.values()];
}
