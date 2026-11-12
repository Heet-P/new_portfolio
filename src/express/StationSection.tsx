import type { Station } from "@/content/route";
import { StationContent } from "./StationContent";
import styles from "./express.module.css";

/**
 * One stop on the Express page: an anchorable <section id="vaani"> (hash deep links land
 * here) with a marker on the route track and the station's card.
 */
export function StationSection({ station }: { station: Station }) {
  return (
    <section
      id={station.id}
      className={styles.stop}
      data-status={station.status}
    >
      {/* The dot on the track: filled = passed, pulsing = current, dashed = upcoming. */}
      <span className={styles.marker} aria-hidden="true" />
      <div className={styles.card} data-flagship={station.flagship || undefined}>
        <StationContent station={station} />
      </div>
    </section>
  );
}
