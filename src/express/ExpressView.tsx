import { PROFILE, STATIONS } from "@/content/route";
import { Nameplate } from "@/newspaper/FrontPage";
import { StationSection } from "./StationSection";
import styles from "./express.module.css";

/**
 * The Express: "The Project Post" as one plain, fast, readable broadsheet with ALL the content.
 * It is the first paint, the no-JS / SEO / reduced-motion experience, and the recruiter fast
 * lane. The nameplate tops the page; Departure is the front-page lead (Heet's name is its h1),
 * then every stop follows as an article in ride order (projects first, then Work Experience,
 * the Situations Wanted ad and the Terminus classifieds). The 3D ride hides it via the `hidden`
 * attribute on its wrapper, so nothing here may depend on the ride being present.
 */
export function ExpressView() {
  return (
    <main id="express" className={styles.page}>
      <Nameplate
        left="Vol. III · Express edition"
        right="Nov 2026"
        edition={
          <>
            <span>The portfolio of {PROFILE.name}</span>
            <span>{STATIONS.length} stops, one page</span>
          </>
        }
      />

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
