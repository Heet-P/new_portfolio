/**
 * Rendering quality tiers. Pure function of the device so it is trivially testable;
 * Scene calls it once on mount with values read from window/navigator.
 */
export interface QualityEnv {
  /** Viewport width in CSS px. */
  width: number;
  /** window.devicePixelRatio. */
  dpr: number;
  /** True for touch-first devices (`(pointer: coarse)`). */
  coarsePointer: boolean;
  /** navigator.hardwareConcurrency (logical cores). */
  cores: number;
}

export interface Quality {
  /** Pixel ratio handed to the Canvas. */
  dpr: number;
  /** Bloom / vignette postprocessing on or off. */
  post: boolean;
  /** Rain particle count (T9). */
  rainDrops: number;
  /** Parallax scenery layers (T8). */
  sceneryLayers: number;
}

export function getQuality({ width, dpr, coarsePointer, cores }: QualityEnv): Quality {
  // Phones / small touch screens: same scene, simplified (spec section 6).
  const mobile = coarsePointer || width < 768;
  if (mobile) {
    return { dpr: Math.min(dpr, 1.5), post: false, rainDrops: 300, sceneryLayers: 2 };
  }
  // Low-core laptops keep full scenery but skip the fullscreen post passes.
  const weak = cores > 0 && cores <= 4;
  return { dpr: Math.min(dpr, 2), post: !weak, rainDrops: weak ? 600 : 1200, sceneryLayers: 4 };
}
