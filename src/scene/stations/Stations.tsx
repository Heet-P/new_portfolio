"use client";

import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { STATIONS } from "@/content/route";
import { atmosphere, MATS } from "../materials";
import { TRAIN_PARAMS } from "../Train";
import { travel } from "../travel";
import { buildStations } from "./build";
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

/**
 * Stations along the route: a platform with coping, safety line and tactile strip at every
 * stop, a canopy on columns, a station building with door, framed windows and a pitched roof
 * (a two-storey one with a clock tower at Departure and Terminus), furniture, fences, name
 * boards at both platform ends and on the canopy fascia, and the solar field at Solar.
 * Procedural, flat-shaded like the world; two draw calls for all geometry.
 */
export function Stations({ shadows, post }: { shadows: boolean; post: boolean }) {
  const geo = useMemo(() => buildStations(), []);
  const material = useMemo(() => stationMaterial(), []);
  useFrame(() => retint(material, post));
  const { width, height, bottom } = END_SIGN;
  return (
    <group>
      <mesh geometry={geo.kit} material={material} castShadow={shadows} receiveShadow={shadows} />
      <mesh geometry={geo.panels} material={MATS.panel} castShadow={shadows} receiveShadow={shadows} />
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
    </group>
  );
}
