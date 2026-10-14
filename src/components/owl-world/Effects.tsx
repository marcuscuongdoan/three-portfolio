"use client";

import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

// Its own chunk: a phone on the default quality never loads postprocessing
export default function Effects({ multisampling }: { multisampling: number }) {
  return (
    <EffectComposer multisampling={multisampling}>
      <Bloom mipmapBlur luminanceThreshold={0.9} luminanceSmoothing={0.3} intensity={1.1} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
