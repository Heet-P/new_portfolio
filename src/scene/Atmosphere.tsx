"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CAMERA } from "./CameraRig";
import { hash2, mulberry32, smoothstep } from "./noise";
import { Clouds } from "./Clouds";
import { blendPalette } from "./palette";
import { atmosphere, MATS, tintWorld, waterTime } from "./materials";
import { trainPose } from "./route3d";
import { travel } from "./travel";

/**
 * Horizontal direction the sun sits in (x, z), seen from the scene: low ahead of the
 * train (where the chase camera looks), a little to the left of the line: golden-hour
 * backlight with long shadows reaching toward the viewer, like the reference, and the
 * sun's glow in frame.
 */
const SUN_AZIMUTH = new THREE.Vector2(1, -0.4).normalize();
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
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    // Gradient: horizon colour hugs the ground, the top colour takes over quickly above it.
    vec3 col = mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.55));
    if (h < 0.0) col = horizon * 0.9;
    // Glow around the sun (wide warm halo + tighter bloom), fading as night falls.
    float g = max(dot(d, sunDir), 0.0);
    col += sunColor * (pow(g, 5.0) * 0.28 + pow(g, 48.0) * 0.5) * (1.0 - stars * 0.75);
    // The sun's disc; at night the faceted moon mesh takes over, so the disc fades out.
    col += sunColor * smoothstep(0.99935, 0.9997, g) * 2.5 * (1.0 - stars);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Far snow-capped ranges on a ring around the camera (the clouds are their own layer: Clouds.tsx). */
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
    const height = 170 + rand() * 170;
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
  const m = mergeGeometries(mountains);
  m.computeVertexNormals();
  return { mountains: m };
}

/** Star field: random directions on the upper sky, drawn as screen-sized points. */
function starGeometry(): THREE.BufferGeometry {
  const rand = mulberry32(9);
  const n = 1400;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    // Uniform on the sphere, folded to the upper hemisphere and kept clear of the horizon haze.
    const y = 0.04 + rand() * 0.96;
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(a) * r * STAR_R, y * STAR_R, Math.sin(a) * r * STAR_R], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return g;
}

/** Distance of the stars from the camera (inside the far plane, beyond everything). */
const STAR_R = 2600;
/**
 * Moon placement. It is pinned to a spot on screen (normalised device coords), so every
 * night framing shows it, however low the chase camera looks: upper right on wide screens
 * (clear of the route-map panel), higher and central on portrait phones (above the peaks,
 * left of the Express button). Blended by aspect like CameraRig's framings. It hangs in
 * front of the far ranges (ring at 1300+) and among the clouds, so a far peak never hides
 * it but near hills and trees still do.
 */
export const MOON = {
  wide: { x: 0.3, y: 0.78 },
  narrow: { x: -0.1, y: 0.88 },
  distance: 1080,
  radius: 30,
} as const;

const sunDir = new THREE.Vector3();
const dayDir = new THREE.Vector3();
const moonPos = new THREE.Vector3();
const nightDir = new THREE.Vector3();
/** Moonlight direction relative to the camera's heading (radians): behind and to the right. */
const MOONLIGHT_YAW = 2.4;
const fwd = new THREE.Vector3();
// HDR white (2x): bright enough to cross the bloom threshold as tiny halos on desktop.
const starMat = new THREE.PointsMaterial({
  color: new THREE.Color(2, 2, 2),
  size: 2,
  sizeAttenuation: false,
  transparent: true,
  depthWrite: false,
  fog: false,
});
// Faceted, self-lit moon; opacity follows the palette's star visibility.
const moonMat = new THREE.MeshStandardMaterial({
  color: "#1a1d2a",
  emissive: "#e6ebff",
  flatShading: true,
  transparent: true,
  depthWrite: false,
  fog: false,
});
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
 * hemisphere fill and every world material's tint, plus the drifting cloud layer. Mount
 * before the train (and rain) so they read this frame's palette.
 */
export function Atmosphere({ shadows, reducedMotion }: { shadows: boolean; reducedMotion: boolean }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const fog = useRef<THREE.FogExp2>(null);
  const backdrop = useRef<THREE.Group>(null);
  const sky = useRef<THREE.Mesh>(null);
  const stars = useRef<THREE.Points>(null);
  const moon = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => ({ ...backdropGeometry(), stars: starGeometry() }), []);

  useFrame(({ camera, clock, size }) => {
    waterTime.value = clock.elapsedTime;
    const p = travel.position;
    const index = Math.floor(p);
    const pal = blendPalette(atmosphere.palette, index, p - index);
    tintWorld(pal);

    const el = (pal.sunElevation * Math.PI) / 180;
    dayDir.set(SUN_AZIMUTH.x * Math.cos(el), Math.sin(el), SUN_AZIMUTH.y * Math.cos(el));
    // The moon hangs at a fixed spot of the view (MOON), so every night framing has it.
    // CameraRig moved the camera this frame; refresh its matrix before unprojecting.
    camera.getWorldDirection(fwd);
    camera.updateMatrixWorld();
    const wide = smoothstep(CAMERA.narrowAspect, CAMERA.wideAspect, size.width / Math.max(1, size.height));
    moonPos
      .set(MOON.narrow.x + (MOON.wide.x - MOON.narrow.x) * wide, MOON.narrow.y + (MOON.wide.y - MOON.narrow.y) * wide, 0.5)
      .unproject(camera)
      .sub(camera.position)
      .normalize();
    // Moonlight is cheated to come from behind the camera's right shoulder (a moon in front
    // would leave every camera-facing surface black): high, so shadows stay short.
    const back = Math.atan2(fwd.z, fwd.x) + MOONLIGHT_YAW;
    nightDir.set(Math.cos(back) * 0.6, 0.8, Math.sin(back) * 0.6);
    sunDir.lerpVectors(dayDir, nightDir, pal.stars).normalize();
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
    starMat.opacity = pal.stars;
    moonMat.opacity = pal.stars;
    // Bright enough at full night to cross the bloom threshold (a soft halo on desktop).
    moonMat.emissiveIntensity = 0.6 + pal.stars * 1.7;
    moon.current?.position.copy(camera.position).addScaledVector(moonPos, MOON.distance);
    if (moon.current) moon.current.visible = pal.stars > 0.02;
    if (stars.current) stars.current.visible = pal.stars > 0.02;
    // Sky dome, stars and far ranges ride with the camera: always at "infinity".
    sky.current?.position.copy(camera.position);
    stars.current?.position.copy(camera.position);
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
        shadow-bias={-0.0015}
        shadow-normalBias={0.6}
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
      <points ref={stars} geometry={geo.stars} material={starMat} frustumCulled={false} />
      <mesh ref={moon} material={moonMat} frustumCulled={false}>
        <icosahedronGeometry args={[MOON.radius, 1]} />
      </mesh>
      <group ref={backdrop}>
        <mesh geometry={geo.mountains} material={MATS.mountain} frustumCulled={false} />
      </group>
      <Clouds reducedMotion={reducedMotion} />
    </>
  );
}
