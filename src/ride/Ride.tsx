"use client";

import type { ReactNode } from "react";
import { STATIONS } from "@/content/route";
import { useRide } from "./rideStore";
import { RideOverlay } from "./RideOverlay";
import { useScrollDriver } from "./useScrollDriver";

/**
 * The ride, mounted only in ride mode: a tall spacer that gives the window its scroll
 * distance (one viewport per station) plus the fixed overlay. useScrollDriver turns that
 * scroll into progress. In Express mode this renders nothing.
 */
export function Ride() {
  const mode = useRide((s) => s.mode);
  useScrollDriver();

  if (mode !== "ride") return null;
  return (
    <>
      {/* overflow-anchor: none = the browser never "helpfully" shifts scroll when layout changes. */}
      <div aria-hidden="true" style={{ height: `${STATIONS.length * 100}vh`, overflowAnchor: "none" }} />
      <RideOverlay />
    </>
  );
}

/**
 * Wraps the server-rendered Express page. It stays in the HTML at all times (first paint,
 * no-JS, SEO); in ride mode it is merely `hidden`, which also gives the browser's native
 * #anchor jump nothing to land on.
 */
export function ExpressGate({ children }: { children: ReactNode }) {
  const hidden = useRide((s) => s.mode === "ride");
  return <div hidden={hidden}>{children}</div>;
}
