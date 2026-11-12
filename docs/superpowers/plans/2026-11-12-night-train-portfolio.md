# Night Train Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-page Next.js portfolio where scrolling rides a stylized 3D night train through stations (Heet's career), with an "Express" plain-page view that carries all the same content.

**Architecture:** One typed content file feeds two views: **Express** (real HTML, always rendered first — SEO, no-JS, reduced-motion) and **Ride** (lazy-loaded React Three Fiber scene layered on top, driven by a single scroll-progress store). Pure functions (progress↔station mapping, palette interpolation, quality tiers, mode choice) hold the logic and are unit-tested; the scene components stay thin.

**Tech Stack:** Node 26.13.1 / npm 12.2.2 · next 16.4.6 (App Router, TS, `output: "export"`) · react 19.3.1 · three 0.187.0 · @react-three/fiber 9.8.2 · @react-three/drei 10.7.9 · @react-three/postprocessing 3.2.2 · motion 14.12.0 · lenis 1.3.27 · zustand 5.1.0 · media-chrome 4.19.4 (via Skiper67) · sharp 0.35.5 (dev, media script) · vitest 5.1.0 + @testing-library/react 16.3.3 · @playwright/test 1.65.0

**Spec:** `docs/superpowers/specs/2026-11-12-night-train-portfolio-design.md` — read it before any task.

## Global Constraints

- Facts come from `HeetParikh_Resume.pdf`. Vaani response time is **383 ms**; the string "300 ms"/"300ms" must not appear anywhere.
- Phone number never rendered on the page (it stays only inside the PDF).
- Station ids, in order: `departure, mct, vaani, yieldguard, formai, quizzx, solar, next, terminus`. Hash URL = `#<id>`.
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
src/scene/Scene.tsx (lazy)  src/scene/Carriage.tsx  src/scene/Scenery.tsx
src/scene/RainGlass.tsx  src/scene/Platform.tsx  src/scene/quality.ts  src/scene/palette.ts
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

**Files:** Create `src/scene/Scene.tsx` (default export, loaded via `next/dynamic` with `ssr:false`), `Carriage.tsx`, `quality.ts`, `quality.test.ts`.
**Interfaces — Produces:** `getQuality(env:{ width:number; dpr:number; coarsePointer:boolean; cores:number }): { dpr:number; post:boolean; rainDrops:number; sceneryLayers:number }`. Scene reads `useRide.progress` via `useFrame` (no React re-render per frame — read store with `getState()`).
- [ ] **Step 1: Failing tests:** phone (`width 390, coarsePointer true`) → `post:false`, `dpr<=1.5`, `rainDrops` < desktop's, `sceneryLayers` < desktop's; desktop (`width 1440, cores 8`) → `post:true`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 3b:** Carriage built from primitives: interior walls, seats facing window, small table, warm lamp (point + emissive), window frame; camera seated looking out the window with a subtle idle sway. Express HTML stays underneath; Canvas fades in (opacity 0→1, 600 ms) once first frame renders — no spinner.
- [ ] **Step 5:** Manual check in browser: carriage renders, 60 fps in devtools performance on desktop. e2e: in ride mode a `canvas` exists; in express mode none. Commit `feat: train carriage scene shell`.

### Task 8: Scenery travel + palette morph

**Files:** Create `src/scene/Scenery.tsx`, `src/scene/palette.ts`, `palette.test.ts`.
**Interfaces — Produces:** `STATION_PALETTES: Record<StationId,{ sky:string; horizon:string; lights:string }>`; `paletteAt(index:number, t:number): { sky; horizon; lights }` (linear-RGB lerp between station index and index+1 using eased `t`).
- [ ] **Step 1: Failing tests:** `paletteAt(i,0)` equals `STATION_PALETTES[ids[i]]`; `paletteAt(i,1)` equals next station's; `t=0.5` lies strictly between both per channel; last index with any t returns last palette.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Scenery: N parallax layers (count from `getQuality`) of silhouette planes (hills, towns, city lights, bridge, tunnel) scrolling past the window at speeds proportional to travel velocity; velocity eases to 0 inside a stop's dwell (train glides to a halt, ease-in-out). Sky/horizon/lights colours from `paletteAt`. Light sweeps through the carriage while moving. Manual check, then commit `feat: moving scenery with palette morph`.

### Task 9: Rain on glass + post-processing

**Files:** Create `src/scene/RainGlass.tsx`.
- [ ] **Step 1:** Window-pane shader material: drops sliding and merging, slight refraction of scenery behind (sample a render target or a blurred colour field); drop count from `getQuality().rainDrops`. Drops streak more diagonally while the train moves.
- [ ] **Step 2:** `@react-three/postprocessing` Bloom (lamp + city lights) + Vignette, only when `getQuality().post`.
- [ ] **Step 3:** Verify desktop ≥ 55 fps sustained in devtools; phone emulation (375×812, 4× CPU throttle) stays usable. Commit `feat: rain on glass and bloom`.

### Task 10: Stations — platforms, signs, cards

**Files:** Create `src/scene/Platform.tsx`, `src/ride/StationCard.tsx`, `src/ride/StationCard.test.tsx`.
**Interfaces — Consumes:** `progressToStation`, `STATIONS`, `StationMedia`. **Produces:** `<StationCard station />` (shown by RideOverlay when `atStop`), reusing Express's content components so text is identical.
- [ ] **Step 1: Failing test:** RideOverlay with progress at `stationToProgress(2)` shows the Vaani card heading; at mid-travel (`t=0.5` between 2 and 3) shows no card.
- [ ] **Step 2–4:** FAIL → implement → PASS. Card entrance: opacity + translateY(8px) + blur(4px→0), 240 ms `--ease-out`, children staggered 40 ms; exit 160 ms. 
- [ ] **Step 5:** Platform per station slides into view near each stop: station-name sign (canvas texture / drei `Text`), with a hint prop: Vaani glowing waveform sign, YieldGuard wafer-grid sign, Solar panels on roofs, `next` an empty lit platform with sign "Next stop: your team?", terminus buffer stop + ticket booth. Terminus card's primary action is the ticket = resume download.
- [ ] **Step 6:** Commit `feat: station platforms and cards`.

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

### Task 13: Polish, accessibility, performance pass

**Files:** Modify as needed.
- [ ] **Step 1:** Run Emil skills on the result (`review-animations`, `emil-design-eng` review table) and apply fixes.
- [ ] **Step 2:** Accessibility: keyboard can reach mode toggle, sound toggle, route map, all links; visible focus rings; `lang="en"`; metadata (title "Heet Parikh — Full-Stack & AI Developer", description, OG image of the carriage).
- [ ] **Step 3:** e2e: reduced-motion emulation with no saved mode → Express (no canvas); keyboard Tab reaches resume link; 375px no horizontal scroll in both modes.
- [ ] **Step 4:** `npm run build`; Lighthouse on `out/` served locally — Express mode performance ≥ 90, accessibility ≥ 95. Record numbers in the commit message.
- [ ] **Step 5:** Full `npm test && npm run e2e` PASS. Commit `chore: polish, a11y and performance pass`.
- [ ] **Step 6:** Deploy to Vercel only after Heet confirms (outward-facing).
