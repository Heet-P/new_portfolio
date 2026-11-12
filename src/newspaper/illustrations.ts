import type { StationId } from "@/content/route";

/**
 * Heet's ink-sketch illustrations, one per stop, processed by `npm run illustrations` into
 * public/illustrations/<id>.webp (1200w) and <id>-600.webp (600w). A stop missing here gets the
 * ink ornament instead (see Clipping), so adding a stop never needs an image first.
 */
export interface Illustration {
  /** What the sketch shows, for screen readers (it is content, not decoration). */
  alt: string;
  /** Slight tilt of the pasted-in clipping, degrees (kept within +-1.5). */
  tilt: number;
}

/** Intrinsic size of the 1200w file (all sketches are 3:2). */
export const ILLUSTRATION_SIZE = { w: 1200, h: 800 } as const;

export const ILLUSTRATIONS: Partial<Record<StationId, Illustration>> = {
  departure: {
    alt: "Ink sketch of a worn leather suitcase, an open pocket watch on its chain and a train ticket, ready to depart.",
    tilt: -1.2,
  },
  vaani: {
    alt: "Ink sketch of a ringing rotary telephone beside a speech bubble with a voice waveform, a pen and an open ledger with ticked boxes.",
    tilt: 1.4,
  },
  yieldguard: {
    alt: "Ink sketch of a silicon wafer under a magnifying glass, faulty dies marked with red crosses, next to a microscope.",
    tilt: -0.8,
  },
  solar: {
    alt: "Ink sketch of factories and housing blocks with solar panels on their roofs, and a map with a dotted route between red pins.",
    tilt: 1.1,
  },
  sahara: {
    alt: "Ink sketch of a quadcopter drone over collapsed buildings and smoke, its camera framing a survivor waving from the rubble.",
    tilt: -1.4,
  },
  experience: {
    alt: "Ink sketch of a laptop showing a checkout page with a cart and a confirm button, with a receipt, a payment card and a coffee.",
    tilt: 0.9,
  },
  next: {
    alt: "Ink sketch of an empty railway platform with a bench, a lamp and a blank station sign, the track curving away toward the sunrise.",
    tilt: -1,
  },
  terminus: {
    alt: "Ink sketch of a sealed envelope with a red wax seal, a fountain pen and a blank ticket, beside the buffer stop at the end of the line.",
    tilt: 1.3,
  },
};
