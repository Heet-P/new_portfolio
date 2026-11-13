/**
 * Every tunable number of the night train's sound, in one place, so it can be tuned by ear
 * without reading the engine. Everything is synthesized in the browser (Web Audio API); there
 * are no audio files.
 *
 * Brief from Heet: mellow, soothing, lo-fi; never harsh or clicky. So: soft attacks, nothing
 * bright (the music sits under a ~1.5 kHz lowpass), slow tempo, quiet overall.
 *
 * Units: gains are linear amplitude (0.5 = -6 dB), times in seconds, frequencies in Hz,
 * detune in cents (100 = a semitone). MIDI note numbers: 60 = middle C (C4).
 */

/** Master: the one fader to the speakers. */
export const MASTER = {
  /**
   * Output level with everything on (0.25 = -12 dB). Measured in Chromium (30 s capture of a
   * ride with travel, rain and the arrival chime): ~-34 dBFS average, loudest peak (chime over
   * a kick) ~-15.5 dBFS, under the -14 dBFS ceiling: background music, not a soundtrack.
   */
  level: 0.25,
  /** Fade in / out when sound is switched or the tab is hidden (spec: no hard starts). */
  fade: 0.6,
} as const;

/** Bus levels: the music is the bed, ambience sits under it, UI cues are a whisper. */
export const MIX = {
  music: 0.55,
  ambience: 0.4,
  ui: 0.5,
  /** Reverb: how much of the music is sent to the room, and the room's return level. */
  musicReverbSend: 0.22,
  reverbReturn: 0.55,
} as const;

/** The room: a procedurally generated impulse response (decaying, darkening noise). */
export const REVERB = {
  /** Tail length (s) to -60 dB. */
  seconds: 2.4,
  /** Gap before the tail starts (s): keeps the dry sound clear. */
  preDelay: 0.015,
  /** One-pole smoothing of the noise at the start / end of the tail (0 = bright, ~1 = dark). */
  darkStart: 0.55,
  darkEnd: 0.92,
} as const;

/* ------------------------------------------------------------------ music */

/** Tempo and feel. 72 BPM is a slow lo-fi head-nod; swing makes the 8ths lope. */
export const TEMPO = {
  bpm: 72,
  /** Share of a beat taken by the on-beat 8th (0.5 = straight, 0.67 = triplet swing). */
  swing: 0.6,
  /** Random timing slop on drums (s), so the beat isn't machine-perfect. */
  humanize: 0.008,
} as const;

/**
 * The loop: four bars, one warm 7th/9th chord each (IV - iii - ii - I in C: Fmaj9, Em9, Dm9,
 * Cmaj9). `bass` is the root an octave or two down; `voicing` is the electric-piano chord,
 * rootless and close, middle register (nothing above ~G4 so it never gets bright).
 */
export const CHORDS: ReadonlyArray<{ name: string; bass: number; voicing: readonly number[] }> = [
  { name: "Fmaj9", bass: 41, voicing: [57, 60, 64, 67] }, // F2 | A3 C4 E4 G4
  { name: "Em9", bass: 40, voicing: [55, 59, 62, 66] }, // E2 | G3 B3 D4 F#4
  { name: "Dm9", bass: 38, voicing: [53, 57, 60, 64] }, // D2 | F3 A3 C4 E4
  { name: "Cmaj9", bass: 36, voicing: [52, 55, 59, 62] }, // C2 | E3 G3 B3 D4
];

/** Electric-piano-ish voice: a sine body, a detuned triangle for warmth, a quick soft "tine". */
export const KEYS = {
  /** Peak gain per note (a 4-note chord peaks at ~4x this). */
  level: 0.1,
  attack: 0.025,
  /** Decay time constant toward the sustain level, and that level (share of the peak). */
  decay: 1.1,
  sustain: 0.45,
  /** Release time constant after the chord ends (long: chords melt into each other). */
  release: 0.6,
  /** Triangle partner: level relative to the sine, and its fixed detune (chorus warmth). */
  triangleLevel: 0.3,
  triangleDetune: 7,
  /** The tine: a sine two octaves up, quiet and quickly gone (time constant, s). */
  tineLevel: 0.06,
  tineDecay: 0.12,
  /** Random per-note detune (+/- cents): slightly out of tune, like an old keyboard. */
  detuneSpread: 4,
  /** Strum: notes of a chord land this many seconds apart (random between min and max). */
  strumMin: 0.012,
  strumMax: 0.035,
  /** Per-bar variation: chance to drop one inner note, and to re-strike the top of the chord on "3-and". */
  dropNoteChance: 0.3,
  restrikeChance: 0.3,
  /** Velocity range per note (random). */
  velocityMin: 0.75,
  velocityMax: 1,
} as const;

/** Tape wobble: a slow LFO on every keys/bass oscillator's detune ("wow"). */
export const WOW = {
  rate: 0.45,
  /** Depth in cents (+/-). */
  depth: 7,
} as const;

/** Bass: a round sine with a little triangle, under its own low lowpass. */
export const BASS = {
  level: 0.3,
  triangleLevel: 0.25,
  cutoff: 260,
  attack: 0.02,
  /** Decay time constant: the note blooms then fades within the bar. */
  decay: 0.55,
  /** Chances per bar: a passing fifth on "4-and" and a pickup root on "2-and". */
  fifthChance: 0.45,
  pickupChance: 0.3,
} as const;

/**
 * The lazy beat, on an 8th-note grid (8 steps per bar: 1 & 2 & 3 & 4 &). Each entry is the
 * chance a hit happens on that step (1 = always). Very low in the mix.
 */
export const DRUMS = {
  kick: [1, 0, 0, 0.35, 0, 0.75, 0, 0],
  snare: [0, 0, 1, 0, 0, 0, 1, 0.08],
  hat: [0.9, 0.7, 0.9, 0.7, 0.9, 0.7, 0.9, 0.8],
  /** Hats: louder on the beat, softer off it. */
  hatAccent: 1,
  hatOffbeat: 0.55,
  /** Kick: a pitched sine drop (Hz) over `drop` s, with this peak and decay time constant. */
  kickFrom: 105,
  kickTo: 46,
  kickDrop: 0.14,
  kickLevel: 0.42,
  kickDecay: 0.09,
  /** Brushed snare: band-passed noise, a slow-ish attack (a brush, not a stick). */
  snareFreq: 1800,
  snareQ: 0.6,
  snareLevel: 0.12,
  snareAttack: 0.01,
  snareDecay: 0.07,
  /** Hat: band-passed noise, very short. */
  hatFreq: 2600,
  hatQ: 0.9,
  hatLevel: 0.055,
  hatDecay: 0.022,
} as const;

/** The "muffled lo-fi" filter every musical voice goes through. */
export const MUSIC_FILTER = {
  cutoff: 1500,
  Q: 0.6,
} as const;

/** Vinyl crackle: a looped buffer of sparse clicks over a faint noise bed, generated once. */
export const VINYL = {
  /** Loop length (s); long enough that the pattern of clicks doesn't read as a loop. */
  seconds: 7,
  level: 0.16,
  /** Faint hiss bed level and its smoothing (0..1, higher = darker). */
  bed: 0.012,
  bedDark: 0.8,
  /** Clicks per second, and their size range. Rare bigger pops on top. */
  clicksPerSecond: 5,
  clickMin: 0.05,
  clickMax: 0.35,
  popsPerSecond: 0.3,
  pop: 0.6,
  /** Its own lowpass, a little brighter than the music so the crackle sits "on" the record. */
  cutoff: 3200,
} as const;

/* -------------------------------------------------------------- ambience */

/** Rain: pink-ish noise (filtered white noise, generated once) plus occasional droplets. */
export const RAIN = {
  /** Level at full rain (rainAmount = 1). Dry by day: follows the visuals' rain amount. */
  level: 0.32,
  highpass: 350,
  lowpass: 3800,
  /** Droplets: average per second at full rain, level, and pitch range (a soft "plip" falling in pitch). */
  dropsPerSecond: 3,
  dropLevel: 0.05,
  dropFreqMin: 1300,
  dropFreqMax: 2200,
  /** How much of the rain is left inside a tunnel (the hill is in the way). */
  inTunnel: 0.1,
} as const;

/** Rumble: low brown noise and a motor hum, both swelling with the train's speed. */
export const RUMBLE = {
  /** Gain at rest and at full speed (travel.speed 0..1). Settles at stops, never silent. */
  idle: 0.15,
  full: 0.75,
  /**
   * Lowpass on the rumble at rest / full speed: opens as the train speeds up. Kept above
   * ~150 Hz so laptop and phone speakers (little below ~150 Hz) still carry some of it.
   */
  cutoffIdle: 180,
  cutoffFull: 650,
  /** Motor hum: a low sine (+ its octave) whose pitch rises a touch with speed. */
  humLevelIdle: 0.05,
  humLevelFull: 0.09,
  humFreqIdle: 48,
  humFreqFull: 62,
  /** The octave (~100-125 Hz) is what small speakers actually play of the hum. */
  humOctaveLevel: 0.6,
  /** Smoothing of speed-driven changes (time constant, s): swells, never jumps. */
  smoothing: 0.25,
} as const;

/** Wheels over rail joints: a soft thump pair ("clack-clack") at a rate following speed. */
export const CLACK = {
  /** Seconds between joints at full speed (rate scales with speed); never faster than `minInterval`. */
  interval: 0.62,
  minInterval: 0.5,
  /** Below this speed there are no clacks (the train is creeping or parked). */
  minSpeed: 0.06,
  /** Gap between the two thumps of a pair (front and rear wheels of a bogie). */
  pairGap: 0.13,
  /** Thump: a low sine drop plus a dull noise knock, level scaled by speed^0.7. */
  level: 0.16,
  freqFrom: 85,
  freqTo: 55,
  decay: 0.05,
  knockCutoff: 380,
  knockLevel: 0.6,
  /** Random level variation per thump (+/- share). */
  jitter: 0.25,
} as const;

/** Inside a tunnel: everything ambient darker and roomier. */
export const TUNNEL = {
  /** Ambience lowpass in the open and fully inside a bore. */
  openCutoff: 6000,
  closedCutoff: 650,
  /** Ambience reverb send in the open / inside. */
  reverbOpen: 0.06,
  reverbClosed: 0.35,
  /** Rumble boost inside (the walls give it back). */
  rumbleBoost: 1.25,
} as const;

/**
 * prefers-reduced-motion keeps the sound but softens what follows motion: the speed-driven
 * swell of the rumble and the clacks are scaled by this.
 */
export const REDUCED_MOTION_DEPTH = 0.5;

/* ------------------------------------------------------------------- cues */

/** Station chime on arrival: three soft bell notes (F4 A4 C5, the key of the music). */
export const CHIME = {
  notes: [65, 69, 72],
  /** Seconds between notes. */
  spacing: 0.34,
  level: 0.16,
  /** Bell-ish partials: ratio to the fundamental, relative level, decay time constant (s). */
  partials: [
    { ratio: 1, level: 1, decay: 1.1 },
    { ratio: 2, level: 0.28, decay: 0.6 },
    { ratio: 3, level: 0.08, decay: 0.35 },
    { ratio: 4.07, level: 0.04, decay: 0.2 },
  ],
  attack: 0.008,
  /** Reverb send for the chime (a station hall). */
  reverb: 0.5,
} as const;

/** UI tap: a muffled paper tap, ~50 ms of band-passed noise with a tiny low body. */
export const TAP = {
  level: 0.22,
  freq: 900,
  /** Random +/- share on the frequency, so repeated taps don't sound identical. */
  freqJitter: 0.15,
  Q: 1.2,
  lowpass: 2200,
  attack: 0.002,
  decay: 0.012,
  length: 0.06,
  bodyFreq: 190,
  bodyLevel: 0.06,
  /** Two taps closer than this (s) play as one. */
  minGap: 0.03,
} as const;

/**
 * Rubber stamp / printing-press "chunk" (Express whimsy: the Stop press stamp landing, the
 * masthead's ka-chunk): a duller, lower cousin of the tap. A short low-passed noise thud plus a
 * low body that drops in pitch, like a stamp pressed into paper on a wooden desk. Quieter than
 * the tap overall (it has more low end, so it reads as heavier without being louder).
 */
export const STAMP = {
  level: 0.12,
  /** The thud's noise: low-passed, not band-passed, so it has no "click" on top. */
  lowpass: 900,
  attack: 0.003,
  decay: 0.03,
  length: 0.16,
  /** The body: a sine gliding from bodyFreq down to bodyFreqTo (the desk taking the weight). */
  bodyFreq: 120,
  bodyFreqTo: 70,
  bodyLevel: 0.1,
  bodyDecay: 0.045,
  /** Two stamps closer than this (s) play as one (a double click is one thunk). */
  minGap: 0.08,
} as const;

/** Newspaper unfolding: a short paper rustle made of a few overlapping noise grains. */
export const RUSTLE = {
  grains: 6,
  /** Total length (s) the grains are spread over. */
  spread: 0.42,
  levelMin: 0.03,
  levelMax: 0.07,
  freqMin: 2200,
  freqMax: 3600,
  Q: 0.7,
  attackMin: 0.015,
  attackMax: 0.03,
  decayMin: 0.03,
  decayMax: 0.06,
  lowpass: 4500,
} as const;

/** Look-ahead scheduling (see scheduler.ts). */
export const SCHEDULING = {
  /** How far ahead of the audio clock events are queued (s). */
  lookahead: 0.5,
  /** How often the queue is topped up (ms). Any timer jitter below lookahead is inaudible. */
  intervalMs: 100,
} as const;

/** Scene values are sent on only when they change by more than this (no per-frame automation spam). */
export const PARAM_EPSILON = 0.004;
