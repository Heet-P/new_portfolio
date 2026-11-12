import { PROFILE, STATIONS } from "@/content/route";
import { StationSection } from "./StationSection";
import { linkProps } from "./StationContent";
import styles from "./express.module.css";

/** The hero's quick actions: everything a recruiter needs without scrolling. */
const QUICK_LINKS = [
  { label: "Download resume", href: PROFILE.resume, primary: true },
  { label: "Email", href: `mailto:${PROFILE.email}` },
  { label: "GitHub", href: PROFILE.github },
  { label: "LinkedIn", href: PROFILE.linkedin },
];

/**
 * The Express: a plain, fast, readable single page with ALL the content.
 * It is the first paint, the no-JS / SEO / reduced-motion experience, and the
 * recruiter fast lane. The 3D ride (later tasks) hides it via the `hidden` attribute
 * on #express, so nothing here may depend on the ride being present.
 */
export function ExpressView() {
  return (
    <main id="express" className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.kicker}>
          <span className={styles.lamp} aria-hidden="true" />
          Night Train · Express
        </p>
        <h1 className={styles.title}>{PROFILE.name}</h1>
        <p className={styles.role}>{PROFILE.role}</p>

        <ul className={styles.links}>
          {QUICK_LINKS.map((link) => (
            <li key={link.href}>
              <a
                className={styles.button}
                data-primary={link.primary || undefined}
                href={link.href}
                {...linkProps(link.href)}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Skills live here as a compact strip (spec: not a station of their own). */}
        <dl className={styles.skills} data-testid="skills">
          {Object.entries(PROFILE.skills).map(([group, items]) => (
            <div key={group} className={styles.skillGroup}>
              <dt>{group}</dt>
              <dd>
                <ul className={styles.chips}>
                  {items.map((skill) => (
                    <li key={skill}>{skill}</li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      </header>

      {/* The route: one track down the page, a stop per station, in ride order. */}
      <ol className={styles.route} aria-label="Route">
        {STATIONS.map((station) => (
          <li key={station.id}>
            <StationSection station={station} />
          </li>
        ))}
      </ol>
    </main>
  );
}
