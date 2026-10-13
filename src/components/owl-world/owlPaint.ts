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
}

export const OWL_PAINTS = {
  charcoal: { gain: 1.05, lift: 0.012, tint: "#d8d8dc" },
  silver: { gain: 1.9, lift: 0.08, tint: "#dfe5ee" },
  white: { gain: 2.6, lift: 0.55, tint: "#ffffff", metalness: 0.35, roughness: 1 },
} satisfies Record<string, OwlPaint>;

/** Give every mesh under `root` its own copy of the material, in `paint` */
export function paintOwl(root: THREE.Object3D, paint: OwlPaint) {
  const made = new Map<THREE.Material, THREE.MeshStandardMaterial>();
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
      mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.fragmentShader = shader.fragmentShader
          .replace("void main() {", "uniform vec2 uPaint;\nuniform vec3 uTint;\nvoid main() {")
          .replace(
            "#include <map_fragment>",
            `#include <map_fragment>
            {
              vec3 c = diffuseColor.rgb;
              // The brass trim is warm; the armour is cool
              float brass = smoothstep(0.015, 0.09, c.r - c.b);
              float lum = dot(c, vec3(0.299, 0.587, 0.114));
              vec3 painted = clamp(vec3(lum * uPaint.x + uPaint.y), 0.0, 1.0) * uTint;
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
