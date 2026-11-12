"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { atmosphere } from "./materials";
import { mulberry32 } from "./noise";
import { trainPose } from "./route3d";
import { travel } from "./travel";
import { rainAmount, rainSlant } from "./weather";

/** Look-and-feel knobs for the rain: lo-fi drizzle, not a storm. */
export const RAIN = {
  /** Size (x, y, z units) of the box of drops kept around the camera. */
  box: [72, 44, 72] as const,
  /** The box sits this far ahead of the camera, so it fills the view down to the train. */
  ahead: 24,
  /** Fall speed along the streak (units/s). */
  speed: 26,
  /** Streak length and half-width (units). */
  length: 1.2,
  width: 0.03,
  /** Peak opacity of a streak at full rain. */
  opacity: 0.26,
  /** Fraction of the camera's own motion the drops "stay behind": a sense of passing through. */
  parallax: 0.35,
  /** Pale blue-grey (linear RGB). */
  color: [0.62, 0.7, 0.86] as const,
};

const vertexShader = /* glsl */ `
  uniform vec3 uCenter;
  uniform vec3 uBox;
  uniform vec3 uShift;
  uniform vec3 uDir;
  uniform float uLength;
  uniform float uWidth;
  attribute vec3 aOffset;
  attribute float aRand;
  varying float vAlong;
  varying float vSide;
  varying float vFade;
  void main() {
    // Wrap each drop into the box around uCenter: drops leaving one face re-enter the opposite one.
    vec3 local = mod(aOffset * uBox - uShift, uBox) - 0.5 * uBox;
    vec3 head = uCenter + local;
    // Streak: from the head back along the fall direction; a camera-facing ribbon across it.
    float len = uLength * (0.7 + 0.6 * aRand);
    vec3 p = head - uDir * position.y * len;
    vec3 side = cross(uDir, cameraPosition - head);
    float sl = length(side);
    // Guard the degenerate case (drop straight along the view ray): never emit NaN.
    side = sl > 1e-5 ? side / sl : vec3(1.0, 0.0, 0.0);
    p += side * position.x * uWidth;
    vAlong = position.y;
    vSide = position.x;
    // Fade out towards the box faces so wrapping drops never pop in.
    vec3 e = abs(local) / uBox;
    vFade = 1.0 - smoothstep(0.34, 0.5, max(e.x, max(e.y, e.z)));
    // Drops right in front of the lens would be huge, bright smears: fade them out.
    vFade *= smoothstep(9.0, 20.0, distance(head, cameraPosition));
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlong;
  varying float vSide;
  varying float vFade;
  void main() {
    // Bright head, fading tail, soft edges across.
    float a = uOpacity * vFade * (1.0 - vAlong) * (1.0 - vSide * vSide);
    gl_FragColor = vec4(uColor, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Unit streak: x = -1..1 across, y = 0 (head) .. 1 (tail). Indexed quad. */
function streakGeometry(count: number): THREE.InstancedBufferGeometry {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0], 3));
  g.setIndex([0, 2, 1, 1, 2, 3]);
  const rand = mulberry32(21);
  const offset = new Float32Array(count * 3);
  const r = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    offset[i * 3] = rand();
    offset[i * 3 + 1] = rand();
    offset[i * 3 + 2] = rand();
    r[i] = rand();
  }
  g.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offset, 3));
  g.setAttribute("aRand", new THREE.InstancedBufferAttribute(r, 1));
  g.instanceCount = count;
  return g;
}

/**
 * Shader inputs, module-level like the sky's (one rain layer per page): rewritten each
 * frame by <Rain/>, shared by whichever material instance is mounted.
 */
const uniforms = {
  uCenter: { value: new THREE.Vector3() },
  uBox: { value: new THREE.Vector3(...RAIN.box) },
  uShift: { value: new THREE.Vector3() },
  uDir: { value: new THREE.Vector3(0, -1, 0) },
  uLength: { value: RAIN.length },
  uWidth: { value: RAIN.width },
  uColor: { value: new THREE.Color().setRGB(...RAIN.color) },
  uOpacity: { value: 0 },
};

const fwd = new THREE.Vector3();
const lastCam = new THREE.Vector3();
const step = new THREE.Vector3();

/** Wrap a box-sized offset back into 0..size (keeps the float small over a long session). */
const wrap = (v: number, size: number) => ((v % size) + size) % size;

/**
 * Light night rain: `count` instanced streaks (one draw call) in a box that follows the
 * camera and wraps. Fades in only over the night stretch (rainAmount from the palette's
 * window glow); leans back harder as the train speeds up (rainSlant from travel.speed).
 * All motion is in the shader; per frame only a few uniforms change (no allocations).
 * Reduced motion: the drops are drawn but hang still.
 */
export function Rain({ count, reducedMotion }: { count: number; reducedMotion: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const first = useRef(true);
  const geometry = useMemo(() => streakGeometry(count), [count]);
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

  useFrame(({ camera }, dt) => {
    const m = mesh.current;
    if (!m) return;
    const amount = rainAmount(atmosphere.palette.windowGlow);
    m.visible = amount > 0.001;
    if (!m.visible) {
      first.current = true;
      return;
    }
    const u = uniforms;
    u.uOpacity.value = RAIN.opacity * amount;
    camera.getWorldDirection(fwd);
    u.uCenter.value.copy(camera.position).addScaledVector(fwd, RAIN.ahead);

    // Fall direction: down, blown back along the track by the head-wind (opposite to travel).
    const lean = rainSlant(travel.speed) * (travel.velocity < 0 ? -1 : 1);
    const dir = u.uDir.value;
    dir.set(-trainPose.tan.x * lean, -1, -trainPose.tan.z * lean).normalize();
    if (reducedMotion) return;

    // Drops move along dir; part of the camera's own motion is subtracted so the camera
    // passes through them a little. A big jump (deep link, first frame) is not motion.
    const shift = u.uShift.value;
    shift.addScaledVector(dir, -RAIN.speed * Math.min(dt, 0.1));
    step.subVectors(camera.position, lastCam);
    if (!first.current && step.lengthSq() < 50 * 50) shift.addScaledVector(step, RAIN.parallax);
    lastCam.copy(camera.position);
    first.current = false;
    shift.set(wrap(shift.x, RAIN.box[0]), wrap(shift.y, RAIN.box[1]), wrap(shift.z, RAIN.box[2]));
  });

  return <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} visible={false} />;
}
