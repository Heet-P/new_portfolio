"use client";

import { advance, type RootState } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRide } from "@/ride/rideStore";

/**
 * Two failure modes React's error boundary can't see, both turned into "switch to Express":
 * an exception thrown inside a useFrame callback (it runs in requestAnimationFrame, outside
 * React's render, so it would silently stop the frame loop and freeze the scene), and the GPU
 * dropping the WebGL context (driver reset, too many contexts, a phone backgrounding the tab).
 */

/**
 * Both guards for one `<Canvas frameloop="never">`: pass the returned function as its
 * onCreated. Frames render only once R3F has the canvas up and running.
 */
export function useGuardedCanvas(): (state: RootState) => void {
  const root = useRef<(() => RootState) | null>(null);
  const unwatch = useRef<(() => void) | null>(null);
  const frame = useCallback((seconds: number) => {
    const state = root.current?.();
    if (state?.internal.active) advance(seconds, true, state);
  }, []);
  useGuardedFrameLoop(frame);
  useEffect(() => () => unwatch.current?.(), []);
  return useCallback((state: RootState) => {
    root.current = state.get;
    unwatch.current = watchContextLoss(state.gl.domElement);
  }, []);
}

/**
 * Runs the canvas's frame loop itself (pair with `<Canvas frameloop="never">`), one guarded
 * call per animation frame. A frame that throws is re-thrown from this component's render, so
 * the surrounding SceneBoundary catches it like any other scene crash. Time is passed as seconds
 * since the first frame, so the first frame's delta is 0 (never a page-load-sized jump).
 */
export function useGuardedFrameLoop(frame: (seconds: number) => void): void {
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);
  useEffect(() => {
    let raf = 0;
    let start = -1;
    const tick = (now: number) => {
      if (start < 0) start = now;
      try {
        frame((now - start) / 1000);
      } catch (error) {
        setFailure({ error });
        return; // no next frame: the boundary takes it from here
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frame]);
  if (failure) throw failure.error;
}

/** Switch to Express if `canvas` loses its WebGL context. Returns the unhook function. */
export function watchContextLoss(canvas: HTMLCanvasElement): () => void {
  const onLost = () => {
    console.warn("Night Train: WebGL context lost, switching to Express.");
    useRide.getState().setMode("express");
  };
  canvas.addEventListener("webglcontextlost", onLost);
  return () => canvas.removeEventListener("webglcontextlost", onLost);
}
