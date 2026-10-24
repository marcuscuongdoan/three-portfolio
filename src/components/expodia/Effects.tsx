"use client";

import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, N8AO, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

// Contact shadows under booths and props, a glow on the light strips and
// emissive screens, then a filmic grade to pull the pale HDRI hall together
export default function Effects() {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO halfRes quality="medium" aoRadius={2.5} distanceFalloff={1.2} intensity={2.2} denoiseRadius={8} />
      <Bloom mipmapBlur luminanceThreshold={0.9} luminanceSmoothing={0.25} intensity={0.7} radius={0.7} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <HueSaturation saturation={0.16} hue={0} />
      <BrightnessContrast brightness={-0.02} contrast={0.12} />
      <Vignette offset={0.3} darkness={0.5} />
      <SMAA />
    </EffectComposer>
  );
}
