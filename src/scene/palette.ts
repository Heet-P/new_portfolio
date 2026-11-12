import { STATIONS, type StationId } from "@/content/route";

/** A colour as linear-RGB channels (0..1): what three.js Color.setRGB expects by default. */
export type RGB = [number, number, number];

/**
 * Everything the time of day changes. Colours are linear RGB so blends between stations
 * are physically even (sRGB blends go muddy in the middle).
 * ground / foliage / rock are multipliers on the world's own vertex colours (white = as
 * authored); water is the water's actual colour.
 */
export interface Palette {
  skyTop: RGB;
  skyHorizon: RGB;
  /** Sun (later moon) light colour; also tints the sky glow around it. */
  sun: RGB;
  sunIntensity: number;
  /** Degrees above the horizon: the sun sinks through the evening, the moon then rides higher. */
  sunElevation: number;
  fog: RGB;
  /** FogExp2 density: clear at golden hour, a little hazier at night. */
  fogDensity: number;
  /** Hemisphere (sky) fill light colour; its brightness is the ambient level. */
  ambient: RGB;
  ground: RGB;
  foliage: RGB;
  rock: RGB;
  water: RGB;
  /** Emissive intensity of the train windows: faint by day, strong at night. */
  windowGlow: number;
  /** Star visibility in the sky dome, 0..1. */
  stars: number;
}

/** "#rrggbb" (sRGB, as designers write it) -> linear RGB. */
function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255)];
}

/**
 * The career as one evening: golden hour at Departure, warm late afternoon at the
 * internships, sunset into dusk for the big projects, twilight, then night (moonlight,
 * glowing windows) for "what's next" and the Terminus.
 */
export const STATION_PALETTES: Record<StationId, Palette> = {
  // Golden hour: blue upper sky, warm peach/gold horizon, long low warm sun.
  departure: {
    skyTop: hex("#5b87bf"), skyHorizon: hex("#f3c894"), sun: hex("#ffd29a"), sunIntensity: 3.2, sunElevation: 16,
    fog: hex("#e9cfa6"), fogDensity: 0.0016, ambient: hex("#a3b2cc"),
    ground: hex("#ffffff"), foliage: hex("#ffffff"), rock: hex("#ffffff"), water: hex("#3fa9a6"),
    windowGlow: 0.12, stars: 0,
  },
  // Warm late afternoon.
  mct: {
    skyTop: hex("#5682bb"), skyHorizon: hex("#f5bd84"), sun: hex("#ffc488"), sunIntensity: 3.0, sunElevation: 13,
    fog: hex("#ebc49a"), fogDensity: 0.0017, ambient: hex("#9eabc8"),
    ground: hex("#fff6ea"), foliage: hex("#fbf7ea"), rock: hex("#fff4e6"), water: hex("#3ca2a3"),
    windowGlow: 0.2, stars: 0,
  },
  vaani: {
    skyTop: hex("#5079b4"), skyHorizon: hex("#f6ae72"), sun: hex("#ffb06e"), sunIntensity: 2.7, sunElevation: 10,
    fog: hex("#e8b48a"), fogDensity: 0.0018, ambient: hex("#97a2c2"),
    ground: hex("#ffeedc"), foliage: hex("#f5efdc"), rock: hex("#ffebd8"), water: hex("#389aa0"),
    windowGlow: 0.32, stars: 0,
  },
  // Sunset: orange-pink horizon, sun touching the hills.
  yieldguard: {
    skyTop: hex("#475f9e"), skyHorizon: hex("#f28c5e"), sun: hex("#ff8e52"), sunIntensity: 2.6, sunElevation: 6,
    fog: hex("#cf8a78"), fogDensity: 0.002, ambient: hex("#8586ae"),
    ground: hex("#f2d8cc"), foliage: hex("#e6d6c8"), rock: hex("#f2d4c6"), water: hex("#347f99"),
    windowGlow: 0.65, stars: 0.05,
  },
  // Dusk: pink -> purple, the last of the sun.
  formai: {
    skyTop: hex("#36407f"), skyHorizon: hex("#d46d7c"), sun: hex("#f27a62"), sunIntensity: 1.4, sunElevation: 2.5,
    fog: hex("#8a6688"), fogDensity: 0.0022, ambient: hex("#666a9c"),
    ground: hex("#dccbd6"), foliage: hex("#cfc2cf"), rock: hex("#dccad4"), water: hex("#2c6288"),
    windowGlow: 1.05, stars: 0.18,
  },
  // Twilight: deep blue, the moon takes over as the key light.
  quizzx: {
    skyTop: hex("#1c275a"), skyHorizon: hex("#565a98"), sun: hex("#8c9ad6"), sunIntensity: 1.35, sunElevation: 18,
    fog: hex("#3a4070"), fogDensity: 0.0024, ambient: hex("#5a64a2"),
    ground: hex("#d2d4e6"), foliage: hex("#c4cade"), rock: hex("#d4d6e8"), water: hex("#23497e"),
    windowGlow: 1.5, stars: 0.45,
  },
  solar: {
    skyTop: hex("#121a46"), skyHorizon: hex("#373f7e"), sun: hex("#9aa8e0"), sunIntensity: 1.3, sunElevation: 24,
    fog: hex("#252b58"), fogDensity: 0.0025, ambient: hex("#4c5698"),
    ground: hex("#cacde4"), foliage: hex("#bcc2da"), rock: hex("#ccd0e6"), water: hex("#1c3c70"),
    windowGlow: 1.9, stars: 0.65,
  },
  // Night: indigo, cool moon.
  next: {
    skyTop: hex("#0a0f2e"), skyHorizon: hex("#22295a"), sun: hex("#a8b8f0"), sunIntensity: 1.25, sunElevation: 30,
    fog: hex("#161b3e"), fogDensity: 0.0026, ambient: hex("#424c8e"),
    ground: hex("#c4c8e2"), foliage: hex("#b4bcd8"), rock: hex("#c6cae4"), water: hex("#163262"),
    windowGlow: 2.2, stars: 0.85,
  },
  // Deep night at the end of the line.
  terminus: {
    skyTop: hex("#050716"), skyHorizon: hex("#161b40"), sun: hex("#b4c3ff"), sunIntensity: 1.2, sunElevation: 34,
    fog: hex("#0f1330"), fogDensity: 0.0027, ambient: hex("#3a4486"),
    ground: hex("#bec2e0"), foliage: hex("#acb6d4"), rock: hex("#c0c4e2"), water: hex("#122a56"),
    windowGlow: 2.5, stars: 1,
  },
};

const ORDER: Palette[] = STATIONS.map((s) => STATION_PALETTES[s.id]);
/** Palette fields, listed once (blendPalette runs every frame). */
const FIELDS = Object.keys(STATION_PALETTES.departure) as (keyof Palette)[];

function lerpRGB(out: RGB, a: RGB, b: RGB, t: number): RGB {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}

/** A fresh palette object to blend into (one per consumer, reused every frame). */
export function createPalette(): Palette {
  return structuredClone(STATION_PALETTES.departure);
}

/**
 * Blend station `index`'s palette toward the next one by `t` (0..1, smoothstep-eased so
 * colours settle gently into each station), writing into `out` without allocating.
 */
export function blendPalette(out: Palette, index: number, t: number): Palette {
  const i = Math.max(0, Math.min(ORDER.length - 1, Math.floor(index)));
  const a = ORDER[i];
  const b = ORDER[Math.min(ORDER.length - 1, i + 1)];
  const c = Math.max(0, Math.min(1, t));
  const e = c * c * (3 - 2 * c);
  for (const key of FIELDS) {
    const av = a[key];
    const bv = b[key];
    if (Array.isArray(av)) lerpRGB(out[key] as RGB, av, bv as RGB, e);
    else (out[key] as number) = av + ((bv as number) - av) * e;
  }
  return out;
}

/** Palette between station `index` and the next, at eased fraction t. Allocates: use blendPalette per frame. */
export function paletteAt(index: number, t: number): Palette {
  return blendPalette(createPalette(), index, t);
}
