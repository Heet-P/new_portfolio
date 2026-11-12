import type { Station } from "@/content/route";

export type Link = NonNullable<Station["links"]>[number];

/** Labels name what a link is; hosts only for the two sites whose links are unambiguous. */
const REPO_LABEL = /github|repo/i;
const LIVE_LABEL = /live|site|app/i;
const DEMO_LABEL = /demo|video|watch/i;

function host(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return ""; // relative or mailto: no host
  }
}

const isGitHub = (l: Link) => REPO_LABEL.test(l.label) || host(l.href) === "github.com";
const isYouTube = (l: Link) => ["youtube.com", "m.youtube.com", "youtu.be"].includes(host(l.href));

/**
 * Sort a station's links for the on-board display into its primary actions, matched on the
 * link's label (plus the GitHub / YouTube hosts), never on arbitrary URL text:
 * - `live`: the first "See live" link (label mentions live / site / app),
 * - `demos`: every "Watch demo" link (label mentions demo / video / watch, or a YouTube URL),
 * - `repo`: the first "GitHub" link (label mentions GitHub / repo, or a github.com URL),
 * and everything else stays reachable as a secondary link (`rest`).
 * Order of checks: GitHub, then YouTube, then the live label, then the demo label, so
 * "Live demo" on a deployed site is "See live" while the same label on YouTube is a demo.
 */
export function splitLinks(links: Station["links"] = []): { live?: Link; demos: Link[]; repo?: Link; rest: Link[] } {
  let live: Link | undefined;
  let repo: Link | undefined;
  const demos: Link[] = [];
  const rest: Link[] = [];
  for (const l of links) {
    if (isGitHub(l)) {
      if (repo) rest.push(l);
      else repo = l;
    } else if (isYouTube(l)) demos.push(l);
    else if (LIVE_LABEL.test(l.label)) {
      if (live) rest.push(l);
      else live = l;
    } else if (DEMO_LABEL.test(l.label)) demos.push(l);
    else rest.push(l);
  }
  return { live, demos, repo, rest };
}
