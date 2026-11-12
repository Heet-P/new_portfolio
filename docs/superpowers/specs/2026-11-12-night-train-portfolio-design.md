# Night Train Portfolio — Design

Date: 2026-11-12
Owner: Heet Parikh

## 1. Intent

A single-page portfolio for Heet Parikh (3rd-year B.Tech CSE, full-stack + AI integrations) that a recruiter
remembers after one visit. In the first 10 seconds a visitor should feel: **this person knows what they're doing,
thinks creatively, and is worth remembering.**

Reference that started it: itomdev.com — memorable because it is *uncommon*, and because of sound and small
interactive surprises. Heet looked at many directions; the ones that landed were:

- **jesse-zhou.com** — for the **real 3D**, the **smoothness**, and **morphing transitions** between states.
  Its sounds were too harsh.
- **joshwcomeau.com** — for a page that stays easy to read while everything feels alive (soft sounds, playful
  reactive motion).

Rejected: themed skins (waveform/blueprint/editorial), gimmick objects (phone call, gadget, case file), and any
personal hobby/aesthetic theme. Anything that reads as a template is a failure.

## 2. The concept: the Night Train

**Camera: a side view of the whole 3D train from outside** (changed 2026-11-12 at Heet's request; earlier drafts
had the camera inside a carriage). The visitor watches a stylized night train — locomotive plus several carriages
with warm lit windows — glide across the screen side-on through a night landscape. Scrolling moves the train
forward. Each chapter of Heet's career is a **station**. The world scrolls past in parallax layers and **morphs**
between stops. Heet is gathering visual references for the train and scene; scene look will be refined against them.

### Route (stations, in order)

| # | Station | Content |
|---|---|---|
| 0 | **Departure** | Heet Parikh — full-stack developer, AI integrations. 3rd-year B.Tech CSE, CSPIT CHARUSAT (CGPA 8.69). President, TechGenius Club. GitHub + LinkedIn + resume. |
| 1 | **MCT IT Solutions** (internship, done) | Software Intern, 05/2026–06/2026, Ahmedabad. Next.js/TypeScript payment workflows across 5+ e-commerce checkouts; ~25% lower checkout interaction delay; reusable payment components cut integration effort ~40%. |
| 2 | **Vaani AI** (flagship) | AI sales agent platform: lead discovery, enrichment, AI voice calling agent. Voice pipeline (Twilio + Sarvam AI) at **383 ms** response, <1.5 s TTS. Post-call WhatsApp memo. Chaos2Commit Hackathon, Top 6. Stack: Next.js, Supabase, Twilio, Sarvam AI. |
| 3 | **YieldGuard AI** (flagship) | AI orchestrator for semiconductor FAB yield analysis. IBM Bob coordinating 14 tools over MCP, Gemini reasoning + watsonx.ai Granite fallback. ResNet-style CNN on WM-811K, 0.923 macro-F1 (beat ViT baseline). Isolation Forest on SECOM sensor data. Vector search over past root causes. **IBM Hackathon, 2nd place.** |
| 4 | **FormAI** | Multilingual government-form assistant. Techathon, 2nd place among 100+ teams (02/2026). |
| 5 | **QuizzX** | Quiz platform for 200+ concurrent users, built as TechGenius Web Lead (2025–2026). |
| 6 | **Solar Lead Engine** (*current stop*) | SGP-II project, 09/2026–present. Data-mining pipeline + LLM enrichment ranking outreach targets across Maharashtra & Gujarat; XGBoost + Logistic Regression (~96–97% on synthetic data, initial eval); ranking UI for sales. |
| 7 | **Next stop** (open) | No upcoming internship yet — Heet is actively looking. Station shows an empty platform with a sign along the lines of "Next stop: your team?" and a contact CTA. When an internship lands it becomes a real station. |
| 8 | **Terminus** | Contact: email heet16@gmail.com, LinkedIn, GitHub. Resume handed over as a **ticket** (click → downloads the PDF). |

Skills appear as a compact strip at Departure (and in Express view), not as a separate station.

### Media per station

Heet has **demo videos, GitHub repos, and photos of hackathon wins**. Each project station entry supports:
GitHub repo link, optional live link, optional demo video, optional photos (e.g. award photos), plus 2–3 headline
stats (e.g. **383 ms**, **0.923 macro-F1**, **2nd / 100+**). Videos use the **Skiper67** video player (Heet's
global rule), muted + lazy-loaded, never autoplay with sound. Photos/videos are optimized (compressed, modern
formats, poster frames) and lazy-loaded. Heet drops the raw files into `media-inbox/` (one subfolder per project);
the builder processes them. Until media arrives, stations render with stats + links only — layout must look good
both ways.

### Deep links (Claude's call)

Each station has its own hash URL (`#departure`, `#mct`, `#vaani`, `#yieldguard`, `#formai`, `#quizzx`,
`#solar`, `#next`, `#terminus`). Opening one starts the ride at that station, and works the same in Express.
The URL hash updates as the ride passes stations (replaceState, no history spam).

Source of truth for facts: `HeetParikh_Resume.pdf`. Use **383 ms** (resume figure), never "300 ms".
Phone number stays in the downloadable PDF (Heet approved); it is **not** printed on the page itself.

### The ride

- **Opening:** short soft fade in on the train waiting at Departure. A route map draws itself. A small sound
  toggle is visible, **off by default**.
- **Scroll = travel.** Scroll progress drives the train between stations. The train stays roughly framed while
  the world moves past it in parallax (foreground posts/fences fast, hills/towns/city lights slower, sky slowest);
  wheels turn, carriages sway slightly, window light flickers past poles, light rain falls across the scene.
  Bridges and tunnels along the route. At a stop: the train eases to a halt beside a platform, the platform sign
  shows the station name, and that station's content card morphs in.
- **Scenery morphs between stations** rather than cutting — e.g. colour of the night sky and lights shifts
  per station; the platform props hint at the content (Vaani stop: a glowing waveform sign; YieldGuard: a
  silicon-wafer-patterned sign; Solar: solar panels on the platform roofs). Exact props are builder's choice.
- **Route map** stays in a corner the whole ride: shows current position, doubles as navigation (click a
  station → ride there smoothly). Upcoming station is drawn dashed.
- **Terminus** is the end of the scroll; the ticket is the resume download.

### Express (the recruiter fast lane)

An always-visible **"Express"** button switches to a plain, fast, readable single page with all the same content
(Josh Comeau–style: clean, but alive — soft hover reactions, soft sounds if sound is on). One click back to the
ride. The same content data feeds both views.

Express is also what renders:
- when the user has `prefers-reduced-motion: reduce` (default to Express, ride still available),
- when WebGL is unavailable,
- for crawlers / no-JS (content must exist as real HTML for SEO and accessibility — the 3D is layered on top).

## 3. Look and feel

- **Stylized, not photoreal.** Warm, soft, low-detail shapes with good real-time lighting and gentle bloom.
  The richness comes from lighting and atmosphere, not model detail.
- Palette: deep night blues/indigos for the world; warm amber light glowing from the train's windows and lamps. Night-only — **no light/dark toggle**
  (Heet's global rule for theme toggles is Skiper26; not used because there is one theme by design).
- Motion: smooth and morphing; nothing snaps. UI follows Emil Kowalski's rules (skill at
  `.claude/skills/emil-design-eng`): custom ease-out curves, UI animations < 300 ms, `scale(0.97)` press
  feedback, only `transform`/`opacity` animated in UI, hover effects gated to `(hover: hover) and (pointer: fine)`,
  never `scale(0)` entries, stagger 30–80 ms. The ride itself (camera/scene) may be slower and continuous.
- Typography & spacing follow Heet's global rules: type scale 16 / 20 / 25 / 32px, line-height 1.4–1.6×,
  spacing on a 4/8px grid, touch targets ≥ 44×44px, text contrast ≥ 4.5:1 against its actual background.
- Fonts: builder's choice; must feel warm and crafted, not generic.

## 4. Sound

- **Off by default**, one toggle, remembered per visitor (localStorage, wrapped in try/catch).
- Character: **mellow, soothing, lo-fi**. Explicitly *not* harsh/clicky (the one thing Heet disliked about Jesse's site).
- Layers when on:
  - lo-fi music loop (low volume),
  - soft rain + soft train rumble / wheel clatter (ambient, rumble swells while moving, settles at stops),
  - soft station chime on arrival,
  - very soft UI sounds (muffled taps/pops) on buttons, map clicks, ticket.
- All audio must be properly licensed (CC0 / royalty-free with commercial-use OK, e.g. Pixabay, Freesound CC0)
  or generated. Keep a `CREDITS` note of sources even if not required.
- Audio fades in/out (no hard starts), pauses when the tab is hidden.

## 5. Tech (decided by Claude, accepted by Heet)

- **Next.js** (latest, App Router, TypeScript) — Heet's own stack. Static export; host on Vercel.
- **React Three Fiber + drei** for the scene; postprocessing for bloom/vignette on desktop.
- Scene built **mostly in code** (train = locomotive + carriages from simple geometry with emissive windows;
  rain as a particle/streak layer; scenery as shaders/layered planes).
  Props from **CC0 libraries** (Poly Haven, Kenney, Quaternius, Poly Pizza); AI-generated props allowed for one-offs.
  **No Blender** in v1. (Optional later: Blender MCP to bake lighting for extra polish.)
- Motion (`motion/react`) for UI. Smooth scroll library allowed if it helps scroll→ride feel.
- Content in **one typed data file** so adding a station (e.g. a new internship) = adding one entry.
- Resume: `public/HeetParikh_Resume.pdf` (copy from `C:\Users\heet1\Downloads\HeetParikh_Resume.pdf`).
- Runtime: Node 26.13.1, npm 12.2.2.

## 6. Performance & devices

- Target smooth ~60 fps on a mid laptop. Phones: same scene, simplified (lower pixel ratio, no postprocessing,
  fewer rain drops / scenery layers).
- 3D scene lazy-loaded; Express-view HTML paints first so there is never a blank screen.
- Loading state: no generic spinner; the train scene fades up from the Express-coloured background while the route
  map draws (skeleton-style placeholder matching real layout).
- Images below the fold lazy-loaded.

## 7. Goals / non-goals / anti-goals

**Goals:** memorable in 10 s; every fact findable in < 30 s via Express; easy to add future internships; smooth.

**Non-goals (v1):** live AI demos (explicitly rejected — show-and-tell only), blog, CMS, contact form
(email/LinkedIn links are enough), analytics, multiple pages, light theme, i18n.

**Anti-goals (failure even if it "works"):** looks like a template; harsh sounds; janky/stuttery ride;
a recruiter can't find the resume quickly; autoplaying sound.

## 8. Schedule

No deadline. Build the **full ride, properly polished**, rather than a rushed MVP. Still build in a sensible order
(content + Express first so there's always a working site, then the ride, then atmosphere and sound) so each step
can be reviewed in the browser.

## 9. Left to the builder

Fonts, exact colours, exact scenery/prop design per station, station card layout, specific audio tracks
(within licence + mood rules), scroll library choice, file structure, how the morphing is implemented.
