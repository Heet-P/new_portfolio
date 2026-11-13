import { PROFILE, STATIONS } from "@/content/route";
import { EDITION_DATE, EDITION_VOLUME } from "@/newspaper/edition";
import { Nameplate } from "@/newspaper/FrontPage";
import { InkTrain } from "./InkTrain";
import { StationSection } from "./StationSection";
import styles from "./express.module.css";

/**
 * The Express: "The Project Post" as one plain, fast, readable broadsheet with ALL the content.
 * It is the first paint, the no-JS / SEO / reduced-motion experience, and the recruiter fast
 * lane. The nameplate tops the page; Departure is the front-page lead (Heet's name is its h1),
 * then every stop follows as an article in ride order (projects first, then Work Experience,
 * the Situations Wanted ad and the Terminus classifieds). The 3D ride hides it via the `hidden`
 * attribute on its wrapper, so nothing here may depend on the ride being present.
 *
 * Whimsy (Express only, all off under reduced motion): the nameplate goes ka-chunk when
 * clicked, a little ink train chugs along the margin rule once, and every article is printed
 * with `whimsy` (see FrontPage) for its springy stamps, lifting clippings and inking-in.
 */
export function ExpressView() {
  return (
    <main id="express" className={styles.page}>
      <Nameplate
        whimsy
        left={`${EDITION_VOLUME} · Express edition`}
        right={EDITION_DATE}
        edition={
          <>
            <span>The portfolio of {PROFILE.name}</span>
            <span>{STATIONS.length} stops, one page</span>
          </>
        }
      />
      <InkTrain />

      {/* The route: every stop as an article, in ride order. */}
      <ol className={styles.route} aria-label="Route">
        {STATIONS.map((station, index) => (
          <li key={station.id}>
            <StationSection station={station} index={index} />
          </li>
        ))}
      </ol>
    </main>
  );
}
