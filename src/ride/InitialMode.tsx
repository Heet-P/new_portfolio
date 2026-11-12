"use client";

import { useInitialMode } from "./useInitialMode";

/** Render-nothing client component so the (server) page can mount the mode hook once. */
export function InitialMode() {
  useInitialMode();
  return null;
}
