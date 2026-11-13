# Night Train Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-page Next.js portfolio where scrolling rides a stylized 3D night train through stations (Heet's career), with an "Express" plain-page view that carries all the same content.

**Architecture:** One typed content file feeds two views: **Express** (real HTML, always rendered first — SEO, no-JS, reduced-motion) and **Ride** (lazy-loaded React Three Fiber scene layered on top, driven by a single scroll-progress store). Pure functions (progress↔station mapping, palette interpolation, quality tiers, mode choice) hold the logic and are unit-tested; the scene components stay thin.

**Tech Stack:** Node 26.13.1 / npm 12.2.2 · next 16.4.6 (App Router, TS, `output: "export"`) · react 19.3.1 · three 0.187.0 · @react-three/fiber 9.8.2 · @react-three/drei 10.7.9 · @react-three/postprocessing 3.2.2 · motion 14.12.0 · lenis 1.3.27 · zustand 5.1.0 · media-chrome 4.19.4 (via Skiper67) · sharp 0.35.5 (dev, media script) · vitest 5.1.0 + @testing-library/react 16.3.3 · @playwright/test 1.65.0

**Spec:** `docs/superpowers/specs/2026-11-12-night-train-portfolio-design.md` — read it before any task.

## Global Constraints

- Facts come from `HeetParikh_Resume.pdf`. Vaani response time is **383 ms**; the string "300 ms"/"300ms" must not appear anywhere.
- Phone number never rendered on the page (it stays only inside the PDF).
- Station ids, in order (revised 2026-11-13): `departure, vaani, yieldguard, solar, sahara, experience, next, terminus`. Hash URL = `#<id>`. The internship company (MCT IT Solutions) MAY be named in the Work Experience article (Heet, 2026-11-13, reversing the earlier rule); the stop is still called "Work Experience". All site copy is first person (I/me/my).
- Sound **off by default**; preference key `nt-sound` in localStorage, every access in try/catch.
- Night-only theme; no light/dark toggle.
- Type scale 16 / 20 / 25 / 32px, line-height 1.4–1.6×; spacing multiples of 4/8px; touch targets ≥ 44×44px; text contrast ≥ 4.5:1.
- UI motion (Emil rules): custom curves `--ease-out: cubic-bezier(0.23,1,0.32,1)`, `--ease-in-out: cubic-bezier(0.77,0,0.175,1)`; UI animations < 300 ms; `scale(0.97)` on `:active`; animate only `transform`/`opacity` in UI; hover styles inside `@media (hover:hover) and (pointer:fine)`; no `scale(0)` entries; stagger 30–80 ms; respect `prefers-reduced-motion`.
- Videos use Skiper67 (`VideoPlayer` family), muted, lazy, never autoplay with sound.
- All audio CC0 / royalty-free-commercial or generated; every file listed in `CREDITS.md`.
- No live AI demos, no contact form, no blog, no analytics, no CMS.
- Meaningful comments in code (Heet's global rule). `.gitignore` before first commit; never commit `.env`.
- Phone width: 16px side gutter, no horizontal scroll at 375px.

## Review Focus

1. **Unknown or stale hash** (`#foo`, `#Vaani`) → opens at Departure, no crash, hash corrected. Test in Task 4.
2. **Rapid route-map clicks mid-ride** → travel retargets; ends at the last-clicked station. Test in Task 6.
3. **localStorage throws / is empty** (private mode) → sound toggle still works for the session, defaults off. Test in Task 12.
4. **Resize / orientation change mid-ride** → visitor stays at the same station. Test in Task 6 (e2e).
5. **Tab hidden while sound on** → audio fades out/pauses; on return resumes only if still enabled. Test in Task 12.

---

## File Structure

```
.gitignore  CREDITS.md  next.config.ts  vitest.config.ts  playwright.config.ts
public/HeetParikh_Resume.pdf  public/media/<station>/...  public/audio/*.mp3
scripts/process-media.mjs            # media-inbox → public/media (sharp + ffmpeg if present)
src/app/layout.tsx  src/app/page.tsx  src/app/globals.css
src/content/route.ts                 # types + the one content array
src/content/route.test.ts
src/express/ExpressView.tsx          # plain readable page, all stations
src/express/StationSection.tsx  src/express/StationMedia.tsx  src/express/*.test.tsx
src/ride/rideStore.ts                # zustand: progress, target, mode
src/ride/mapping.ts                  # progress<->station, hash parsing (pure)
src/ride/mode.ts                     # chooseInitialMode (pure)
src/ride/useScrollDriver.ts          # lenis -> store, hash sync
src/ride/RouteMap.tsx  src/ride/RideOverlay.tsx  src/ride/StationCard.tsx
src/scene/Scene.tsx (lazy)  src/scene/Train.tsx  src/scene/Scenery.tsx
src/scene/Rain.tsx  src/scene/Atmosphere.tsx  src/scene/Platform.tsx  src/scene/quality.ts  src/scene/palette.ts
src/sound/audioEngine.ts  src/sound/SoundToggle.tsx  src/sound/*.test.ts
src/components/skiper67/*            # vendored Skiper67 video player
e2e/*.spec.ts
```

---

### Task 1: Project scaffold

**Files:** Create Next app at repo root, `.gitignore`, `next.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `e2e/smoke.spec.ts`
**Interfaces:** Produces npm scripts `dev`, `build` (static export to `out/`), `test` (`vitest run`), `e2e` (`playwright test`, webServer = `npx serve out` after build).

- [ ] **Step 1:** `git init`; write `.gitignore` first (node_modules, .next, out, .env*, .superpowers/, media-inbox/, test-results/, playwright-report/).
- [ ] **Step 2:** Scaffold with `npx create-next-app@16.4.6 . --ts --app --src-dir --eslint --no-tailwind --import-alias "@/*"` (plain CSS modules + globals; Tailwind not needed). Set `output: "export"`, `images.unoptimized: true`.
- [ ] **Step 3:** Install pinned deps from Tech Stack; configure vitest (jsdom, `src/**/*.test.ts?(x)`).
- [ ] **Step 4:** Write `e2e/smoke.spec.ts`: page at `/` has `<h1>` containing "Heet Parikh". Run `npm run e2e` → FAIL.
- [ ] **Step 5:** Minimal `page.tsx` with that h1 → `npm run build && npm run e2e` PASS.
- [ ] **Step 6:** Commit `chore: scaffold next app with test tooling`.

### Task 2: Content model

**Files:** Create `src/content/route.ts`, `src/content/route.test.ts`; copy resume to `public/HeetParikh_Resume.pdf`.
**Interfaces — Produces:**
```ts
export type StationId = "departure"|"mct"|"vaani"|"yieldguard"|"formai"|"quizzx"|"solar"|"next"|"terminus";
export type StationKind = "intro"|"internship"|"project"|"open"|"end";
export interface Stat { value: string; label: string }          // e.g. {value:"383 ms", label:"voice response"}
export interface Media { video?: { src: string; poster: string }; photos?: { src: string; alt: string; w: number; h: number }[] }
export interface Station {
  id: StationId; kind: StationKind; name: string; tagline: string;
  dates?: string; status?: "done"|"current"|"upcoming";
  body: string[]; stats?: Stat[]; stack?: string[];
  links?: { label: string; href: string }[]; media?: Media; flagship?: boolean;
}
export const STATIONS: Station[];
export const PROFILE: { name: string; role: string; email: string; github: string; linkedin: string; resume: string; skills: Record<string,string[]> };
```
- [ ] **Step 1: Failing tests** in `route.test.ts`:
  - ids equal `["departure","mct","vaani","yieldguard","formai","quizzx","solar","next","terminus"]` in order;
  - `JSON.stringify(STATIONS)` contains `"383 ms"` and does not match `/300\s?ms/`;
  - serialized STATIONS + PROFILE does not contain `9227011606`;
  - `vaani` and `yieldguard` have `flagship: true`; `solar.status === "current"`; `next.status === "upcoming"`;
  - `PROFILE.github === "https://github.com/Heet-P"`, `PROFILE.linkedin === "https://www.linkedin.com/in/heetparikh/"`, `PROFILE.resume === "/HeetParikh_Resume.pdf"`.
- [ ] **Step 2:** Run `npm test` → FAIL.
- [ ] **Step 3:** Fill content from the spec's Route table (copy facts exactly). GitHub repo links per project: leave `links` empty with a `// TODO(heet): repo URL` comment only where unknown — Heet supplies them; tests don't require them.
- [ ] **Step 4:** `npm test` PASS. Commit `feat: content model for all stations`.

### Task 3: Express view

**Files:** Create `src/express/ExpressView.tsx`, `StationSection.tsx`, `StationMedia.tsx`, `src/express/ExpressView.test.tsx`; modify `src/app/page.tsx`, `globals.css`.
**Interfaces — Consumes:** `STATIONS`, `PROFILE`. **Produces:** `<ExpressView />` (each station rendered as `<section id={station.id}>`), `<StationMedia media?: Media />` (renders nothing when media absent; Skiper67 slot added in Task 11).
- [ ] **Step 1: Failing tests:** renders a `section` for every station id; a link with `href="/HeetParikh_Resume.pdf"` and `download` attribute; every external `a[href^="http"]` has `target="_blank"` and `rel` containing `noopener`; skills strip lists "Next.js" and "Python"; no element text matches `/300\s?ms/`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. Josh-style "alive" details: soft hover lift on cards, stat numbers count up once in view (IntersectionObserver, skipped under reduced motion), `:active` scale 0.97. Global tokens in `globals.css` (colours as CSS vars, type scale, easing vars). Night palette; verify contrast ≥ 4.5:1 for body text on card background.
- [ ] **Step 4:** Tests PASS; `npm run build` passes; e2e smoke still passes. Add e2e: at 375×812 `document.documentElement.scrollWidth <= 375`.
- [ ] **Step 5:** Commit `feat: express view with all content`.

### Task 4: Ride mapping + store + hash parsing

**Files:** Create `src/ride/mapping.ts`, `src/ride/mapping.test.ts`, `src/ride/rideStore.ts`.
**Interfaces — Produces:**
```ts
export const STOP_HOLD = 0.5;  // fraction of each segment the train is "stopped" (dwell), builder may tune
export function stationToProgress(index: number, count: number): number;      // centre of station's dwell, 0..1
export function progressToStation(p: number, count: number): { index: number; atStop: boolean; t: number }; // t = 0..1 travel between index and index+1
export function parseHash(hash: string, ids: readonly string[]): number;      // index; unknown/empty -> 0
// rideStore (zustand)
interface RideState { mode: "ride"|"express"; progress: number; target: number|null;
  setProgress(p:number):void; goTo(index:number):void; setMode(m:"ride"|"express"):void }
export const useRide: UseBoundStore<StoreApi<RideState>>;
```
- [ ] **Step 1: Failing tests:** `stationToProgress(0,9)===0`, `stationToProgress(8,9)===1`; round-trip `progressToStation(stationToProgress(i,9),9).index===i && atStop` for all i; `progressToStation` clamps p<0 and p>1; `parseHash("#vaani",ids)===2`; `parseHash("#foo",ids)===0`; `parseHash("#Vaani",ids)===0`; `parseHash("",ids)===0`. *(Review Focus 1)*
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS. Commit `feat: ride progress mapping and store`.

### Task 5: Mode selection (ride vs express)

**Files:** Create `src/ride/mode.ts`, `src/ride/mode.test.ts`, `src/ride/ModeToggle.tsx`.
**Interfaces — Produces:** `chooseInitialMode(env: { reducedMotion: boolean; webgl: boolean; saved: "ride"|"express"|null }): "ride"|"express"`; `detectWebGL(): boolean`; `<ModeToggle />` ("Express" ↔ "Ride", always visible, ≥44px).
- [ ] **Step 1: Failing tests:** `webgl:false` → express regardless; `reducedMotion:true, saved:null` → express; `reducedMotion:true, saved:"ride"` → ride; default → ride.
- [ ] **Step 2–4:** FAIL → implement (saved mode in localStorage key `nt-mode`, try/catch) → PASS. Commit `feat: initial mode selection and toggle`.

### Task 6: Scroll driver, hash sync, route map

**Files:** Create `src/ride/useScrollDriver.ts`, `src/ride/RouteMap.tsx`, `src/ride/RouteMap.test.tsx`, `src/ride/RideOverlay.tsx`, `e2e/ride.spec.ts`.
**Interfaces — Consumes:** `useRide`, mapping fns, `STATIONS`. **Produces:** `useScrollDriver()` — a tall scroll spacer (`count * 100vh`) whose Lenis-smoothed scroll writes `progress`; `goTo(i)` scrolls Lenis to `stationToProgress(i)` (retargets if called again mid-flight); on load reads `parseHash`; on station change `history.replaceState` to `#id`. `<RouteMap />`: one button per station (aria-label = station name, `aria-current` on current), `next` drawn dashed.
- [ ] **Step 1: Failing tests:** RouteMap renders 9 buttons; clicking "Vaani AI" calls `goTo(2)`; clicking Vaani then YieldGuard quickly → store `target===3`. *(Review Focus 2)*
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: e2e** (`ride.spec.ts`, ride mode forced via `localStorage nt-mode=ride`): load `/#yieldguard` → `aria-current` on YieldGuard button; load `/#nope` → Departure current and URL hash becomes `#departure`; at `#vaani` resize viewport 1280×800 → 800×1280 → still Vaani current *(Review Focus 4)*.
- [ ] **Step 6:** Commit `feat: scroll-driven ride with route map and deep links`.

### Task 7: Scene shell — carriage, lighting, camera, quality tiers

**Files:** Create `src/scene/Scene.tsx` (default export, loaded via `next/dynamic` with `ssr:false`), `Train.tsx`, `quality.ts`, `quality.test.ts`.
**Interfaces — Produces:** `getQuality(env:{ width:number; dpr:number; coarsePointer:boolean; cores:number }): { dpr:number; post:boolean; rainDrops:number; sceneryLayers:number }`. Scene reads `useRide.progress` via `useFrame` (no React re-render per frame — read store with `getState()`).
- [ ] **Step 1: Failing tests:** phone (`width 390, coarsePointer true`) → `post:false`, `dpr<=1.5`, `rainDrops` < desktop's, `sceneryLayers` < desktop's; desktop (`width 1440, cores 8`) → `post:true`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 3b:** *(Revised 2026-11-12: exterior side view.)* `src/scene/Train.tsx` (replaces Carriage.tsx): stylized locomotive + 3–4 carriages built from primitives (rounded box bodies, roof, undercarriage, bogies with wheels that rotate with travel velocity, couplings, headlamp), warm emissive window panes with soft interior glow, subtle per-carriage sway/bob while moving. Camera: side-on, slightly elevated, perspective, framing the whole train; gentle drift. A ground strip with rails + sleepers under the train. Expose `TRAIN_PARAMS` (carriage count, colours) at the top of the file so the look can be tuned against Heet's references. Express HTML stays underneath; Canvas fades in (opacity 0→1, 600 ms) once first frame renders — no spinner.
- [ ] **Step 5:** Manual check in browser: train renders side-on, 60 fps in devtools performance on desktop. e2e: in ride mode a `canvas` exists; in express mode none. Commit `feat: side-view train scene shell`.

### Task 8: Low-poly world, track path, follow camera, dusk→night palette

*(Revised 2026-11-12 from Heet's reference image + `media-inbox/train/Animation.mov`: low-poly flat-shaded diorama, 3/4 raised follow camera, golden hour → night.)*

**Files:** Create `src/scene/route3d.ts` (+ test), `src/scene/palette.ts` (+ test), `src/scene/World.tsx`, `src/scene/worldgen.ts` (+ test); modify `Scene.tsx`, `Train.tsx`, `Track.tsx`, `travel.ts` as needed.
**Interfaces — Produces:**
- `ROUTE: { curve: CatmullRomCurve3; stationU: number[] }` — one winding track path through the world; `stationU[i]` = curve parameter (0..1) where station i's platform sits; `trainU(position:number): number` maps `travel.position` (in stations) to curve u.
- `STATION_PALETTES: Record<StationId, Palette>` with `Palette = { skyTop; skyHorizon; sun; sunIntensity; fog; ambient; ground; foliage; rock; water; windowGlow:number }` — golden hour (departure) → dusk → twilight → night (next, terminus). `paletteAt(index, t): Palette` (linear-RGB lerp, eased t).
- `generateWorld(seed:number): WorldLayout` — deterministic placement lists (pines, rocks, mountains, bridges, tunnels) along `ROUTE`, keeping a clear corridor around the track.
- [ ] **Step 1: Failing tests:** `paletteAt(i,0)` equals station i palette; `paletteAt(i,1)` equals station i+1; `t=0.5` strictly between per channel; departure `windowGlow` < terminus `windowGlow`. `trainU` is monotonic and hits `stationU[i]` at each integer position. `generateWorld(1)` deep-equals `generateWorld(1)`; no tree within the track corridor; at least 1 bridge and 1 tunnel.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** World render: flat-shaded (`flatShading: true`, faceted low-poly) terrain chunks along the route, instanced pines (cone stacks) and rocks (low-detail icosahedra, jittered), snow-capped mountain backdrop, a river with a waterfall, wooden trestle bridges where the track crosses water, tunnel mouths in hillsides. Train follows the curve (position + tangent orientation per car with spacing along the curve). Restyle train materials flat-shaded. Camera: raised 3/4 view, offset relative to the curve tangent, critically-damped follow with slight lag; at stations frame train + platform; phones closer framing. Sky gradient, fog, sun/moon direction and colour all from `paletteAt`. Fix sleeper strobing (sleepers are now static geometry along the curve — the train moves, not the ground). Instancing + chunk culling; respect `getQuality().sceneryLayers` as a density multiplier. Manual check vs reference frames, commit `feat: low-poly world with dusk-to-night palette`.

### Task 9: Rain + atmosphere + post-processing

**Files:** Create `src/scene/Rain.tsx`, `src/scene/Atmosphere.tsx`.
- [ ] **Step 1:** Atmosphere: low-poly faceted clouds drifting (as in the reference); waterfall foam/mist particles; light rain (instanced streaks, one draw call, count from `getQuality().rainDrops`) fading in only over the night stretch (palette `windowGlow` high); headlamp cone + warm window light spill onto rails at night; train interior glow via emissive scaled by `windowGlow`.
- [ ] **Step 2:** `@react-three/postprocessing` Bloom (windows, headlamp, city lights) + Vignette, only when `getQuality().post`.
- [ ] **Step 3:** Verify desktop ≥ 55 fps sustained in devtools; phone emulation (375×812, 4× CPU throttle) stays usable. Commit `feat: rain, atmosphere and bloom`.

### Task 10a: Stations (owner's station model)

*(Revised 2026-11-12.)* **Files:** extend `scripts/compress-model.mjs` → `public/models/station.glb`; create `src/scene/Stations.tsx`.
- [ ] **Step 1:** Compress `media-inbox/train/Train_station_3X.glb`: reattach the colour atlases from `media-inbox/train/Train_station_3X/Train_station_3X/*.png` to the matching materials (`_train_station_`, `Main_train_station_`, `Truck_Working_Station_`; `_train_station_Light_` uses `_train_station_Light_.png` as emissive map), downscale textures (≤1024px, WebP), keep `_railway_photovoltaic` (the "example test" mesh — solar panel field) as a separate node, meshopt. Report size.
- [ ] **Step 2:** Place a station at every `stationU` in the flat patch on the platform side: shelter (`_train_station_`) at most stops, the main building at Departure and Terminus, solar field beside the Solar stop. Station-name sign per stop (drei `Text`). Palette-tinted; window lights glow at night via emissive scaled by `windowGlow`. Instanced/shared geometry across stops.
- [ ] **Step 3:** Screenshots at 3 stops. Commit `feat: stations along the route`.

### Task 10b: Cabin + on-board display at each stop

**Files:** extend compress script → `public/models/cabin.glb`; create `src/scene/Cabin.tsx`, `src/ride/OnboardDisplay.tsx` (+ test), `src/ride/stopCamera.ts` (+ test).
**Interfaces — Consumes:** `progressToStation`, `STATIONS`, `StationContent` (Express). **Produces:** `stopBlend(progress): number` 0..1 = how far the camera is into the cabin (0 outside while travelling, 1 fully inside at the centre of a stop's dwell, eased).
- [ ] **Step 1: Failing tests:** `stopBlend` is 0 at mid-travel, 1 at `stationToProgress(i)` for every i, monotonic within each half of a dwell, and continuous. OnboardDisplay at Vaani renders the Vaani heading, a "See live" link only if a live link exists, a "GitHub" link only if a repo link exists (`target=_blank rel=noopener`), and nothing at mid-travel.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Cabin: compress `media-inbox/train/subway-interior/source/subway.glb` (573 meshes → merge by material, ≤12 draw calls, meshopt). Mounted at a fixed spot (not inside the exterior train): the world keeps rendering behind its windows at low cost (or a blurred palette-tinted backdrop on phones). Camera path: chase view → swoops to the train's side window → crossfade (opacity + slight blur) into the cabin → settles facing a large display panel mounted in the cabin. Display content = HTML via drei `<Html transform occlude>` (or an aligned DOM overlay if transform text is blurry) reusing `StationContent`, plus **See live** / **GitHub** buttons from `station.links` (labels matched case-insensitively: "live"/"demo" → See live, "github"/"repo" → GitHub). Terminus display: contact + resume ticket download. Replaces T6's minimal station-name label. Reduced motion: no swoop — instant crossfade.
- [ ] **Step 6:** Screenshots at Vaani + Terminus displays. Commit `feat: cabin and on-board display at stops`.

### Task 10c: Tunnel light panels (skills reel)

**Files:** create `src/scene/TunnelPanels.tsx` (+ pure helper test).
- [ ] **Step 1: Failing test:** `skillReel(PROFILE.skills)` returns a flat ordered list of every skill exactly once; panel layout helper places N panels evenly along each tunnel's arc-length span, alternating walls.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Inside each tunnel, backlit panels on the walls (emissive, one instanced mesh + one texture atlas rendered from a canvas with skill names/group labels) flash past as the train passes, metro-ad style; a short light strobe as each panel passes the camera. Tunnel bore dark otherwise. Commit `feat: tunnel skills reel`.

### Task 10d: Route content restructure (8 stations)

*(Added 2026-11-13 from Heet.)* **Files:** `src/content/route.ts` (+ test), every place keyed by station id/count: `src/scene/palette.ts`, `src/scene/route3d.ts`, `src/scene/worldgen.ts`, `src/scene/stations/*`, CameraRig framing tables, e2e specs, `src/ride/*` tests that hard-code 9 or old ids.
- [ ] **Step 1: Failing tests:** ids exactly `["departure","vaani","yieldguard","solar","sahara","experience","next","terminus"]`; no station/profile text matches `/MCT/i`; `experience.name === "Work Experience"`; Vaani/YieldGuard/Solar/SAHARA each have a GitHub link (exact URLs from spec table); SAHARA has two YouTube links labelled "Watch demo"; `solar.status === "current"`; still no "300 ms" and no phone number. Route/palette/worldgen tests updated for 8 stations (stationU length 8, palettes golden hour → night across 8).
- [ ] **Step 2–4:** FAIL → implement → PASS. SAHARA copy from the spec table (no hype). Departure gets an awards line. Palette: spread golden hour → night across the 8 stops (departure golden … next/terminus night). Station themes: SAHARA = helipad with a small hovering low-poly quadcopter (bobbing; static under reduced motion); Work Experience = plain office-style building variant. Display buttons: "GitHub", "Watch demo" (YouTube, new tab) — "See live" only when a live site exists.
- [ ] **Step 5:** e2e: `/#sahara` shows SAHARA display; `/#mct` falls back to Departure. Screenshots. Commit `feat: 8-station route with SAHARA and work experience`.

### Task 10e: Old-newspaper identity ("The Project Post")

*(Added 2026-11-13 from Heet; reference: `media-inbox/newspaper/ref-project-post.webp`.)* Replaces the navy UI everywhere: cabin display, route map, mode toggle, sound toggle, Express.
**Files:** `src/app/globals.css` tokens + fonts (`src/app/layout.tsx`), new `src/newspaper/*` (Paper texture, Masthead, Article, InkRule, Illustration slot), restyle `src/ride/RouteMap*`, `src/ride/ModeToggle*`, `src/ride/display/*`, `src/express/*`; cabin prop `src/scene/cabin/Newspaper.tsx`.
- [ ] **Step 1: Tokens:** paper `#efe5cc`-ish (yellowed, slight vignette + fibre noise via inline SVG filter, fold creases), ink `#1d1915`, faded ink `#4a4239`, red accent `#b0352b` (brush-stroke underline, stamps, bullet squares), rules double/single like the reference. Fonts via next/font (OFL only): blackletter masthead (e.g. UnifrakturMaguntia), headline serif bold/italic (e.g. Libre Caslon / Playfair), body serif (e.g. Source Serif / Libre Caslon Text), small caps for datelines. Check every text/background pair ≥ 4.5:1.
- [ ] **Step 2: Front page component** per stop: masthead "The Project Post" with Vol./No. (stop number) and date line, big headline = station name with red brush underline, italic deck = tagline, "At a Glance" boxed sidebar (red label tab) with stats/bullets, body in 2 columns on desktop (1 on phones), stack as ink-stamped tags, illustration slot (`/illustrations/<id>.webp`; when missing, an ink ornament placeholder), buttons styled as ink-stamped tickets/coupons: GitHub, Watch demo, See live, resume. Departure = "Special Edition" intro; Terminus = classifieds-style contact + resume ticket + credits.
- [ ] **Step 3: Cabin:** replace the screen panel with a folded newspaper lying on the seat (3D low-poly paper with the masthead printed via canvas texture). On stopBlend the camera leans in; the paper lifts and unfolds (two hinged halves, transform-only DOM unfold synchronised with the 3D) into the full HTML front page aligned over it. Reverse on leaving. Reduced motion: crossfade.
- [ ] **Step 4: Ride chrome:** route map becomes a paper timetable card (ink route line, stamped current stop, dashed upcoming), toggles become paper stamps/tickets. Express becomes a broadsheet: masthead, edition line, stations as articles in a newspaper grid (projects first, then Work Experience), same front-page components.
- [ ] **Step 5:** tests (contrast tokens, front page renders headline/deck/at-a-glance/buttons per kind, illustration fallback), e2e unchanged + display region still labelled. Screenshots vs reference. Commit `feat: old-newspaper identity`.

### Task 11: Media pipeline + Skiper67 video

**Files:** Create `scripts/process-media.mjs`, `src/components/skiper67/*`; modify `StationMedia.tsx`, `route.ts` media fields; add `src/express/StationMedia.test.tsx`.
- [ ] **Step 1:** Install Skiper67 from Skiper UI (skiper-ui.com, its registry/CLI install; it wraps `media-chrome/react`). Verify exports `VideoPlayer, VideoPlayerContent, VideoPlayerControlBar, VideoPlayerPlayButton, VideoPlayerMuteButton, VideoPlayerTimeRange, VideoPlayerTimeDisplay` exist.
- [ ] **Step 2: Failing tests:** `StationMedia` with no media renders nothing; with `video` renders a `video` element with `muted` and `preload="none"` and a poster; with photos renders `img` with `loading="lazy"`, `alt`, `width`, `height`.
- [ ] **Step 3–4:** FAIL → implement → PASS.
- [ ] **Step 5:** `process-media.mjs`: reads `media-inbox/<station>/`; images → AVIF + WebP, max 1600px wide (sharp); videos → H.264 MP4 ≤ 1280px + poster JPG (ffmpeg if on PATH, otherwise print the exact ffmpeg command and skip); writes to `public/media/<station>/` and prints `Media` JSON to paste into `route.ts`. Run it on whatever Heet has dropped in; wire the output.
- [ ] **Step 6:** Commit `feat: station media with skiper67 player`.

### Task 12: Sound

**Files:** Create `src/sound/audioEngine.ts`, `audioEngine.test.ts`, `SoundToggle.tsx`; add `public/audio/{lofi-loop,rain,rumble,chime,tap}.mp3`, `CREDITS.md`.
**Interfaces — Produces:**
```ts
export interface AudioEngine {
  enabled(): boolean; setEnabled(on: boolean): void;   // fades 600 ms; persists nt-sound
  setTravelSpeed(v: number): void;                       // 0..1 → rumble gain + slight lowpass open
  chime(): void; tap(): void;                            // no-ops when disabled
  dispose(): void;
}
export function createAudioEngine(deps?: { storage?: Storage; doc?: Document; ctx?: () => AudioContext }): AudioEngine;
```
- [ ] **Step 1: Failing tests** (fake storage/doc/AudioContext):
  - fresh engine → `enabled()===false`;
  - storage whose getItem/setItem throw → no throw, `setEnabled(true)` makes `enabled()===true` *(Review Focus 3)*;
  - `setEnabled(true)` writes `nt-sound=1`; new engine with that storage → enabled;
  - dispatching `visibilitychange` with `doc.hidden=true` while enabled → master gain ramps to 0; back to visible → ramps up; if disabled meanwhile, stays 0 *(Review Focus 5)*;
  - `chime()` while disabled creates no source.
- [ ] **Step 2–4:** FAIL → implement (Web Audio: master gain, lofi + rain + rumble looping buffers, lowpass on music ~ "muffled lo-fi" feel; AudioContext created lazily on first user enable) → PASS.
- [ ] **Step 5:** Source mellow lo-fi loop + rain + train rumble + soft chime + soft tap (CC0/Pixabay licence, or generated); keep each under ~1 MB, loops seamless. Record sources in `CREDITS.md`. Wire: `SoundToggle` (≥44px, aria-pressed), chime on arriving at a stop, `tap` on buttons/map/ticket, `setTravelSpeed` from scene velocity.
- [ ] **Step 6:** Listen-test with Heet (mood must be soothing, nothing harsh). Commit `feat: lo-fi sound engine`.

### Task 12b: Express whimsy pass (Josh-inspired, not copied)

**Files:** modify `src/express/*`, add small components as needed (e.g. `Sparkles.tsx`, `useSpring` hover helpers).
- [ ] **Step 1:** Add playful, physics-based micro-interactions in Josh Comeau's *spirit*: springy hover/boop on buttons and chips, sparkles on flagship stats, wiggle on the resume button, playful station markers, soft pop/click sounds via `AudioEngine.tap()` when sound is on. Keep Heet's night-train palette/type/layout; do NOT copy joshwcomeau.com's theme, layout, illustrations or assets. All motion transform/opacity only, reduced-motion respected, hover gated to fine pointers.
- [ ] **Step 2:** Tests: reduced motion disables sparkles/boops; no sound when sound is off. Screenshots. Commit `feat: express whimsy pass`.

### Task 13: Polish, accessibility, performance pass

**Files:** Modify as needed.
- [ ] **Step 1:** Run Emil skills on the result (`review-animations`, `emil-design-eng` review table) and apply fixes.
- [ ] **Step 2:** Accessibility: keyboard can reach mode toggle, sound toggle, route map, all links; visible focus rings; `lang="en"`; metadata (title "Heet Parikh — Full-Stack & AI Developer", description, OG image of the carriage).
- [ ] **Step 3:** e2e: reduced-motion emulation with no saved mode → Express (no canvas); keyboard Tab reaches resume link; 375px no horizontal scroll in both modes.
- [ ] **Step 4:** `npm run build`; Lighthouse on `out/` served locally — Express mode performance ≥ 90, accessibility ≥ 95. Record numbers in the commit message.
- [ ] **Step 5:** Full `npm test && npm run e2e` PASS. Commit `chore: polish, a11y and performance pass`.
- [ ] **Step 6:** Deploy to Vercel only after Heet confirms (outward-facing).

### Task 14: Ticket-printer intro ("Take the journey")

*(Added 2026-11-13 from Heet; his reference component is saved at `media-inbox/ticket-printer/ReceiptPrinter.reference.tsx` + `Usage.reference.tsx` — Tailwind/Phosphor/cn/TactileButton based; port the mechanics, not the dependencies.)*
**Files:** `src/intro/TicketPrinter.tsx` (+ `.module.css`, compound API mirroring the reference: Root/Machine/Header/Screen/Status/Output/Paper), `src/intro/IntroGate.tsx` (+ test), `src/intro/ticket.ts` (pure: ticket lines from STATIONS/PROFILE, shouldShowIntro), wire into `src/app/page.tsx` / `src/ride/*` mode flow; sound cue in `src/sound/*`.
- [ ] **Step 1: Failing tests:** `shouldShowIntro({ mode, hash, reducedMotion, seen })` → true only for ride mode, empty/`#departure` hash, not reduced motion, not seen this session (`sessionStorage` key `nt-intro-seen`, try/catch); ticket lines list all 8 stations in order and never contain the company name or phone; IntroGate shows the machine, advances processing → printing → complete, then "Take the journey" boards (hides the gate, marks seen, focuses the ride); "In a hurry?" link switches to Express; Escape/"Take the journey" keyboard reachable; reduced motion renders the complete ticket instantly.
- [ ] **Step 2–4:** FAIL → implement → PASS. Port the reference's motion exactly where it matters (stepped feed keyframes + times, 1.75 s feed, ease-out/in-out curves, zig-zag clip-path tear, status crossfades) using `motion/react` (installed) and CSS modules; replace Phosphor icons with inline SVG; no Tailwind. Style: vintage ticket machine in the newspaper identity (paper/ink/red tokens, blackletter "Night Train" plate, ink-dot screen), ticket = punched rail ticket (stations as a route list, passenger "Visitor", date, seat "Window", red stamp). Full-screen overlay on first paint in ride mode; the 3D scene preloads behind it (stage advances to complete no earlier than ~2.5 s and no later than scene-ready + 0.5 s, max ~6 s). Soft dot-matrix print sound via the engine when sound is on.
- [ ] **Step 5:** e2e: fresh session ride mode at `/` shows the printer, button boards; `/#sahara` skips it; second load in same session skips it; reduced motion skips/instant. Screenshots. Commit `feat: ticket-printer intro`.


### Task 15: First-person copy, company name, scroll hint, ticket tear

*(Added 2026-11-13 from Heet's walkthrough.)*
- [ ] Copy: every visitor-facing sentence in first person (route.ts bodies/taglines/stats labels where natural, Departure intro, Next "Situations Wanted", Terminus classifieds, ticket, tunnel title card, Express lead, meta description). Keep facts identical (383 ms etc.). Work Experience names "MCT IT Solutions, Ahmedabad" (role: Software Intern); update the tests that asserted the company's absence (now assert presence in the experience article only; still no phone number).
- [ ] Scroll hint at Departure (ride mode only): newspaper-styled hand-lettered cue "Scroll to depart" + animated ink arrow (desktop) / "Swipe up to depart" (coarse pointer), shown when the train is at Departure and the user hasn't moved yet; fades out on first scroll/keys and never returns that session (sessionStorage). Reduced motion: static. Accessible text + not announced repeatedly.
- [ ] Ticket tear: on "Take the journey" the printed ticket tears along the perforation — the ticket body lifts/rotates away while the stub stays in the machine (two clip-paths along a jagged tear line, transform/opacity only, ~500–650 ms, choreographed so the exit still completes ≤ ~800 ms total); synthesized paper-tear sound (filtered noise sweep with crackle, quiet) when sound is on; reduced motion: no tear animation (instant exit). Tests.

### Task 16: Tunnel-portal gap fix + direct train control

- [ ] Gap: rock/terrain gaps beside tunnel portals (see owner screenshot `.superpowers/sdd/2026-11-12-night-train-portfolio/ref-gap.png`) — seal so the portal arch, its rock mass and the hillside meet with no see-through holes on either side or above; add a worldgen/geometry test (sample points around each portal: terrain height ≥ portal rock or covered).
- [ ] Direct control: the train responds to the visitor's scroll like a throttle — position follows scroll with light critically-damped smoothing (~0.25–0.4 s), no auto-drive glide; speed proportional to scroll velocity; stops shortly after scrolling stops (brief coast). More scroll per station (spacer ~2× current) and a non-linear scroll→position map that gives tunnels extra scroll distance (replaces the tunnel speed cap) so they stay readable. Route-map jumps (goTo) still glide automatically. Keep deep links, resize, Review Focus items, cabin timing (stopBlend on train position) and sound (setTravelSpeed) working. Tests.
