import { PROFILE, type Station } from "@/content/route";

/**
 * The newspaper's editorial vocabulary, as pure data and functions: shared by the HTML front
 * page (FrontPage) and the 3D newspaper's printed texture in the cabin (scene/cabin/print).
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** The edition date when a stop has no dates of its own. */
const EDITION_DATE = "Nov 2026";

/** Newspaper section a stop is filed under (the kicker above its headline). */
export const SECTION: Record<Station["kind"], string> = {
  intro: "Special Edition",
  project: "Technology",
  internship: "Business",
  open: "Situations Wanted",
  end: "Classifieds",
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


/** The front page's big headline: Heet's name at Departure, the notice's phrase for the ads. */
export function headlineOf(station: Station): string {
  if (station.kind === "intro") return PROFILE.name;
  if (station.kind === "open" || station.kind === "end") return station.tagline;
  return station.name;
}

/** The italic deck under the headline (the ads have none: their phrase is the headline). */
export function deckOf(station: Station): string | undefined {
  if (station.kind === "intro") return PROFILE.role;
  if (station.kind === "open" || station.kind === "end") return undefined;
  return station.tagline;
}
