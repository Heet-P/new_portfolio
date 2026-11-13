"use client";

import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { STATIONS } from "@/content/route";
import { atmosphere, MATS } from "../materials";
import { TRAIN_PARAMS } from "../Train";
import { travel } from "../travel";
import { buildStations } from "./build";
import { droneBobY } from "./drone";
import { END_SIGN, endSignPlacements, fasciaPlacement } from "./placement";

/**
 * Sign lettering: Geist Regular (SIL OFL, from next's bundled copy) shipped as a static file,
 * because drei's Text otherwise fetches its default font from a CDN at runtime.
 */
const SIGN_FONT = "/fonts/Geist-Regular.ttf";
const SIGN_TEXT = "#f6ecd2";
const FASCIA_TEXT = "#2a2f3a";

/**
 * Station material: flat-shaded, vertex-coloured, double-sided (thin canopies and roofs). The
 * `aGlow` vertex attribute is an emissive tint (zero on most vertices; windows, lamps, clock
 * faces and signs carry one), scaled by the material's `emissiveIntensity`, which follows the palette's
 * windowGlow: faint at golden hour, strong at night.
 */
function stationMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
    // three uploads emissive colour x emissiveIntensity as one uniform: white = pure intensity.
    emissive: "#ffffff",
  });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader =
      "attribute vec3 aGlow;\nvarying vec3 vGlow;\n" +
      sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vGlow = aGlow;");
    sh.fragmentShader =
      "varying vec3 vGlow;\n" +
      sh.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n  totalEmissiveRadiance = emissive * vGlow;",
      );
  };
  return m;
}

/** Per frame: tint by the palette's ground colour, glow by its window light (bloom needs a bigger boost than none). */
function retint(m: THREE.MeshStandardMaterial, post: boolean) {
  const p = atmosphere.palette;
  m.color.setRGB(...p.ground);
  m.emissiveIntensity = p.windowGlow * (post ? TRAIN_PARAMS.bloomGlowBoost : TRAIN_PARAMS.noBloomGlowBoost);
}

/**
 * One name, drawn only while the train is within ~1.5 stops of it (the others are far beyond
 * the fog, and each Text is a draw call).
 */
function SignText({
  index,
  position,
  rotationY,
  front,
  children,
  ...props
}: {
  index: number;
  position: [number, number, number];
  rotationY: number;
  /** How far the lettering floats in front of its board (avoids z-fighting). */
  front: number;
  children: string;
  fontSize: number;
  maxWidth: number;
  color: string;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.visible = Math.abs(index - travel.position) < 1.5;
  });
  return (
    <group ref={ref} position={position} rotation-y={rotationY}>
      <Text font={SIGN_FONT} lineHeight={1.05} textAlign="center" anchorX="center" anchorY="middle" position={[0, 0, front]} {...props}>
        {children}
      </Text>
    </group>
  );
}

/** Station index of SAHARA, where the drone hovers (drawn only while the train is near it). */
const SAHARA = STATIONS.findIndex((s) => s.id === "sahara");

/**
 * SAHARA's quadcopter: one mesh sharing the station material (so its nav lights follow the
 * palette's window glow). Bobs gently on Y; under reduced motion it hangs still. Hidden
 * while the train is more than ~1.5 stops away, which saves its draw call for most of the ride.
 */
function Drone({ geometry, material, shadows, reducedMotion }: { geometry: THREE.BufferGeometry; material: THREE.Material; shadows: boolean; reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    m.visible = Math.abs(SAHARA - travel.position) < 1.5;
    m.position.y = droneBobY(clock.elapsedTime, reducedMotion);
  });
  return <mesh ref={ref} geometry={geometry} material={material} castShadow={shadows} />;
}

/**
 * Stations along the route: a platform with coping, safety line and tactile strip at every
 * stop, a canopy on columns, a station building with door, framed windows and a pitched roof
 * (a two-storey one with a clock tower at Departure and Terminus), furniture, fences, name
 * boards at both platform ends and on the canopy fascia, and the solar field at Solar.
 * Procedural, flat-shaded like the world; one draw call per stop in view (each stop is its own
 * mesh, culled when off screen) plus the solar field and SAHARA's hovering drone.
 * The lettering (drei Text) fetches its font and suspends until it is parsed; it sits in its
 * own Suspense so that a slow or failed font load only ever costs the names, never the
 * stations themselves.
 */
export function Stations({ shadows, post, reducedMotion }: { shadows: boolean; post: boolean; reducedMotion: boolean }) {
  const geo = useMemo(() => buildStations(), []);
  const material = useMemo(() => stationMaterial(), []);
  useFrame(() => retint(material, post));
  return (
    <group>
      {/* One mesh per stop: off-screen stops are frustum-culled (and skip the shadow pass). */}
      {geo.kit.map((g, i) => (
        <mesh key={i} geometry={g} material={material} castShadow={shadows} receiveShadow={shadows} />
      ))}
      <mesh geometry={geo.panels} material={MATS.panel} castShadow={shadows} receiveShadow={shadows} />
      {geo.drone && <Drone geometry={geo.drone} material={material} shadows={shadows} reducedMotion={reducedMotion} />}
      <Suspense fallback={null}>
        <StationNames />
      </Suspense>
    </group>
  );
}

/** Every station's name boards (both platform ends + the canopy fascia). */
function StationNames() {
  const { width, height, bottom } = END_SIGN;
  return (
    <>
      {STATIONS.map((st, i) => {
        const f = fasciaPlacement(i);
        return (
          <group key={st.id}>
            {endSignPlacements(i).map((s, k) => (
              <SignText
                key={k}
                index={i}
                position={[s.position[0], s.position[1] + bottom + height / 2, s.position[2]]}
                rotationY={s.rotationY}
                front={0.1}
                fontSize={0.8}
                maxWidth={width - 0.8}
                color={SIGN_TEXT}
              >
                {st.name}
              </SignText>
            ))}
            <SignText index={i} position={f.position} rotationY={f.rotationY} front={0.06} fontSize={0.46} maxWidth={f.maxWidth} color={FASCIA_TEXT}>
              {st.name}
            </SignText>
          </group>
        );
      })}
    </>
  );
}
