/**
 * Hand-drawn marks of the newspaper, as inline SVG (no requests, crisp at any size, coloured
 * by tokens through currentColor). All decorative: every one is aria-hidden.
 */
import styles from "./newspaper.module.css";

/**
 * The red dry-brush stroke under the headline's last word: a tapered swipe with a few
 * paper-coloured streaks where the brush ran dry, and loose bristle marks off its tail.
 *
 * `drawId` (Express only): the stroke can draw itself in, left to right, when its article
 * scrolls into view. A thick white stroke along the brush's spine masks the paint; animating
 * that stroke's dashoffset (pathLength 1) reveals it like a brush pulled across the page. The
 * id must be unique in the document, so only the Express (one article per stop) passes it.
 * At rest the mask is fully drawn, so the static page always shows the whole stroke.
 */
export function BrushUnderline({ drawId }: { drawId?: string }) {
  return (
    <svg className={styles.brushUnderline} viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {drawId && (
        <mask id={drawId} maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="24">
          <path className={styles.brushDraw} d="M0 16C90 13 200 11 300 6" fill="none" stroke="#fff" strokeWidth="22" pathLength={1} />
        </mask>
      )}
      <g mask={drawId ? `url(#${drawId})` : undefined}>
        <path
          fill="currentColor"
          d="M3 15.5C30 11 72 9.5 120 9.8 168 10 214 8.6 252 7.2c16-.6 30-1.4 44-2.6l1.6 3.4c-12 2.2-26 4-40 5.2-40 3.2-86 4.6-134 5.6-34 .8-60 2.2-80 4.4-3.6.4-5.6-.2-6-1.8-.4-1.4 1-3 3.6-4z"
        />
        {/* Dry-brush streaks: the paper showing through the paint. */}
        <g fill="none" stroke="var(--paper)" strokeLinecap="round">
          <path d="M40 13.6C90 12 150 12.4 230 10.2" strokeWidth=".9" opacity=".75" />
          <path d="M70 16.4c50-1.4 110-2 180-4.6" strokeWidth=".7" opacity=".6" />
          <path d="M150 14.2c40-.8 80-1.8 120-3.8" strokeWidth="1.1" opacity=".55" />
        </g>
        {/* Bristle marks trailing off the end of the stroke. */}
        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1">
          <path d="M262 11.4c12-.8 22-1.8 34-3.2" />
          <path d="M250 14.4c10-.6 20-1.2 28-2.4" opacity=".7" />
        </g>
      </g>
    </svg>
  );
}

/** The red brush swipe behind the "At a Glance" label: a ragged painted tab. */
export function BrushTab() {
  return (
    <svg className={styles.brushTab} viewBox="0 0 220 48" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M6 9c22-3.6 60-5 104-4.6 40 .4 72-.6 102-2.4l2.6 4.2-1.8 3.4 3 4.6-2.4 4 2.2 5.2-3 4.8 2 5.6-3.4 4.2c-30 1.6-66 2.8-104 3-40 .2-72 1.2-98 3.2L4 41.6l2.4-4.6L3 32.4l2.8-5L3.4 22l3-5.2L4 12.6z"
      />
      <g fill="none" stroke="var(--paper)" strokeLinecap="round" opacity=".45">
        <path d="M20 15c50-1.6 110-1.4 180-3" strokeWidth=".8" />
        <path d="M12 34c60-1.2 130-1.6 196-3.4" strokeWidth=".8" />
      </g>
    </svg>
  );
}

/**
 * An engraved fleuron with rules: the stand-in when a stop has no illustration (or the file
 * fails to load), so the clipping's frame never sits empty.
 */
export function Ornament() {
  return (
    <svg className={styles.ornament} viewBox="0 0 240 80" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        <path d="M8 40h76M156 40h76" strokeWidth="1.5" />
        <path d="M24 46h56M160 46h56" strokeWidth=".8" />
        {/* Curls either side of the centre diamond. */}
        <path d="M84 40c8-14 22-14 26-4 3 7-4 12-9 8" strokeWidth="1.6" />
        <path d="M156 40c-8-14-22-14-26-4-3 7 4 12 9 8" strokeWidth="1.6" />
        <path d="M84 40c8 14 22 14 26 4" strokeWidth="1.2" />
        <path d="M156 40c-8 14-22 14-26 4" strokeWidth="1.2" />
      </g>
      <path fill="currentColor" d="M120 26l9 14-9 14-9-14z" />
      <circle cx="120" cy="40" r="2.6" fill="var(--paper)" />
    </svg>
  );
}

/**
 * Ink speckles: a few flecks of red and black ink flicked off the pen around a flagship stat.
 * Hidden at rest; on hover (fine pointers, motion welcome) they spatter out from the number
 * one after another (CSS). The Express's take on "sparkles", in the newspaper's own medium.
 */
export function InkSpeckles() {
  return (
    <span className={styles.speckles} data-speckles="" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} />
      ))}
    </span>
  );
}

/**
 * "Stop press!": the red rubber stamp slammed onto the current stop's clipping (Express only),
 * the late-news mark of a paper that held the presses for it. Decorative: the kicker's
 * "Current stop" stamp already says it in words.
 */
export function StopPress() {
  return (
    <span className={styles.stopPress} data-stop-press="" aria-hidden="true">
      Stop press!
    </span>
  );
}
