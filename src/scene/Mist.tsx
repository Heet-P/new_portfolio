"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { atmosphere, waterTime } from "./materials";
import { mistParticles } from "./weather";
import type { Waterfall } from "./worldgen";

/** Spray particles per waterfall. */
const PER_FALL = 56;
/** Brightness of one puff (additive): only where many overlap does it cross the bloom threshold. */
const MIST_STRENGTH = 0.2;

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixels;
  attribute vec2 aDir;
  attribute vec4 aSeed;
  varying float vAlpha;
  void main() {
    // Each puff loops: born on the plunge pool, it billows up and drifts downstream, growing
    // and fading. Speed, phase, rise and size come from the per-particle seed.
    float t = fract(uTime * (0.22 + aSeed.x * 0.28) + aSeed.y);
    vec3 p = position;
    p.xz += aDir * t * (1.5 + aSeed.w * 3.0);
    p.y += (1.0 - (1.0 - t) * (1.0 - t)) * (1.5 + aSeed.z * 3.5);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float size = mix(1.0, 3.4, t) * (0.7 + aSeed.w * 0.6);
    gl_PointSize = size * uPixels / -mv.z;
    vAlpha = smoothstep(0.0, 0.15, t) * (1.0 - smoothstep(0.45, 1.0, t));
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    // Soft round puff.
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d) * vAlpha;
    gl_FragColor = vec4(uColor, a); // additive blending scales by alpha
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const bufferSize = new THREE.Vector2();
/** Shader inputs (module-level, one mist layer per page); time is the shared water clock. */
const uniforms = { uTime: waterTime, uPixels: { value: 500 }, uColor: { value: new THREE.Color() } };

/**
 * Waterfall mist: a small burst of soft additive puffs at the foot of each fall, one Points
 * draw call for all of them. Animated on the GPU from the shared water clock (so it flows
 * with the water); colour follows the palette's foam tint.
 */
export function Mist({ falls }: { falls: Waterfall[] }) {
  const geometry = useMemo(() => {
    const m = mistParticles(falls, PER_FALL);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(m.base, 3));
    g.setAttribute("aDir", new THREE.BufferAttribute(m.dir, 2));
    g.setAttribute("aSeed", new THREE.BufferAttribute(m.seed, 4));
    return g;
  }, [falls]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms,
      }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(({ gl, camera }) => {
    // World units -> pixels at distance 1: half the drawing buffer height / tan(fov / 2).
    gl.getDrawingBufferSize(bufferSize);
    uniforms.uPixels.value = bufferSize.y * 0.5 * camera.projectionMatrix.elements[5];
    const g = atmosphere.palette.ground;
    uniforms.uColor.value.setRGB(g[0], g[1], g[2]).multiplyScalar(MIST_STRENGTH);
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
