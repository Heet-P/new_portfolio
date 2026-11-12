"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { STATIONS } from "@/content/route";
import { useRide } from "@/ride/rideStore";
import { Atmosphere } from "./Atmosphere";
import { CameraRig } from "./CameraRig";
import { getQuality } from "./quality";
import { updateTrainPose } from "./route3d";
import { Track } from "./Track";
import { Train } from "./Train";
import { resetTravel, stepTravel, travel } from "./travel";
import { getWorld, World } from "./World";

/**
 * Updates the shared `travel` state from the ride store once per frame, then the train's
 * pose on the track. Mounted before everything else so its useFrame runs first and every
 * reader sees this frame's values. Reads the store with getState(): no React render per
 * scroll tick.
 */
function TravelTracker() {
  useEffect(() => {
    resetTravel(useRide.getState().progress, STATIONS.length);
    updateTrainPose(travel.position);
  }, []);
  useFrame((_, dt) => {
    stepTravel(useRide.getState().progress, STATIONS.length, dt);
    updateTrainPose(travel.position);
  });
  return null;
}


/** Calls `onReady` after the first frame that includes the train has rendered. */
function FirstFrame({ onReady }: { onReady: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    onReady();
  });
  return null;
}

/**
 * The ride's 3D layer: one fixed, full-viewport Canvas behind the ride UI. Loaded lazily
 * (next/dynamic, ssr:false) only in ride mode. It stays transparent until the train's first
 * frame is drawn, then fades in over 600 ms, so the dark page shows meanwhile (no spinner).
 * Shadows (one soft directional map) only on the desktop tier; vegetation density follows
 * the quality tier's scenery layers.
 */
export default function Scene() {
  // Read the device once: quality tier and motion preference are fixed for the session.
  const [quality] = useState(() =>
    getQuality({
      width: window.innerWidth,
      dpr: window.devicePixelRatio || 1,
      coarsePointer: window.matchMedia("(pointer: coarse)").matches,
      cores: navigator.hardwareConcurrency || 4,
    }),
  );
  const [reducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [ready, setReady] = useState(false);
  const shadows = quality.post;
  const density = Math.min(1, quality.sceneryLayers / 4);

  return (
    <div
      aria-hidden="true"
      data-testid="ride-scene"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        opacity: ready ? 1 : 0,
        transition: reducedMotion ? "none" : "opacity 600ms var(--ease-out)",
      }}
    >
      <Canvas
        dpr={quality.dpr}
        shadows={shadows ? { type: THREE.PCFShadowMap } : false}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ fov: 34, near: 0.5, far: 5000 }}
      >
        <TravelTracker />
        <CameraRig reducedMotion={reducedMotion} />
        <Atmosphere shadows={shadows} />
        <World density={density} shadows={shadows} />
        <Track world={getWorld()} shadows={shadows} />
        <Suspense fallback={null}>
          <Train reducedMotion={reducedMotion} shadows={shadows} />
          <FirstFrame onReady={() => setReady(true)} />
        </Suspense>
      </Canvas>
    </div>
  );
}
