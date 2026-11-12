import type { Station } from "@/content/route";

type Link = NonNullable<Station["links"]>[number];

const REPO = /github|repo/i;
const LIVE = /live|demo|site|app/i;

/**
 * Sort a station's links for the on-board display: the repository becomes the "GitHub"
 * button, a live deployment / demo the "See live" button (each only if one exists, matched on
 * label or URL), and everything else stays reachable as a secondary link.
 */
export function splitLinks(links: Station["links"] = []): { live?: Link; repo?: Link; rest: Link[] } {
  const repo = links.find((l) => REPO.test(l.label) || REPO.test(l.href));
  const live = links.find((l) => l !== repo && (LIVE.test(l.label) || LIVE.test(l.href)));
  return { live, repo, rest: links.filter((l) => l !== live && l !== repo) };
}
