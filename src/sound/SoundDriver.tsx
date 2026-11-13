"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { cabinFrame } from "@/ride/cabinStore";
import { STOP_PHASE } from "@/ride/stopCamera";
import { atmosphere } from "@/scene/materials";
import { ROUTE, trainU } from "@/scene/route3d";
import { travel } from "@/scene/travel";
import { TUNNEL_VIEW, tunnelBlend } from "@/scene/tunnelCamera";
import { rainAmount } from "@/scene/weather";
import { getWorld } from "@/scene/World";
import { createArrivalDetector, createRisingEdge } from "./cues";
import { getSound } from "./sound";

/**
 * Feeds the scene to the sound engine once per frame, inside the ride's Canvas: train speed
 * (rumble, clacks), the same rain amount the visuals use (dry by day), how far the camera is
 * inside a tunnel, and two one-off cues: the station chime when the train comes to rest at
 * a stop, and the paper rustle as the cabin's newspaper starts to unfold.
 *
 * Plain reads of the scene's mutable state and number arguments: no allocation and no React
 * render per frame. The engine ignores changes too small to hear, and does nothing at all
 * while sound is off (cues) or before it was ever on (just stores the values).
 */
export function SoundDriver() {
  // Fresh edge detectors per ride mount: re-entering the ride parked at a stop is not an arrival.
  const [cues] = useState(() => ({
    arrived: createArrivalDetector(),
    // Re-arms once the blend is back below the window swap, i.e. after leaving the cabin.
    unfolding: createRisingEdge(STOP_PHASE.unfoldFrom, STOP_PHASE.swapIn),
  }));

  // Leaving the ride (Express): no train, no rain, no tunnel; the music plays on.
  useEffect(
    () => () => {
      const sound = getSound();
      sound.setTravelSpeed(0);
      sound.setRain(0);
      sound.setTunnel(0);
    },
    [],
  );

  useFrame(() => {
    const sound = getSound();
    sound.setTravelSpeed(travel.speed);
    sound.setRain(rainAmount(atmosphere.palette.windowGlow));
    // Where the listener is: the chase camera, which rides TUNNEL_VIEW.chase behind the train (as tunnelPace.ts).
    sound.setTunnel(tunnelBlend(trainU(travel.position) * ROUTE.length - TUNNEL_VIEW.chase, getWorld().tunnels));
    if (cues.arrived(travel.position, travel.speed)) sound.chime();
    if (cues.unfolding(cabinFrame.blend)) sound.rustle();
  });

  return null;
}
