"use client";

import { Component, type ReactNode } from "react";
import { useRide } from "@/ride/rideStore";

/**
 * Catches anything the 3D scene throws (WebGL context failure, model fetch or meshopt
 * decode error). Without it the error would unmount the whole React root and blank the
 * site, Express included. Instead the visitor is switched to Express, which always works,
 * and the error is logged once.
 */
export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("Night Train: 3D scene failed, switching to Express.", error);
    useRide.getState().setMode("express");
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
