"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { STATIONS } from "@/content/route";
import { cabinFrame, resetCabin, stepCabin } from "@/ride/cabinStore";
import { useRide } from "@/ride/rideStore";
import { Atmosphere } from "./Atmosphere";
import { Cabin } from "./cabin/Cabin";
import { CameraRig } from "./CameraRig";
import { Catenary } from "./Catenary";
import { getQuality } from "./quality";
import { Rain } from "./Rain";
import { updateTrainPose } from "./route3d";
import { Stations } from "./stations/Stations";
import { Track } from "./Track";
import { Train } from "./Train";
import { resetTravel, stepTravel, travel } from "./travel";
import { TunnelPanels } from "./TunnelPanels";
import { tunnelPaceCap } from "./tunnelPace";
import { getWorld, World } from "./World";

/** Bloom + tone mapping + vignette: its own chunk, fetched only on the desktop tier. */
const Effects = lazy(() => import("./Effects"));

/** Slow through the tunnels so the skills reel can be read. */
const paceCap = (position: number) => tunnelPaceCap(position, getWorld().tunnels);

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
    stepTravel(useRide.getState().progress, STATIONS.length, dt, paceCap);
    updateTrainPose(travel.position);
  });
  return null;
}

/**
 * Advances the "into the cabin" blend from the train's position and speed (cabinStore), right
 * after TravelTracker and before the camera reads it. Resets it when the scene goes away.
 */
function CabinDriver() {
  useEffect(() => resetCabin, []);
  useFrame((_, dt) => stepCabin(travel.position, travel.speed, dt));
  return null;
}

/**
 * Everything outside the train's cabin. While the camera is inside the cabin (staged far away,
 * see cabin/layout.ts) none of it can be seen, so it stops drawing (and casting shadows).
 * The train's own lights are not in here: hiding a light would recompile every material.
 */
function Outside({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.visible = !cabinFrame.inside || cabinFrame.warm > 0;
  });
  return <group ref={ref}>{children}</group>;
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
 * Shadows (one soft directional map) and bloom/vignette only on the desktop tier; vegetation
 * density and rain drop count follow the quality tier.
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
  // Phone tier (fewer scenery layers): coarser terrain grid, ~2.3x fewer triangles to build and draw.
  const terrainStep = quality.sceneryLayers >= 4 ? 6 : 9;

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
        <CabinDriver />
        <CameraRig reducedMotion={reducedMotion} />
        <Atmosphere shadows={shadows} reducedMotion={reducedMotion} />
        <Outside>
          <World density={density} step={terrainStep} shadows={shadows} />
          <Track world={getWorld()} shadows={shadows} />
          <Catenary world={getWorld()} shadows={shadows} />
          {/* The stations' lettering has its own Suspense inside, so it never holds up the meshes. */}
          <Stations shadows={shadows} post={quality.post} reducedMotion={reducedMotion} />
          <TunnelPanels tunnels={getWorld().tunnels} reducedMotion={reducedMotion} />
          <Rain count={quality.rainDrops} reducedMotion={reducedMotion} />
        </Outside>
        {/* The cabin loads with the train, so a deep link opens already in front of the paper. */}
        <Suspense fallback={null}>
          <Train reducedMotion={reducedMotion} shadows={shadows} post={quality.post} />
          <Cabin post={quality.post} reducedMotion={reducedMotion} />
          <FirstFrame onReady={() => setReady(true)} />
        </Suspense>
        {quality.post && (
          <Suspense fallback={null}>
            <Effects />
          </Suspense>
        )}
      </Canvas>
    </div>
  );
}
