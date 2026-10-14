import * as THREE from "three";

/**
 * The night's fog, patched into three's fog chunks so every fogged material
 * gets it. Two layers over the scene's THREE.Fog (whose near / far it reads):
 *
 * - Distance haze: squared-exponential from `near`, so the stops close to the
 *   camera stay crisp and the woods and hills melt into the sky. It thins
 *   with height, so treetops and clouds hold their shape over it.
 * - Ground mist: a paler layer hugging the ground, thickening with distance,
 *   so far trunks drown in it while their crowns stand out above.
 *
 * Imported once (by the scene) before anything compiles.
 */

// Paler than the sky so the mist reads as moonlit vapour, not just darkness
const MIST = new THREE.Color("#2e3870");
const MIST_HEIGHT = 6; // metres over which the mist thins out
const MIST_MAX = 0.32;
// Never fully gone: the far hills stay as faint layered silhouettes
const HAZE_MAX = 0.82;

const glsl = (c: THREE.Color) => `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;

THREE.ShaderChunk.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogWorld;
#endif`;

THREE.ShaderChunk.fog_vertex = /* glsl */ `
#ifdef USE_FOG
  vFogDepth = length(mvPosition.xyz);
  // Back to world space: the view matrix is a rotation and a move, so its inverse is cheap
  vFogWorld = transpose(mat3(viewMatrix)) * (mvPosition.xyz - viewMatrix[3].xyz);
#endif`;

THREE.ShaderChunk.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vFogWorld;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif`;

THREE.ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
  {
    #ifdef FOG_EXP2
      float hazeAt = fogDensity * max(vFogDepth, 0.0);
    #else
      float hazeAt = max(vFogDepth - fogNear, 0.0) / max(fogFar - fogNear, 1.0) * 2.0;
    #endif
    // Thinner up high: treetops and clouds keep their shape
    hazeAt *= mix(1.0, 0.5, smoothstep(6.0, 30.0, vFogWorld.y));
    float haze = (1.0 - exp(-hazeAt * hazeAt)) * ${HAZE_MAX.toFixed(2)};
    // ...but whole by the far rim of the ground, so its edge never shows
    haze = max(haze, smoothstep(180.0, 250.0, vFogDepth));
    float low = exp(-max(vFogWorld.y, 0.0) / ${MIST_HEIGHT.toFixed(2)});
    float mist = low * (1.0 - exp(-max(vFogDepth - 3.0, 0.0) * 0.025)) * ${MIST_MAX.toFixed(2)};
    vec3 col = mix(gl_FragColor.rgb, ${glsl(MIST)}, mist);
    gl_FragColor.rgb = mix(col, fogColor, haze);
  }
#endif`;
