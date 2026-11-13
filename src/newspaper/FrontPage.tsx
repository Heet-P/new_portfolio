import type { ReactNode } from "react";
import { PROFILE, STATIONS, type Station } from "@/content/route";
import { StationMedia } from "@/express/StationMedia";
import { TapLink } from "@/sound/TapLink";
import { Clipping } from "./Clipping";
import { deckOf, formatDateline, headlineOf, nextStopLabel, SECTION } from "./edition";
import { linkProps, splitLinks } from "./links";
import { BrushTab, BrushUnderline, InkSpeckles, StopPress } from "./ornaments";
import { PressNameplate } from "./PressNameplate";
import { StatValue } from "./StatValue";
import { TicketLink } from "./TicketLink";
import { WhimsyArticle } from "./WhimsyArticle";
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
 *
 * `whimsy` (the Express only; the cabin's page stays as it is): springy ink-stamp buttons and
 * resume ticket, clippings that lift and lean toward the cursor, the headline's brush stroke
 * drawing itself in, a wobbling At a Glance tab, ink speckles on flagship stats, and a Stop
 * press stamp on the current stop. All of it is keyed off `data-whimsy` / `data-ink` in
 * newspaper.module.css and switched off under reduced motion.
 */

export { formatDateline, nextStopLabel } from "./edition";

const LAST = STATIONS.length - 1;
const CABIN_CREDIT_URL = "https://sketchfab.com/3d-models/subway-interior-b7f25426ac674a9291ba092fb9fe8406";

/** Stamps for the two "live" states; finished stops speak through their dates. */
const STAMP: Partial<Record<NonNullable<Station["status"]>, string>> = {
  current: "Current stop",
  upcoming: "Platform open",
};

/* ---------- Pieces ---------- */

/**
 * The nameplate: blackletter title between two ears (each under a thin rule), then the
 * edition line between a double rule and a hairline. Shared by the cabin page and the Express.
 */
export function Nameplate({
  left,
  right,
  edition,
  whimsy = false,
}: {
  left: string;
  right: string;
  edition: ReactNode;
  /** Express: the title goes ka-chunk when clicked (see PressNameplate). */
  whimsy?: boolean;
}) {
  return (
    <header className={styles.masthead}>
      <div className={styles.mastTop}>
        <span className={styles.ear}>{left}</span>
        {whimsy ? <PressNameplate /> : <p className={styles.nameplate}>The Project Post</p>}
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

/**
 * The big headline; its last word gets the red brush underline. `drawId` (Express) lets the
 * stroke draw itself in when the article scrolls into view.
 */
function Headline({ text, level, drawId }: { text: string; level: 1 | 2; drawId?: string }) {
  const words = text.split(" ");
  const last = words.pop();
  const Tag = level === 1 ? "h1" : "h2";
  return (
    <Tag className={styles.headline}>
      {words.length > 0 && `${words.join(" ")} `}
      <span className={styles.underlined}>
        {last}
        <BrushUnderline drawId={drawId} />
      </span>
    </Tag>
  );
}

/**
 * Boxed "At a Glance" sidebar: each stat as a bullet line with a red square. `speckles`
 * (Express, flagship projects): the lead stat spatters ink specks on hover.
 */
function AtAGlance({ stats, speckles = false }: { stats: NonNullable<Station["stats"]>; speckles?: boolean }) {
  return (
    <div className={styles.glance}>
      {/* The list carries the name for screen readers; the painted label is for the eye. */}
      <p className={styles.glanceLabel} aria-hidden="true">
        <BrushTab />
        <span>At a Glance</span>
      </p>
      <ul className={styles.glanceList} aria-label="At a Glance">
        {stats.map((stat, i) => (
          <li key={stat.label}>
            <b className={styles.glanceValue}>
              <StatValue value={stat.value} />
              {speckles && i === 0 && <InkSpeckles />}
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

/** One ink-stamp button (soft tap when sound is on). External links open in a new tab (noopener), the PDF downloads. */
function Stamp({ href, primary, children }: { href: string; primary?: boolean; children: ReactNode }) {
  const external = href.startsWith("http");
  return (
    <li>
      <TapLink className={styles.action} data-primary={primary || undefined} href={href} {...linkProps(href)}>
        {children}
        {external && <Out />}
      </TapLink>
    </li>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <ul className={styles.actions}>{children}</ul>;
}

/**
 * The resume, handed over as a ticket you clip from the paper. The whole ticket is the
 * download link; it lifts a little on hover and gives on press (transform only). In the
 * Express (`whimsy`) its stub wiggles on hover and gets punched when the ticket is taken.
 */
function Ticket({ whimsy }: { whimsy: boolean }) {
  const Link = whimsy ? TicketLink : TapLink;
  return (
    <Link className={styles.ticket} href={PROFILE.resume} download="">
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
        {whimsy && <span className={styles.ticketPunch} />}
      </span>
    </Link>
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

/** What every story gets: the stop, its heading level, and whether the Express whimsy is on. */
interface StoryProps {
  station: Station;
  level: 1 | 2;
  whimsy: boolean;
  /** Load priority of the stop's clipping (undefined = lazy: below the fold). */
  art?: "eager" | "high";
}

/** The headline's brush-stroke mask id: unique per stop, and only printed in the Express. */
const drawIdOf = ({ station, whimsy }: StoryProps) => (whimsy ? `ink-${station.id}` : undefined);

/** A project or the internship: lede (headline, deck, At a Glance) beside the clipping, then the story. */
function ProjectStory(props: StoryProps) {
  const { station, level, whimsy } = props;
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
          <Headline text={headlineOf(station)} level={level} drawId={drawIdOf(props)} />
          <p className={styles.deck}>{deckOf(station)}</p>
          {station.stats && <AtAGlance stats={station.stats} speckles={whimsy && station.flagship} />}
        </div>
        {/* The current stop's clipping gets the Stop press stamp slammed onto it. */}
        <Clipping id={station.id} whimsy={whimsy} priority={props.art}>
          {whimsy && station.status === "current" && <StopPress />}
        </Clipping>
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
function DepartureStory(props: StoryProps) {
  const { station, level, whimsy } = props;
  return (
    <>
      <div className={styles.lede}>
        <div className={styles.ledeText}>
          <Headline text={headlineOf(station)} level={level} drawId={drawIdOf(props)} />
          <p className={styles.deck}>{deckOf(station)}</p>
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
        <Clipping id={station.id} whimsy={whimsy} priority={props.art} />
      </div>
      <Body paragraphs={station.body} />
      <Skills />
    </>
  );
}

/** The open platform: a "Situations Wanted" classified, the next stop could be the reader's team. */
function NextStory(props: StoryProps) {
  const { station, level, whimsy } = props;
  return (
    <div className={styles.lede}>
      <div className={`${styles.ledeText} ${styles.ad}`}>
        <Headline text={headlineOf(station)} level={level} drawId={drawIdOf(props)} />
        <Body paragraphs={station.body} />
        <Actions>
          <Stamp href={`mailto:${PROFILE.email}`} primary>
            Email me
          </Stamp>
          <Stamp href={PROFILE.linkedin}>LinkedIn</Stamp>
        </Actions>
      </div>
      <Clipping id={station.id} whimsy={whimsy} priority={props.art} />
    </div>
  );
}

/** End of the line: classifieds with the contact ad, the resume ticket and the credits. */
function TerminusStory(props: StoryProps) {
  const { station, level, whimsy } = props;
  return (
    <>
      {/* Contact under the notice, the ticket ad above the clipping: both in the first view. */}
      <div className={styles.lede}>
        <div className={styles.ledeText}>
          <Headline text={headlineOf(station)} level={level} drawId={drawIdOf(props)} />
          <Body paragraphs={station.body} />
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
        </div>
        <div>
          <div className={styles.ad}>
            <p className={styles.adTitle}>Clip &amp; keep</p>
            <Ticket whimsy={whimsy} />
          </div>
          <div className={styles.clipBelow}>
            <Clipping id={station.id} whimsy={whimsy} priority={props.art} />
          </div>
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
  whimsy = false,
}: {
  station: Station;
  index: number;
  variant?: "page" | "article" | "lead";
  /** The Express's playful micro-interactions (never in the cabin). */
  whimsy?: boolean;
}) {
  // Above the fold: the Express lead (the page's largest paint) and the cabin's one page.
  const art = variant === "lead" ? "high" : variant === "page" ? "eager" : undefined;
  const props: StoryProps = { station, level: variant === "lead" ? 1 : 2, whimsy, art };
  let story: ReactNode;
  if (station.kind === "intro") story = <DepartureStory {...props} />;
  else if (station.kind === "open") story = <NextStory {...props} />;
  else if (station.kind === "end") story = <TerminusStory {...props} />;
  else story = <ProjectStory {...props} />;

  const content = (
    <>
      {variant === "page" && <Masthead station={station} index={index} />}
      <Kicker station={station} index={index} withDate={variant !== "page"} />
      {story}
    </>
  );

  // The cabin's page stays a plain <article>; the Express's inks in as it scrolls into view.
  if (!whimsy) {
    return (
      <article className={styles.front} data-variant={variant} data-kind={station.kind}>
        {content}
      </article>
    );
  }
  return (
    <WhimsyArticle
      className={styles.front}
      data-variant={variant}
      data-kind={station.kind}
      data-whimsy=""
      thunk={station.status === "current"}
    >
      {content}
    </WhimsyArticle>
  );
}
