import styles from "./express.module.css";

/**
 * A little ink train in the margin rule under the Express nameplate. When the page first
 * shows, it chugs in from the left edge (bobbing, puffing) and pulls up at the right end of
 * the rule, where it stays parked. Decorative and CSS-only: the server HTML, no-JS visitors and
 * reduced motion all simply get the train already parked (the keyframes exist only under
 * `prefers-reduced-motion: no-preference`). While the ride is showing, the Express is
 * display:none, so the trip plays when the visitor first switches to the Express.
 */
export function InkTrain() {
  return (
    <div className={styles.trainRule} data-ink-train="" aria-hidden="true">
      <div className={styles.trainRunner}>
        <svg className={styles.train} viewBox="0 0 72 26" focusable="false">
          {/* Smoke from the chimney: only seen while the train is moving. */}
          <circle className={styles.puff} cx="47" cy="6" r="2.6" />
          <circle className={styles.puff} cx="43" cy="4" r="3.2" />
          <g fill="currentColor">
            {/* Carriage, coupled behind. */}
            <rect x="2" y="9" width="20" height="10" rx="1.5" />
            <rect x="21" y="15" width="5" height="1.6" />
            {/* Locomotive: cab, boiler, chimney, cowcatcher. */}
            <rect x="25" y="6" width="12" height="13" rx="1" />
            <rect x="23.5" y="4.6" width="15" height="2" rx="1" />
            <rect x="36" y="10" width="17" height="9" rx="3" />
            <rect x="45" y="6" width="4" height="5" rx=".6" />
            <path d="M53 13l5.5 6H53z" />
          </g>
          {/* Windows: paper showing through the ink. */}
          <g fill="var(--paper)">
            <rect x="5" y="11.5" width="4" height="3.5" rx=".5" />
            <rect x="11" y="11.5" width="4" height="3.5" rx=".5" />
            <rect x="28" y="8.5" width="6" height="4.5" rx=".5" />
          </g>
          {/* Wheels, with a paper hub so they read as wheels at 16px. */}
          <g fill="currentColor" stroke="var(--paper)" strokeWidth="1">
            <circle cx="7" cy="20.5" r="2.6" />
            <circle cx="17" cy="20.5" r="2.6" />
            <circle cx="30" cy="20" r="3.2" />
            <circle cx="39.5" cy="20" r="3.2" />
            <circle cx="48.5" cy="21" r="2.4" />
          </g>
        </svg>
      </div>
    </div>
  );
}
