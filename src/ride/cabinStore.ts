import { create } from "zustand";
import { insideCabin, passGate, smoothDamp, stopBlend } from "./stopCamera";

/**
 * Shared state of the "into the cabin" moment.
 *
 * Two layers, so nothing re-renders React per frame:
 * - `cabinFrame`: a plain mutable object rewritten every frame by the scene (blend, the 3D
 *   panel's place on screen). Per-frame visuals (camera, overlay opacity, the display's
 *   tracking transform) read it directly; DOM listeners are told via onCabinFrame.
 * - `useCabin`: a tiny zustand store that changes only when the display is shown or hidden
 *   (with hysteresis), carrying which station it should show. That is all React needs.
 */

/** A screen rectangle in CSS px (top-left origin). */
export interface ScreenRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const cabinFrame = {
  /** 0 = chase camera outside, 1 = settled inside facing the display (smoothed in time). */
  blend: 0,
  /** True once the cabin model is mounted; until then the camera never goes inside. */
  ready: false,
  /** True after the first frame with the cabin ready (that frame snaps instead of gliding). */
  started: false,
  /** The camera is inside the cabin this frame: the outside world can skip drawing. */
  inside: false,
  /** Where the 3D display panel's screen is on screen this frame (written by the Cabin). */
  panel: { x: 0, y: 0, w: 0, h: 0 } as ScreenRect,
  /**
   * The display's laid-out rect (written by the DOM display whenever it resizes). The 3D panel
   * is sized so that, with the camera settled, its screen covers exactly this rect.
   */
  target: { x: 0, y: 0, w: 0, h: 0 } as ScreenRect,
  /**
   * Frames left in which the cabin AND the outside world both draw, whatever the camera does:
   * a shader warm-up right after load (see Cabin), so neither the first trip into the cabin
   * nor the first trip out of it stalls on compiling programs.
   */
  warm: 0,
};

/** The spring behind `blend` (value + velocity), integrated by stepCabin. */
const spring = { value: 0, velocity: 0 };

/**
 * Spring times (s) of the blend. The train itself brakes into a stop in well under a second;
 * the spring turns that into an unhurried glide into the cabin (IN), and a quicker exit as the
 * train pulls away (OUT), so the visitor is back outside while the train gathers speed.
 */
const BLEND_SMOOTH_IN = 1.0;
const BLEND_SMOOTH_OUT = 0.3;
/** The display is "shown" (rendered, focusable) above SHOW_ON and hidden again below SHOW_OFF. */
const SHOW_ON = 0.7;
const SHOW_OFF = 0.6;

interface CabinUi {
  /** The display has content and is exposed to assistive tech / keyboard. */
  shown: boolean;
  /** STATIONS index the display shows (only changes while the display is hidden). */
  stationIndex: number;
}

export const useCabin = create<CabinUi>(() => ({ shown: false, stationIndex: 0 }));

/**
 * Advance the cabin blend one frame from the train's position (stations) and speed (0..1).
 * Called once per frame by the scene before the camera reads it. Touches the React store only
 * when the display crosses its show/hide thresholds.
 */
export function stepCabin(position: number, speed: number, dt: number): void {
  const f = cabinFrame;
  const target = f.ready ? stopBlend(position) * passGate(speed) : 0;
  const snap = !f.started;
  if (snap) {
    // First frame with the cabin loaded (the scene is still fading in), or a snap (snapCabin):
    // jump straight to the right state, so a deep link to a station opens already settled in
    // front of that station's display, and a snap away from a stop closes it at once.
    spring.value = target;
    spring.velocity = 0;
    f.started = f.ready;
  } else {
    // Same frame-time cap as the train (travel.ts), so the blend keeps pace with it even when
    // frames are slow or a background tab returns with a huge delta.
    const smooth = target > spring.value ? BLEND_SMOOTH_IN : BLEND_SMOOTH_OUT;
    smoothDamp(spring, target, smooth, Math.min(dt, 0.1));
    // Land exactly on the target (e.g. 1 = settled), so the display's transform can drop to none.
    if (Math.abs(spring.value - target) < 1e-4 && Math.abs(spring.velocity) < 1e-3) {
      spring.value = target;
      spring.velocity = 0;
    }
  }
  f.blend = spring.value;
  f.inside = insideCabin(f.blend);

  const ui = useCabin.getState();
  if (snap) {
    // No hysteresis on a snap: shown exactly when settled, and showing THIS stop.
    const shown = f.blend >= SHOW_ON;
    const index = Math.round(position);
    if (shown !== ui.shown || (shown && ui.stationIndex !== index)) useCabin.setState(shown ? { shown, stationIndex: index } : { shown });
  } else if (!ui.shown && f.blend >= SHOW_ON) useCabin.setState({ shown: true, stationIndex: Math.round(position) });
  else if (ui.shown && f.blend < SHOW_OFF) useCabin.setState({ shown: false });
}

const listeners = new Set<() => void>();

/** Run `fn` every frame after the scene has updated cabinFrame. Returns an unsubscribe. */
export function onCabinFrame(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Called by the scene once per frame, after the camera and the panel are placed. */
export function emitCabinFrame(): void {
  for (const fn of listeners) fn();
}

/**
 * The ride was re-anchored (a deep link fixed up after load, re-entry from Express): the next
 * frame jumps the blend to wherever the train now is instead of gliding out of one cabin and
 * into another, and the display shows the right stop straight away.
 */
export function snapCabin(): void {
  cabinFrame.started = false;
}

/** Back to "outside, nothing loaded" (scene unmount, tests). */
export function resetCabin(): void {
  Object.assign(cabinFrame, { blend: 0, ready: false, started: false, inside: false, warm: 0 });
  spring.value = 0;
  spring.velocity = 0;
  useCabin.setState({ shown: false, stationIndex: 0 });
}
