"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { atmosphere } from "./materials";
import { ROUTE, tangentAt, trainPose } from "./route3d";
import { nightAmount } from "./weather";

/**
 * The train's extent along the track at rest, in units from its centre (+ = forward).
 * Measured from the model by Train's rigTrain; read here to put the headlamp on the nose.
 * Defaults are the measured values, so the lights sit right even before the model loads.
 */
export const TRAIN_SHAPE = { nose: 15, tail: -15 };

/** Look-and-feel knobs for the train's own lights (all scaled by how dark it is). */
export const LIGHTS = {
  headlamp: {
    color: "#ffe4b8",
    /** Candela-ish; decay 1 so the beam carries down the line. */
    intensity: 70,
    distance: 90,
    decay: 1,
    angle: 0.36,
    penumbra: 0.7,
    /** Lamp height above the rails and how far ahead (along the track) it is aimed. */
    height: 1.7,
    aim: 34,
    /** Visible beam: length (units) and peak opacity of the faint additive cone. */
    beamLength: 30,
    beamOpacity: 0.16,
  },
  spill: {
    color: "#ffae5e",
    /** Multiplied by the palette's windowGlow (0.12 golden hour .. 2.5 night). */
    intensity: 16,
    distance: 15,
    decay: 2,
    /** Inside the body, a little toward the camera side: the warm pool shows beside the train. */
    height: 1.3,
    side: 0.8,
  },
} as const;

const beamVertex = /* glsl */ `
  varying float vAlong;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vAlong = -position.y; // 0 at the lamp, 1 at the far end
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const beamFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlong;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    // Bright at the lamp, gone by the far end; faces seen edge-on fade, so the cone has no hard rim.
    float rim = smoothstep(0.0, 0.7, abs(dot(normalize(vN), normalize(vV))));
    // max(): interpolation can overshoot 1 a hair, and pow() of a negative is NaN, which
    // bloom's blur would smear into a black block.
    // Plus a hot core right at the lamp: it crosses the bloom threshold, so the lamp itself
    // glows past the nose even though the chase camera only ever sees the train's back.
    float f = max(1.0 - vAlong, 0.0);
    float a = uOpacity * (pow(f, 1.8) + 5.0 * pow(f, 40.0)) * rim;
    gl_FragColor = vec4(uColor, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Beam shader inputs (module-level: one train per page). */
const beamUniforms = { uColor: { value: new THREE.Color(LIGHTS.headlamp.color) }, uOpacity: { value: 0 } };

const p = new THREE.Vector3();
const t = new THREE.Vector3();
const aim = new THREE.Vector3();
const dir = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);

/** Curve point and tangent at `offset` units from the train's centre (clamped to the route). */
function along(offset: number) {
  const u = Math.max(0, Math.min(1, trainPose.u + offset / ROUTE.length));
  ROUTE.curve.getPointAt(u, p);
  tangentAt(u, t);
}

/**
 * Night lighting carried by the train: a headlamp (SpotLight on the nose, aimed down the
 * track, plus a faint visible beam) and `spill` warm PointLights inside the cars that
 * throw window light onto the ground and rails beside the train. All of it scales with
 * the palette's darkness, so it is invisible at golden hour and grows through dusk.
 * The lights stay mounted (intensity 0 by day) so shaders never recompile mid-ride.
 */
export function TrainLights({ spill }: { spill: number }) {
  const head = useRef<THREE.SpotLight>(null);
  const beam = useRef<THREE.Mesh>(null);
  const spills = useRef<(THREE.PointLight | null)[]>([]);
  const target = useMemo(() => new THREE.Object3D(), []);
  const beamGeo = useMemo(() => new THREE.ConeGeometry(1, 1, 20, 1, true).translate(0, -0.5, 0), []);
  const beamMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: beamVertex,
        fragmentShader: beamFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: beamUniforms,
      }),
    [],
  );
  useEffect(
    () => () => {
      beamGeo.dispose();
      beamMat.dispose();
    },
    [beamGeo, beamMat],
  );

  useFrame(() => {
    const glow = atmosphere.palette.windowGlow;
    const night = nightAmount(glow);
    const H = LIGHTS.headlamp;

    // Headlamp on the nose, aimed at the rails `aim` units further down the line.
    along(TRAIN_SHAPE.nose + H.aim);
    aim.copy(p);
    along(TRAIN_SHAPE.nose);
    p.y += H.height;
    p.addScaledVector(t, 0.3);
    const lamp = head.current;
    if (lamp) {
      lamp.intensity = H.intensity * night;
      lamp.position.copy(p);
      target.position.copy(aim);
      target.updateMatrixWorld();
    }
    const b = beam.current;
    if (b) {
      b.visible = night > 0.01;
      beamUniforms.uOpacity.value = H.beamOpacity * night;
      dir.subVectors(aim, p).normalize();
      b.position.copy(p);
      b.quaternion.setFromUnitVectors(DOWN, dir);
      const r = Math.tan(H.angle) * H.beamLength * 0.85;
      b.scale.set(r, H.beamLength, r);
    }

    // Window spill: lights spread evenly along the train, nudged toward the camera side.
    const n = spill;
    for (let k = 0; k < n; k++) {
      const light = spills.current[k];
      if (!light) continue;
      along(TRAIN_SHAPE.tail + ((k + 0.5) / n) * (TRAIN_SHAPE.nose - TRAIN_SHAPE.tail));
      // Right of travel = tangent x up = (-tz, 0, tx).
      light.position.set(p.x - t.z * LIGHTS.spill.side, p.y + LIGHTS.spill.height, p.z + t.x * LIGHTS.spill.side);
      light.intensity = LIGHTS.spill.intensity * glow * night;
    }
  });

  return (
    <>
      <primitive object={target} />
      <spotLight
        ref={head}
        target={target}
        color={LIGHTS.headlamp.color}
        distance={LIGHTS.headlamp.distance}
        decay={LIGHTS.headlamp.decay}
        angle={LIGHTS.headlamp.angle}
        penumbra={LIGHTS.headlamp.penumbra}
        intensity={0}
      />
      <mesh ref={beam} geometry={beamGeo} material={beamMat} frustumCulled={false} visible={false} />
      {Array.from({ length: spill }, (_, k) => (
        <pointLight
          key={k}
          ref={(l) => {
            spills.current[k] = l;
          }}
          color={LIGHTS.spill.color}
          distance={LIGHTS.spill.distance}
          decay={LIGHTS.spill.decay}
          intensity={0}
        />
      ))}
    </>
  );
}
