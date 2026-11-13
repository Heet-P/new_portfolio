import { MASTER } from "./soundDesign";
import { buildGraph, type SoundGraph } from "./synth";

/**
 * The night train's sound: on/off, persistence, the browser's rules, and the hand-off to the
 * synthesized sound world (synth.ts). Off by default.
 *
 * Lifecycle:
 * - No AudioContext exists until the visitor turns sound on (autoplay policy: it is created
 *   inside that click). A returning visitor who left sound on gets it back on their first
 *   gesture anywhere on the page, never before.
 * - On/off and tab visibility both drive one master fade (MASTER.fade). Once faded out, the
 *   scheduler stops and the context is suspended, so a silent engine costs no CPU.
 * - Every storage access is wrapped: if localStorage throws (private mode), the toggle still
 *   works for the session and simply isn't remembered.
 */
/**
 * What the toggle shows: "off"; "on" (playing); or "pending": on, but the browser has not let
 * audio start yet (a remembered "on" before the visitor's first click or key).
 */
export type SoundState = "off" | "pending" | "on";

export interface AudioEngine {
  enabled(): boolean;
  /** On/off plus whether the audio clock is actually running (for the toggle's pending look). */
  state(): SoundState;
  /**
   * Fades in/out over 600 ms and remembers the choice under `nt-sound`. Turning on where Web
   * Audio cannot start leaves it off (and remembers nothing); asking for "on" again while
   * pending retries starting the audio from this gesture.
   */
  setEnabled(on: boolean): void;
  /** travel.speed 0..1: rumble gain, its lowpass and the rail clacks follow it. */
  setTravelSpeed(v: number): void;
  /** Rain amount 0..1 (weather.rainAmount): rain bed and droplets. Dry by day. */
  setRain(v: number): void;
  /** 0..1 how far inside a tunnel: ambience darker and roomier, rain muffled. */
  setTunnel(v: number): void;
  /** One-off cues; all no-ops while sound is off (or the tab is hidden). */
  chime(): void;
  tap(): void;
  rustle(): void;
  /** A soft rubber-stamp / printing-press thunk (Express whimsy). */
  stamp(): void;
  /**
   * The intro's ticket printer: soft dot-matrix chatter, in bursts synced to the paper feed,
   * spread over `durationSec` from now (Task 14).
   */
  printChatter(durationSec: number): void;
  /** Cuts the printer chatter short (Skip, boarding mid-print); a no-op when none is playing. */
  stopChatter(): void;
  /** For React (useSyncExternalStore): called whenever enabled() changes. */
  subscribe(fn: () => void): () => void;
  dispose(): void;
}

export const SOUND_KEY = "nt-sound";

/** Events that count as a user gesture, any of which may unlock audio for a remembered "on". */
const GESTURES = ["pointerdown", "keydown", "touchend", "click"] as const;

const clamp01 = (n: number) => (n > 1 ? 1 : n > 0 ? n : 0);

/** window.localStorage, or undefined where even touching it throws. */
function defaultStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function createAudioEngine(deps: { storage?: Storage; doc?: Document; ctx?: () => AudioContext; reducedMotion?: boolean } = {}): AudioEngine {
  const storage = "storage" in deps ? deps.storage : defaultStorage();
  const doc = deps.doc ?? document;
  const makeContext = deps.ctx ?? (() => new AudioContext());

  let on = false;
  try {
    on = storage?.getItem(SOUND_KEY) === "1";
  } catch {
    // Unreadable storage: off, as for a first visit.
  }

  let ctx: AudioContext | null = null;
  let graph: SoundGraph | null = null;
  let suspendTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  /** Latest scene values, kept while there is no graph yet and handed over when it is built. */
  const scene = { speed: 0, rain: 0, tunnel: 0 };
  const listeners = new Set<() => void>();

  const audible = () => on && !doc.hidden && !disposed;
  const notify = () => {
    for (const fn of listeners) fn();
  };

  /** Create the context and the sound world (once). Fails quietly where Web Audio is missing. */
  const ensureGraph = (): SoundGraph | null => {
    if (graph || disposed) return graph;
    try {
      ctx = makeContext();
      // The toggle's pending look follows the clock: tell it when the browser lets audio run.
      try {
        ctx.addEventListener?.("statechange", notify);
      } catch {
        // Older engines without events on the context: the resume() promise below covers it.
      }
      const reducedMotion =
        deps.reducedMotion ?? (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
      graph = buildGraph(ctx, { reducedMotion });
      graph.setSpeed(scene.speed);
      graph.setRain(scene.rain);
      graph.setTunnel(scene.tunnel);
    } catch {
      ctx = null;
      graph = null;
    }
    return graph;
  };

  /** Bring the speakers in line with "on and visible": fade in (and wake), or fade out (then sleep). */
  const update = () => {
    if (!ctx || !graph) return;
    const g = graph.master.gain;
    const t = ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    if (audible()) {
      if (suspendTimer !== null) clearTimeout(suspendTimer);
      suspendTimer = null;
      ctx.resume().then(notify, () => {});
      graph.scheduler.start();
      g.linearRampToValueAtTime(MASTER.level, t + MASTER.fade);
    } else {
      g.linearRampToValueAtTime(0, t + MASTER.fade);
      if (suspendTimer === null) {
        const c = ctx;
        const s = graph.scheduler;
        suspendTimer = setTimeout(() => {
          suspendTimer = null;
          s.stop();
          c.suspend().catch(() => {});
        }, MASTER.fade * 1000 + 50);
      }
    }
  };

  /*
   * A remembered "on": wait for the first gesture, which the browser lets us start audio from.
   * Listening stays on until the context is actually running: some events (a touch's
   * pointerdown) don't count as activation everywhere, and the next one will.
   */
  const onGesture = (e: Event) => {
    // A press on the sound toggle itself is left to the toggle: pending, its click starts the
    // sound (and is a gesture too); starting it here would flip it to "on" before that click
    // runs, which would then read as "switch off".
    if (e.target instanceof Element && e.target.closest("[data-sound-toggle]")) return;
    if (on) {
      if (ensureGraph()) update();
      else {
        // No Web Audio here after all: show the toggle off rather than pressed and silent.
        on = false;
        notify();
      }
    }
    if (!on || !ctx || ctx.state === "running") removeGestureListeners();
  };
  function removeGestureListeners() {
    for (const type of GESTURES) doc.removeEventListener(type, onGesture, true);
  }
  if (on) for (const type of GESTURES) doc.addEventListener(type, onGesture, true);

  const onVisibility = () => update();
  doc.addEventListener("visibilitychange", onVisibility);

  return {
    enabled: () => on,
    state: () => (!on ? "off" : ctx?.state === "running" ? "on" : "pending"),
    setEnabled(next) {
      if (disposed) return;
      // Turning on needs an AudioContext; if the browser can't make one, stay off (the toggle
      // stays usable: the next click simply tries again).
      if (next && !ensureGraph()) {
        if (on) {
          on = false;
          notify();
        }
        return;
      }
      try {
        storage?.setItem(SOUND_KEY, next ? "1" : "0");
      } catch {
        // Not remembered, but still works for this session.
      }
      if (next === on) {
        // Already on but pending: this is a gesture, so try to start the clock now.
        if (on) update();
        return;
      }
      on = next;
      update();
      notify();
    },
    setTravelSpeed(v) {
      scene.speed = clamp01(v);
      graph?.setSpeed(scene.speed);
    },
    setRain(v) {
      scene.rain = clamp01(v);
      graph?.setRain(scene.rain);
    },
    setTunnel(v) {
      scene.tunnel = clamp01(v);
      graph?.setTunnel(scene.tunnel);
    },
    chime() {
      if (audible()) graph?.chime();
    },
    tap() {
      if (audible()) graph?.tap();
    },
    rustle() {
      if (audible()) graph?.rustle();
    },
    stamp() {
      // The stamp can fire from a scroll (Stop press landing), with no gesture to wake a
      // suspended context: only play on a running clock, never queue it up for later.
      if (audible() && ctx?.state === "running") graph?.stamp();
    },
    printChatter(durationSec) {
      // Fires from the intro's timer, not a gesture: like the stamp, only on a running clock
      // (a queued chatter would otherwise burst out late, on the visitor's first click).
      if (audible() && ctx?.state === "running") graph?.printChatter(durationSec);
    },
    stopChatter() {
      // Not gated on audible(): a chatter queued while on must still be cut after a switch-off.
      graph?.stopChatter();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    dispose() {
      disposed = true;
      removeGestureListeners();
      doc.removeEventListener("visibilitychange", onVisibility);
      if (suspendTimer !== null) clearTimeout(suspendTimer);
      suspendTimer = null;
      graph?.scheduler.stop();
      ctx?.close().catch(() => {});
      graph = null;
      ctx = null;
      listeners.clear();
    },
  };
}
