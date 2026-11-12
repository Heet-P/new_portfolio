"use client";

import { useEffect, useRef } from "react";
import { cabinFrame, onCabinFrame } from "../cabinStore";
import { swapOpacity } from "../stopCamera";
import styles from "./SwapOverlay.module.css";

/**
 * The "through the window" moment: a full-screen wash in the cabin's warm colour (with a
 * slight blur) that peaks exactly while the camera jumps from outside the train into the
 * cabin, so the cut is never seen. Opacity is written per frame from the cabin blend;
 * hidden (and its blur skipped) whenever it is fully transparent. Decorative only.
 */
export function SwapOverlay() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let last = -1;
    return onCabinFrame(() => {
      const el = ref.current;
      const o = swapOpacity(cabinFrame.blend);
      if (!el || o === last) return;
      el.style.opacity = String(o);
      el.style.visibility = o > 0 ? "visible" : "hidden";
      last = o;
    });
  }, []);

  return <div ref={ref} className={styles.swap} aria-hidden="true" />;
}
