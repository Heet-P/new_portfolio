"use client";

import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

/**
 * Look-and-feel knobs for the post chain. The composer renders the scene in linear HDR
 * (it switches the renderer's own tone mapping off), so the bloom threshold is in scene
 * light units. Bloom ramps in between `threshold` and `threshold + smoothing`: above the
 * golden-hour sun glints on the train roofs and wires (~1.3), below the sources that are
 * meant to glow: night windows (Train: windowGlow x bloomGlowBoost), moon, stars, the
 * headlamp's hot core and stacked waterfall mist.
 */
export const POST = {
  bloom: { threshold: 1.4, smoothing: 0.4, intensity: 0.9, radius: 0.72, levels: 6 },
  vignette: { offset: 0.32, darkness: 0.55 },
} as const;

/**
 * Desktop-tier post-processing: soft bloom on the light sources, then ACES tone mapping
 * (the same curve the renderer applies when there is no composer, so tiers match), then
 * a gentle vignette. Loaded lazily by Scene only when getQuality().post is true, so phones
 * never download postprocessing.
 */
export default function Effects() {
  const { bloom, vignette } = POST;
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        mipmapBlur
        luminanceThreshold={bloom.threshold}
        luminanceSmoothing={bloom.smoothing}
        intensity={bloom.intensity}
        radius={bloom.radius}
        levels={bloom.levels}
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={vignette.offset} darkness={vignette.darkness} />
    </EffectComposer>
  );
}
