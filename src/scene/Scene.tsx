"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import { STATIONS } from "@/content/route";
import { useRide } from "@/ride/rideStore";
import { getQuality } from "./quality";
import { Track } from "./Track";
import { TRAIN_PARAMS, Train } from "./Train";
import { resetTravel, stepTravel } from "./travel";

/** Model's half length: the locomotive's nose is at x = +HALF_TRAIN (see compress-model.mjs). */
const HALF_TRAIN = 14.85;
const DEG = Math.PI / 180;

/**
 * Updates the shared `travel` state from the ride store once per frame. Mounted before
 * everything else so its useFrame runs first and every reader sees this frame's values.
 * Reads the store with getState(): no React render per scroll tick.
 */
function TravelTracker() {
  useEffect(() => resetTravel(useRide.getState().progress, STATIONS.length), []);
  useFrame((_, dt) => stepTravel(useRide.getState().progress, STATIONS.length, dt));
  return null;
}

/**
 * Side-on camera, slightly elevated. Wide screens frame the whole train with margin; narrow
 * screens frame the locomotive and first wagon (the rest runs off-screen) so the train is
 * never tiny. In between, both the frame width and the look-at point blend smoothly.
 * Recomputed every frame from the canvas size (a few multiplications, no allocations),
 * so resizes and rotations need no extra handling.
 */
function CameraRig({ reducedMotion }: { reducedMotion: boolean }) {
  const cam = TRAIN_PARAMS.camera;
  useFrame(({ camera, size, clock }) => {
    const aspect = size.width / Math.max(1, size.height);
    const k = Math.min(1, Math.max(0, (aspect - cam.narrowAspect) / (cam.wideAspect - cam.narrowAspect)));
    const frameWidth = cam.narrowFrameWidth + (cam.wideFrameWidth - cam.narrowFrameWidth) * k;
    // Narrow: centre on the front of the train with a little air ahead of the nose.
    const frontX = HALF_TRAIN * TRAIN_PARAMS.scale + 1.5 - cam.narrowFrameWidth / 2;
    let lookX = frontX * (1 - k);

    // Desktop: keep the train clear of the route-map panel by framing it in the screen area
    // right of the panel. Same breakpoint as the panel's CSS (phones get a bottom strip).
    const inset = size.width > 640 && size.height > 600 ? cam.wideLeftInsetPx * k : 0;
    const worldPerPx = frameWidth / Math.max(1, size.width - inset);
    lookX -= (inset / 2) * worldPerPx;

    // Distance at which the full screen width (train area + inset) fills the horizontal FOV.
    const halfH = Math.tan((cam.fov * DEG) / 2) * aspect;
    const dist = (worldPerPx * size.width) / 2 / halfH;

    // Slow Lissajous drift: barely-there handheld feel. Off for reduced motion.
    const t = (clock.elapsedTime / cam.driftPeriod) * Math.PI * 2;
    const dx = reducedMotion ? 0 : Math.sin(t) * cam.driftAmount;
    const dy = reducedMotion ? 0 : Math.sin(t * 0.7 + 1) * cam.driftAmount * 0.5;

    const pitch = cam.pitchDeg * DEG;
    camera.position.set(lookX + dx, cam.lookHeight + Math.sin(pitch) * dist + dy, Math.cos(pitch) * dist);
    camera.lookAt(lookX + dx * 0.5, cam.lookHeight, 0);
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

  return (
    <div
      aria-hidden="true"
      data-testid="ride-scene"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        // Placeholder night sky (deep indigo -> near black). T8 swaps in the palette-driven sky.
        background: "linear-gradient(to bottom, #1b2148 0%, #10142b 45%, #06080f 100%)",
        opacity: ready ? 1 : 0,
        transition: reducedMotion ? "none" : "opacity 600ms var(--ease-out)",
      }}
    >
      <Canvas
        dpr={quality.dpr}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ fov: TRAIN_PARAMS.camera.fov, near: 0.5, far: 600 }}
      >
        <TravelTracker />
        <CameraRig reducedMotion={reducedMotion} />
        {/* Distance haze in the sky's horizon tone: the ground melts into the sky instead of ending on a hard line. */}
        <fog attach="fog" args={["#161b3a", 45, 140]} />
        {/* Stylised moonlight: cool key from upper left, soft indigo sky fill, dark ground bounce. */}
        <hemisphereLight args={["#5a6aae", "#0b0f1c", 0.9]} />
        <directionalLight color="#b4c3ff" intensity={1.6} position={[-20, 30, 25]} />
        <Suspense fallback={null}>
          <Train reducedMotion={reducedMotion} />
          <Track />
          <FirstFrame onReady={() => setReady(true)} />
        </Suspense>
      </Canvas>
    </div>
  );
}
