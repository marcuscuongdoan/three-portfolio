import * as THREE from "three";

/**
 * Wind for foliage: a vertex-shader patch for any built-in material. Each
 * vertex is pushed sideways in world space by a slow sway (with gusts rolling
 * across the valley) plus a quick rustle, scaled by its height above the
 * ground, so trunks bend from the root and crowns move the most.
 */

// Shared clock; WindClock (in the scene) advances it once per frame
export const WIND = { uTime: { value: 0 } };

export interface WindOptions {
  // Metres of sway at the top of the height range
  sway?: number;
  // Metres of fast leaf rustle
  rustle?: number;
  // World height over which the sway grows from 0 to full
  height?: number;
}

export function withWind<T extends THREE.Material>(material: T, { sway = 0.15, rustle = 0.03, height = 6 }: WindOptions = {}): T {
  // Chain onto any patch the material already has (e.g. foliage normals)
  const previous = material.onBeforeCompile.bind(material);
  const previousKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.uniforms.uWindTime = WIND.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
        uniform float uWindTime;`,
      )
      .replace(
        "#include <project_vertex>",
        /* glsl */ `
        vec4 windPos = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          windPos = instanceMatrix * windPos;
        #endif
        windPos = modelMatrix * windPos;
        {
          float h = clamp(windPos.y / ${height.toFixed(2)}, 0.0, 1.0);
          h *= h;
          // Gusts roll across the valley; the sway rides on them
          float gust = 0.55 + 0.45 * sin(uWindTime * 0.35 + windPos.x * 0.04 - windPos.z * 0.03);
          float phase = uWindTime * 1.25 + windPos.x * 0.12 + windPos.z * 0.09;
          vec2 sway = vec2(sin(phase), 0.45 * sin(phase * 0.7 + 1.3)) * gust * ${sway.toFixed(3)};
          float r = uWindTime * 5.5 + windPos.x * 2.1 + windPos.y * 2.9 + windPos.z * 1.7;
          vec3 rustle = vec3(sin(r), sin(r * 1.3 + 2.0) * 0.6, cos(r * 0.9)) * gust * ${rustle.toFixed(3)};
          windPos.xz += sway * h;
          windPos.xyz += rustle * h;
        }
        vec4 mvPosition = viewMatrix * windPos;
        gl_Position = projectionMatrix * mvPosition;`,
      );
  };
  material.customProgramCacheKey = () => `${previousKey()}|wind-${sway}-${rustle}-${height}`;
  return material;
}
