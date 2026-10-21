"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  ASCII,
  Bloom,
  BrightnessContrast,
  ChromaticAberration,
  ColorAverage,
  ColorDepth,
  DepthOfField,
  DotScreen,
  EffectComposer,
  Glitch,
  GodRays,
  HueSaturation,
  LensFlare,
  N8AO,
  Noise,
  Pixelation,
  Scanline,
  Sepia,
  SMAA,
  TiltShift2,
  ToneMapping,
  Vignette,
  WaterEffect,
} from "@react-three/postprocessing";
import {
  BlendFunction,
  type BloomEffect,
  type DepthOfFieldEffect,
  GlitchMode,
  type GodRaysEffect,
  KernelSize,
  ToneMappingMode,
  type VignetteEffect,
} from "postprocessing";
import { Color, MathUtils, type Mesh, Vector2, type Vector3 } from "three";
import { sky } from "./Atmosphere";
import { useShowcase } from "./store";

const CHROMA_OFFSET = new Vector2(0.0005, 0.0004);
const GLITCH_DELAY = new Vector2(2.5, 6);
const GLITCH_DURATION = new Vector2(0.12, 0.35);
const GLITCH_STRENGTH = new Vector2(0.05, 0.25);
const FLARE_GAIN = new Color(12, 10, 8);

interface Live {
  bloom: BloomEffect | null;
  godRays: GodRaysEffect | null;
  vignette: VignetteEffect | null;
  dof: DepthOfFieldEffect | null;
}

// Effects follow the time of day: more glow and a darker frame after dusk,
// god rays that fade as the sun goes down
function tune(live: Live, focus: Vector3 | undefined) {
  const n = sky.night;
  if (live.bloom) live.bloom.intensity = MathUtils.lerp(0.4, 1.7, n) + sky.golden * 0.25;
  if (live.godRays) live.godRays.godRaysMaterial.weight = MathUtils.lerp(0.5, 0.18, n) + sky.golden * 0.25;
  if (live.vignette) live.vignette.darkness = MathUtils.lerp(0.45, 0.72, n);
  if (live.dof && focus && live.dof.target !== focus) live.dof.target = focus;
}

export default function Effects({ disc }: { disc: Mesh | null }) {
  const fx = useShowcase((s) => s.fx);
  const controls = useThree((s) => s.controls) as { target?: Vector3 } | null;
  const live = useRef<Live>({ bloom: null, godRays: null, vignette: null, dof: null });

  useFrame(() => tune(live.current, controls?.target));

  return (
    <EffectComposer autoClear={false} multisampling={4} enableNormalPass={false}>
      {fx.ao ? <N8AO halfRes quality="high" aoRadius={2} distanceFalloff={1} intensity={1.8} denoiseRadius={10} /> : <></>}
      {fx.godrays && disc ? (
        <GodRays
          ref={(e) => {
            live.current.godRays = e;
          }}
          sun={disc}
          samples={48}
          density={0.94}
          decay={0.93}
          weight={0.5}
          exposure={0.42}
          clampMax={1}
          blur
          kernelSize={KernelSize.SMALL}
        />
      ) : (
        <></>
      )}
      {fx.dof ? (
        <DepthOfField
          ref={(e) => {
            live.current.dof = e;
          }}
          worldFocusRange={14}
          bokehScale={4}
        />
      ) : (
        <></>
      )}
      {fx.tiltshift ? <TiltShift2 blur={0.12} taper={0.6} start={[0.5, 0.0]} end={[0.5, 1.0]} samples={14} /> : <></>}
      {fx.bloom ? (
        <Bloom
          ref={(e) => {
            live.current.bloom = e;
          }}
          mipmapBlur
          luminanceThreshold={0.85}
          luminanceSmoothing={0.3}
          intensity={0.45}
        />
      ) : (
        <></>
      )}
      {fx.lensflare ? (
        <LensFlare lensPosition={sky.lightPos} glareSize={0.25} flareSize={0.006} starPoints={6} colorGain={FLARE_GAIN} haloScale={0.45} ghostScale={0.12} />
      ) : (
        <></>
      )}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {fx.grade ? <HueSaturation saturation={0.12} hue={0} /> : <></>}
      {fx.grade ? <BrightnessContrast brightness={0.01} contrast={0.08} /> : <></>}
      {fx.sepia ? <Sepia intensity={0.75} /> : <></>}
      {fx.mono ? <ColorAverage blendFunction={BlendFunction.NORMAL} /> : <></>}
      {fx.colordepth ? <ColorDepth bits={5} /> : <></>}
      {fx.water ? <WaterEffect factor={0.6} /> : <></>}
      {fx.dotscreen ? <DotScreen angle={Math.PI * 0.25} scale={1.4} blendFunction={BlendFunction.OVERLAY} /> : <></>}
      {fx.pixel ? <Pixelation granularity={6} /> : <></>}
      {fx.ascii ? <ASCII fontSize={54} cellSize={10} color="#9effc8" /> : <></>}
      {fx.scanline ? <Scanline density={1.6} opacity={0.18} blendFunction={BlendFunction.OVERLAY} /> : <></>}
      {fx.glitch ? (
        <Glitch delay={GLITCH_DELAY} duration={GLITCH_DURATION} strength={GLITCH_STRENGTH} mode={GlitchMode.SPORADIC} ratio={0.85} />
      ) : (
        <></>
      )}
      {fx.chroma ? <ChromaticAberration offset={CHROMA_OFFSET} radialModulation modulationOffset={0.25} /> : <></>}
      {fx.vignette ? (
        <Vignette
          ref={(e) => {
            live.current.vignette = e;
          }}
          offset={0.28}
          darkness={0.45}
        />
      ) : (
        <></>
      )}
      {fx.grain ? <Noise opacity={0.06} blendFunction={BlendFunction.OVERLAY} /> : <></>}
      {fx.smaa ? <SMAA /> : <></>}
    </EffectComposer>
  );
}
