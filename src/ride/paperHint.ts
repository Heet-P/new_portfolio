import { create } from "zustand";
import { markPaperHintSeen, readPaperHintSeen } from "./hint";

/**
 * Whether the cabin paper's first-time cue ("Scroll to read · keep scrolling to ride on") has
 * been seen this session. A store, not component state, because two places read it: the paper
 * draws the chip, and the Departure ScrollHint stays away while it is up (one hint at a time).
 * Read once from sessionStorage when this module loads in the browser (the ride never renders
 * on the server, so there is nothing to hydrate against).
 */
export const usePaperHint = create<{ seen: boolean }>(() => ({ seen: readPaperHintSeen() }));

/** The visitor has found the end of a page (or the stop buttons): drop the chip for the session. */
export function dismissPaperHint(): void {
  if (usePaperHint.getState().seen) return;
  markPaperHintSeen();
  usePaperHint.setState({ seen: true });
}
