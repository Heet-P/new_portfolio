import type { Station } from "@/content/route";
import { FrontPage } from "@/newspaper/FrontPage";
import styles from "./express.module.css";

/**
 * One stop in the Express broadsheet: an anchorable <section id="vaani"> (hash deep links land
 * here) holding the stop's article. Departure is printed as the front-page lead. Articles here
 * get the Express's whimsy (the cabin's copy of the same page does not).
 */
export function StationSection({ station, index }: { station: Station; index: number }) {
  return (
    <section id={station.id} className={styles.stop} data-status={station.status}>
      <FrontPage station={station} index={index} variant={index === 0 ? "lead" : "article"} whimsy />
    </section>
  );
}
