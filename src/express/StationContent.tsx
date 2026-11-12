import { STATIONS, type Station } from "@/content/route";
import { StationMedia } from "./StationMedia";
import { StatValue } from "./StatValue";
import styles from "./express.module.css";

/** Human labels for the small "Stop 03 · Project" eyebrow. */
const KIND_LABEL: Record<Station["kind"], string> = {
  intro: "Departure",
  internship: "Internship",
  project: "Project",
  open: "Open platform",
  end: "Terminus",
};

/** Only the two "live" states get a badge; finished stops speak through their dates. */
const STATUS_LABEL: Partial<Record<NonNullable<Station["status"]>, string>> = {
  current: "Current stop",
  upcoming: "Upcoming",
};

/**
 * Link props by destination:
 * - the resume PDF downloads (the "ticket"),
 * - http(s) links open in a new tab without handing the opener to the other site,
 * - mailto: stays a plain link.
 */
export function linkProps(href: string) {
  if (href.endsWith(".pdf")) return { download: "" };
  if (href.startsWith("http")) return { target: "_blank", rel: "noopener noreferrer" };
  return {};
}

/**
 * Everything a station says: heading, meta, tagline, body, stats, stack, links, media.
 * Deliberately layout-free (no outer margins, no <section>) so the Express page and
 * the 3D ride's StationCard can both wrap it in their own frame.
 */
export function StationContent({ station }: { station: Station }) {
  const stop = String(STATIONS.findIndex((s) => s.id === station.id)).padStart(2, "0");
  const status = station.status ? STATUS_LABEL[station.status] : undefined;

  return (
    <div className={styles.content} data-flagship={station.flagship || undefined}>
      <p className={styles.eyebrow}>
        <span>Stop {stop}</span>
        <span aria-hidden="true">·</span>
        <span>{KIND_LABEL[station.kind]}</span>
        {station.flagship && (
          <>
            <span aria-hidden="true">·</span>
            <span className={styles.flagship}>Flagship</span>
          </>
        )}
      </p>

      <h2 className={styles.name}>{station.name}</h2>

      {(station.dates || status) && (
        <p className={styles.meta}>
          {station.dates && <time>{station.dates}</time>}
          {status && (
            <span className={styles.status} data-status={station.status}>
              {status}
            </span>
          )}
        </p>
      )}

      <p className={styles.tagline}>{station.tagline}</p>

      <div className={styles.body}>
        {station.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      {station.stats && (
        <dl className={styles.stats}>
          {station.stats.map((stat) => (
            <div key={stat.label} className={styles.stat}>
              {/* Number first visually, but <dt> (the label) stays first for screen readers. */}
              <dt className={styles.statLabel}>{stat.label}</dt>
              <dd className={styles.statValue}>
                <StatValue value={stat.value} />
              </dd>
            </div>
          ))}
        </dl>
      )}

      {station.stack && (
        <ul className={styles.chips} aria-label="Stack">
          {station.stack.map((tech) => (
            <li key={tech}>{tech}</li>
          ))}
        </ul>
      )}

      {station.links && (
        <ul className={styles.links}>
          {station.links.map((link) => (
            <li key={link.href}>
              <a className={styles.button} href={link.href} {...linkProps(link.href)}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      )}

      <StationMedia media={station.media} />
    </div>
  );
}

