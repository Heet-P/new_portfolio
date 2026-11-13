import { create } from "zustand";
import { STATIONS } from "@/content/route";

export type RideMode = "ride" | "express";

interface RideState {
  /** "ride" = 3D scroll journey, "express" = plain HTML. The real initial mode is chosen on the client. */
  mode: RideMode;
  /** Progress along the station timeline, 0..1 (mapping.ts); the scroll driver maps the page scroll to it. */
  progress: number;
  /** Station the scroll driver should animate toward (null = free scrolling). The driver clears it on arrival. */
  target: number | null;
  /**
   * True once the 3D scene has drawn its first frame with the train (false again when it
   * unmounts). The ticket-printer intro waits on it, so the world loads while the ticket prints.
   */
  sceneReady: boolean;
  setProgress: (p: number) => void;
  goTo: (index: number) => void;
  setMode: (m: RideMode) => void;
}

const LAST_STATION = STATIONS.length - 1;

export const useRide = create<RideState>((set) => ({
  mode: "express",
  progress: 0,
  target: null,
  sceneReady: false,
  setProgress: (p) => set({ progress: Math.min(1, Math.max(0, p)) }),
  // Only records the destination; the scroll driver animates progress toward it.
  goTo: (index) => set({ target: Math.min(LAST_STATION, Math.max(0, index)) }),
  setMode: (mode) => set({ mode }),
}));
