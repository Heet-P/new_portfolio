"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { hash2, mulberry32 } from "./noise";
import { blendPalette } from "./palette";
import { atmosphere, MATS, tintWorld } from "./materials";
import { trainPose } from "./route3d";
import { travel } from "./travel";

/**
 * Horizontal direction the sun/moon sits in (x, z), seen from the scene: low in the
 * direction the follow camera looks (back along the track), a little toward the camera
 * side. Golden hour backlight with long shadows reaching toward the viewer, like the
 * reference, and the sun's glow in frame; camera-facing slopes still catch some light.
 */
const SUN_AZIMUTH = new THREE.Vector2(-1, 0.3).normalize();
/** Half-size (units) of the sun's shadow box around the train. */
const SHADOW_BOX = 70;

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // pinned to the far plane: always behind everything
  }
`;

const skyFragment = /* glsl */ `
  uniform vec3 top;
  uniform vec3 horizon;
  uniform vec3 sunColor;
  uniform vec3 sunDir;
  uniform float stars;
  varying vec3 vDir;
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    // Gradient: horizon colour hugs the ground, the top colour takes over quickly above it.
    vec3 col = mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.55));
    if (h < 0.0) col = horizon * 0.9;
    // Glow around the sun (wide warm halo + tighter bloom), fading as night falls.
    float g = max(dot(d, sunDir), 0.0);
    col += sunColor * (pow(g, 5.0) * 0.28 + pow(g, 48.0) * 0.5) * (1.0 - stars * 0.75);
    // The disc itself: the sun, later the moon.
    col += sunColor * smoothstep(0.99935, 0.9997, g) * 2.5;
    // Stars: sparse hashed cells, only above the horizon haze.
    vec3 cell = floor(d * 420.0);
    float s = hash(cell);
    col += vec3(step(0.9972, s) * stars * smoothstep(0.03, 0.3, h) * (0.4 + 0.6 * hash(cell + 7.0)));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Far snow-capped ranges on a ring around the camera, plus a few faceted clouds. */
function backdropGeometry() {
  const rand = mulberry32(5);
  const mountains: THREE.BufferGeometry[] = [];
  const rock = new THREE.Color("#8b8a86");
  const rockBlue = new THREE.Color("#7c8496");
  const snow = new THREE.Color("#f4f5f6");
  const c = new THREE.Color();
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2 + rand() * 0.15;
    const r = 1300 + rand() * 250;
    const height = 240 + rand() * 260;
    const g = new THREE.ConeGeometry(180 + rand() * 160, height, 7, 3).toNonIndexed();
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      // Jitter by hashed corner position: shared corners move together, so no cracks.
      const j = hash2(Math.round(x), Math.round(y * 3 + z), k);
      const keepTip = y > height / 2 - 1 ? 0 : 1;
      pos.setXYZ(i, x * (0.8 + j * 0.4), y + (j - 0.5) * 30 * keepTip, z * (0.8 + hash2(Math.round(z), Math.round(y), k) * 0.4));
    }
    for (let i = 0; i < pos.count; i += 3) {
      const yAvg = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3 + height / 2;
      const f = yAvg / height;
      if (f > 0.62 + hash2(k, i, 2) * 0.1) c.copy(snow);
      else c.copy(rock).lerp(rockBlue, hash2(k, i, 3));
      for (let v = 0; v < 3; v++) c.toArray(colors, (i + v) * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.deleteAttribute("uv");
    g.translate(Math.cos(a) * r, height / 2 - 60, Math.sin(a) * r);
    mountains.push(g);
  }
  const clouds: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 11; k++) {
    const a = rand() * Math.PI * 2;
    const r = 900 + rand() * 300;
    const y = 300 + rand() * 160;
    for (let p = 0; p < 6; p++) {
      const g = new THREE.IcosahedronGeometry(25 + rand() * 40, 0);
      g.scale(1.6, 0.45, 1);
      g.rotateY(a + Math.PI / 2);
      const off = (p - 2.5) * 38;
      g.translate(Math.cos(a) * r - Math.sin(a) * off, y + rand() * 25, Math.sin(a) * r + Math.cos(a) * off);
      g.deleteAttribute("uv");
      clouds.push(g);
    }
  }
  const m = mergeGeometries(mountains);
  m.computeVertexNormals();
  const cl = mergeGeometries(clouds);
  cl.computeVertexNormals();
  return { mountains: m, clouds: cl };
}

const sunDir = new THREE.Vector3();
/** Sky dome shader inputs, rewritten every frame from the palette (one sky per page). */
const uniforms = {
  top: { value: new THREE.Color() },
  horizon: { value: new THREE.Color() },
  sunColor: { value: new THREE.Color() },
  sunDir: { value: new THREE.Vector3(0, 0.2, -1) },
  stars: { value: 0 },
};

/**
 * Time of day for the whole scene, driven by travel.position: blends the station palettes,
 * then updates the sky dome, fog, sun/moon light (+ its shadow box following the train),
 * hemisphere fill and every world material's tint. Mount before the train so its window
 * glow reads this frame's palette.
 */
export function Atmosphere({ shadows }: { shadows: boolean }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const fog = useRef<THREE.FogExp2>(null);
  const backdrop = useRef<THREE.Group>(null);
  const sky = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => backdropGeometry(), []);

  useFrame(({ camera }) => {
    const p = travel.position;
    const index = Math.floor(p);
    const pal = blendPalette(atmosphere.palette, index, p - index);
    tintWorld(pal);

    const el = (pal.sunElevation * Math.PI) / 180;
    sunDir.set(SUN_AZIMUTH.x * Math.cos(el), Math.sin(el), SUN_AZIMUTH.y * Math.cos(el));
    uniforms.top.value.setRGB(...pal.skyTop);
    uniforms.horizon.value.setRGB(...pal.skyHorizon);
    uniforms.sunColor.value.setRGB(...pal.sun);
    uniforms.sunDir.value.copy(sunDir);
    uniforms.stars.value = pal.stars;

    if (fog.current) {
      fog.current.color.setRGB(...pal.fog);
      fog.current.density = pal.fogDensity;
    }
    if (hemi.current) {
      hemi.current.color.setRGB(...pal.ambient);
      // Warm, darker bounce light from the ground.
      hemi.current.groundColor.setRGB(pal.ambient[0] * 0.5, pal.ambient[1] * 0.42, pal.ambient[2] * 0.32);
    }
    const light = sun.current;
    if (light) {
      light.color.setRGB(...pal.sun);
      light.intensity = pal.sunIntensity;
      // Keep the light (and its shadow box) centred on the train.
      light.target.position.copy(trainPose.pos);
      light.position.copy(trainPose.pos).addScaledVector(sunDir, 250);
      light.target.updateMatrixWorld();
    }
    // Sky dome and far ranges ride with the camera: always at "infinity".
    sky.current?.position.copy(camera.position);
    backdrop.current?.position.set(camera.position.x, 0, camera.position.z);
  });

  return (
    <>
      <fogExp2 ref={fog} attach="fog" args={["#e9cfa6", 0.0016]} />
      <hemisphereLight ref={hemi} intensity={1.9} />
      <directionalLight
        ref={sun}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-SHADOW_BOX}
        shadow-camera-right={SHADOW_BOX}
        shadow-camera-top={SHADOW_BOX}
        shadow-camera-bottom={-SHADOW_BOX}
        shadow-camera-near={50}
        shadow-camera-far={500}
        shadow-bias={-0.0004}
        shadow-normalBias={0.35}
        shadow-radius={5}
      />
      <mesh ref={sky} renderOrder={-1} frustumCulled={false} scale={3000}>
        <sphereGeometry args={[1, 32, 16]} />
        <shaderMaterial
          side={THREE.BackSide}
          depthWrite={false}
          fog={false}
          uniforms={uniforms}
          vertexShader={skyVertex}
          fragmentShader={skyFragment}
        />
      </mesh>
      <group ref={backdrop}>
        <mesh geometry={geo.mountains} material={MATS.mountain} frustumCulled={false} />
        <mesh geometry={geo.clouds} material={MATS.cloud} frustumCulled={false} />
      </group>
    </>
  );
}
