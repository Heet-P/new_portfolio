import type { ReactNode } from "react";
import { PROFILE, STATIONS, type Station } from "@/content/route";
import { StationMedia } from "@/express/StationMedia";
import { Clipping } from "./Clipping";
import { linkProps, splitLinks } from "./links";
import { BrushTab, BrushUnderline } from "./ornaments";
import { StatValue } from "./StatValue";
import styles from "./newspaper.module.css";

/**
 * "The Project Post": one stop of the route printed as a newspaper front page.
 *
 * The same component prints every stop in both views, in three variants:
 * - `page`: the cabin's front page (full nameplate, Vol./No., edition line with the next stop),
 * - `article`: an article in the Express broadsheet (a dateline kicker instead of a nameplate),
 * - `lead`: the Express front-page lead (Departure), whose headline is the page's h1.
 * Layout adapts to its own width (container queries), not the viewport's, so the cabin's
 * framed page and the Express column can both use it.
 */

const LAST = STATIONS.length - 1;
const CABIN_CREDIT_URL = "https://sketchfab.com/3d-models/subway-interior-b7f25426ac674a9291ba092fb9fe8406";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** The edition date when a stop has no dates of its own. */
const EDITION_DATE = "Nov 2026";

/** Newspaper section a stop is filed under (the kicker above its headline). */
const SECTION: Record<Station["kind"], string> = {
  intro: "Special Edition",
  project: "Technology",
  internship: "Business",
  open: "Situations Wanted",
  end: "Classifieds",
};

/** Stamps for the two "live" states; finished stops speak through their dates. */
const STAMP: Partial<Record<NonNullable<Station["status"]>, string>> = {
  current: "Current stop",
  upcoming: "Platform open",
};

/** "09/2026" -> "Sep 2026"; "05/2026 - 06/2026" -> "May – Jun 2026"; none -> the edition date. */
export function formatDateline(dates: string | undefined): string {
  if (!dates) return EDITION_DATE;
  const month = (part: string) => {
    const m = /^(\d{2})\/(\d{4})$/.exec(part.trim());
    return m ? { mon: MONTHS[Number(m[1]) - 1], year: m[2] } : null;
  };
  const [from, to] = dates.split(" - ");
  const a = month(from);
  if (!a) return dates;
  if (to === undefined) return `${a.mon} ${a.year}`;
  const b = month(to);
  if (!b) return `${a.mon} ${a.year} – ${to.trim()}`;
  return a.year === b.year ? `${a.mon} – ${b.mon} ${b.year}` : `${a.mon} ${a.year} – ${b.mon} ${b.year}`;
}

/** How a stop is named as "the next stop": the open platform is an ad, not a stop called "Next stop". */
export function nextStopLabel(station: Station): string {
  return station.kind === "open" ? SECTION.open : station.name;
}

/* ---------- Pieces ---------- */

/**
 * The nameplate: blackletter title between two ears (each under a thin rule), then the
 * edition line between a double rule and a hairline. Shared by the cabin page and the Express.
 */
export function Nameplate({ left, right, edition }: { left: string; right: string; edition: ReactNode }) {
  return (
    <header className={styles.masthead}>
      <div className={styles.mastTop}>
        <span className={styles.ear}>{left}</span>
        <p className={styles.nameplate}>The Project Post</p>
        <span className={styles.ear}>{right}</span>
      </div>
      <p className={styles.edition}>{edition}</p>
    </header>
  );
}

/** A stop's masthead (cabin page): Vol./No. and date, and the next stop in the edition line. */
function Masthead({ station, index }: { station: Station; index: number }) {
  const next = index < LAST ? STATIONS[index + 1] : undefined;
  const status = index === 0 ? "Now departing" : index === LAST ? "End of the line" : "Now arriving";
  return (
    <Nameplate
      left={`Vol. III, No. ${index + 1}`}
      right={formatDateline(station.dates)}
      edition={
        <>
          <span>{status}</span>
          {next && <span>Next stop: {nextStopLabel(next)}</span>}
        </>
      }
    />
  );
}

/** Kicker above the headline: the section, plus (in the Express) the issue number and date. */
function Kicker({ station, index, withDate }: { station: Station; index: number; withDate: boolean }) {
  const stamp = station.status ? STAMP[station.status] : undefined;
  return (
    <p className={styles.kicker}>
      {withDate && <>No. {index + 1} · </>}
      <span className={styles.section}>{SECTION[station.kind]}</span>
      {withDate && <span className={styles.kickerDate}>{formatDateline(station.dates)}</span>}
      {stamp && (
        <span className={styles.stamp} data-status={station.status}>
          {stamp}
        </span>
      )}
    </p>
  );
}

/** The big headline; its last word gets the red brush underline. */
function Headline({ text, level }: { text: string; level: 1 | 2 }) {
  const words = text.split(" ");
  const last = words.pop();
  const Tag = level === 1 ? "h1" : "h2";
  return (
    <Tag className={styles.headline}>
      {words.length > 0 && `${words.join(" ")} `}
      <span className={styles.underlined}>
        {last}
        <BrushUnderline />
      </span>
    </Tag>
  );
}

/** Boxed "At a Glance" sidebar: each stat as a bullet line with a red square. */
function AtAGlance({ stats }: { stats: NonNullable<Station["stats"]> }) {
  return (
    <div className={styles.glance}>
      {/* The list carries the name for screen readers; the painted label is for the eye. */}
      <p className={styles.glanceLabel} aria-hidden="true">
        <BrushTab />
        <span>At a Glance</span>
      </p>
      <ul className={styles.glanceList} aria-label="At a Glance">
        {stats.map((stat) => (
          <li key={stat.label}>
            <b className={styles.glanceValue}>
              <StatValue value={stat.value} />
            </b>{" "}
            {stat.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Body({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className={styles.body}>
      {paragraphs.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </div>
  );
}

/** Tech stack as ink-stamped chips. */
function Stack({ items }: { items: string[] }) {
  return (
    <ul className={styles.stack} aria-label="Stack">
      {items.map((tech) => (
        <li key={tech}>{tech}</li>
      ))}
    </ul>
  );
}

/** Arrow for links that leave the site (decorative: the link text carries the name). */
const Out = () => (
  <span className={styles.out} aria-hidden="true">
    ↗
  </span>
);

/** One ink-stamp button. External links open in a new tab (noopener), the PDF downloads. */
function Stamp({ href, primary, children }: { href: string; primary?: boolean; children: ReactNode }) {
  const external = href.startsWith("http");
  return (
    <li>
      <a className={styles.action} data-primary={primary || undefined} href={href} {...linkProps(href)}>
        {children}
        {external && <Out />}
      </a>
    </li>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <ul className={styles.actions}>{children}</ul>;
}

/**
 * The resume, handed over as a ticket you clip from the paper. The whole ticket is the
 * download link; it lifts a little on hover and gives on press (transform only).
 */
function Ticket() {
  return (
    <a className={styles.ticket} href={PROFILE.resume} download="">
      <span className={styles.ticketMain}>
        <span className={styles.ticketKicker} aria-hidden="true">
          Admit one · The Project Post
        </span>
        <span className={styles.ticketTitle}>Download resume</span>
        <span className={styles.ticketMeta} aria-hidden="true">
          {PROFILE.name} · PDF
        </span>
      </span>
      <span className={styles.ticketStub} aria-hidden="true">
        <span>No.</span>
        <span className={styles.ticketNo}>0816</span>
      </span>
    </a>
  );
}

/** Skills, grouped as on the resume (spec: a compact strip at Departure, not a stop of its own). */
function Skills() {
  return (
    <dl className={styles.skills} data-testid="skills">
      {Object.entries(PROFILE.skills).map(([group, items]) => (
        <div key={group} className={styles.skillGroup}>
          <dt>{group}</dt>
          <dd>{items.join(" · ")}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------- Per-kind stories ---------- */

/** A project or the internship: lede (headline, deck, At a Glance) beside the clipping, then the story. */
function ProjectStory({ station, level }: { station: Station; level: 1 | 2 }) {
  const { live, demos, repo, rest } = splitLinks(station.links);
  // Text comes from the kind of link, not its label; the first one is the red stamp.
  const primary = [
    ...(live ? [{ link: live, text: "See live" }] : []),
    ...demos.map((link, i) => ({ link, text: i === 0 ? "Watch demo" : `Watch demo ${i + 1}` })),
    ...(repo ? [{ link: repo, text: "GitHub" }] : []),
  ];
  return (
    <>
      <div className={styles.lede}>
        <div className={styles.ledeText}>
          <Headline text={station.name} level={level} />
          <p className={styles.deck}>{station.tagline}</p>
          {station.stats && <AtAGlance stats={station.stats} />}
        </div>
        <Clipping id={station.id} />
      </div>
      <Body paragraphs={station.body} />
      <StationMedia media={station.media} />
      {station.stack && <Stack items={station.stack} />}
      {primary.length + rest.length > 0 && (
        <Actions>
          {primary.map(({ link, text }, i) => (
            <Stamp key={link.href} href={link.href} primary={i === 0}>
              {text}
            </Stamp>
          ))}
          {rest.map((l) => (
            <Stamp key={l.href} href={l.href}>
              {l.label}
            </Stamp>
          ))}
        </Actions>
      )}
    </>
  );
}

/** Departure: the Special Edition about Heet. */
function DepartureStory({ station, level }: { station: Station; level: 1 | 2 }) {
  return (
    <>
      <div className={styles.lede}>
        <div className={styles.ledeText}>
          <Headline text={PROFILE.name} level={level} />
          <p className={styles.deck}>{PROFILE.role}</p>
          {/* Straight after the deck, so the resume is reachable without scrolling. */}
          <Actions>
            <Stamp href={PROFILE.resume} primary>
              Download resume
            </Stamp>
            <Stamp href={`mailto:${PROFILE.email}`}>Email</Stamp>
            <Stamp href={PROFILE.github}>GitHub</Stamp>
            <Stamp href={PROFILE.linkedin}>LinkedIn</Stamp>
          </Actions>
          {station.stats && <AtAGlance stats={station.stats} />}
        </div>
        <Clipping id={station.id} />
      </div>
      <Body paragraphs={station.body} />
      <Skills />
    </>
  );
}

/** The open platform: a "Situations Wanted" classified, the next stop could be the reader's team. */
function NextStory({ station, level }: { station: Station; level: 1 | 2 }) {
  return (
    <div className={styles.lede}>
      <div className={`${styles.ledeText} ${styles.ad}`}>
        <Headline text={station.tagline} level={level} />
        <Body paragraphs={station.body} />
        <Actions>
          <Stamp href={`mailto:${PROFILE.email}`} primary>
            Email me
          </Stamp>
          <Stamp href={PROFILE.linkedin}>LinkedIn</Stamp>
        </Actions>
      </div>
      <Clipping id={station.id} />
    </div>
  );
}

/** End of the line: classifieds with the contact ad, the resume ticket and the credits. */
function TerminusStory({ station, level }: { station: Station; level: 1 | 2 }) {
  return (
    <>
      <div className={styles.lede}>
        <div className={styles.ledeText}>
          <Headline text={station.tagline} level={level} />
          <Body paragraphs={station.body} />
        </div>
        <Clipping id={station.id} />
      </div>
      <div className={styles.classifieds}>
        <div className={styles.ad}>
          <p className={styles.adTitle}>Contact</p>
          <Actions>
            <Stamp href={`mailto:${PROFILE.email}`} primary>
              Email {PROFILE.email}
            </Stamp>
            <Stamp href={PROFILE.linkedin}>LinkedIn</Stamp>
            <Stamp href={PROFILE.github}>GitHub</Stamp>
          </Actions>
        </div>
        <div className={styles.ad}>
          <p className={styles.adTitle}>Clip &amp; keep</p>
          <Ticket />
        </div>
      </div>
      <p className={styles.credits}>
        Cabin:{" "}
        <a href={CABIN_CREDIT_URL} target="_blank" rel="noopener noreferrer">
          Subway_[interior]
        </a>{" "}
        by Comicaroid (CC BY 4.0) · Train via TurboSquid
      </p>
    </>
  );
}

export function FrontPage({
  station,
  index,
  variant = "page",
}: {
  station: Station;
  index: number;
  variant?: "page" | "article" | "lead";
}) {
  const level = variant === "lead" ? 1 : 2;
  let story: ReactNode;
  if (station.kind === "intro") story = <DepartureStory station={station} level={level} />;
  else if (station.kind === "open") story = <NextStory station={station} level={level} />;
  else if (station.kind === "end") story = <TerminusStory station={station} level={level} />;
  else story = <ProjectStory station={station} level={level} />;

  return (
    <article className={styles.front} data-variant={variant} data-kind={station.kind}>
      {variant === "page" && <Masthead station={station} index={index} />}
      <Kicker station={station} index={index} withDate={variant !== "page"} />
      {story}
    </article>
  );
}
