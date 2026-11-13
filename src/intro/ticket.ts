import { STATIONS, type Station, type StationId } from "@/content/route";
import type { RideMode } from "@/ride/rideStore";

/*
 * The ticket-printer intro, as plain data and decisions (no React): when it shows, what the
 * printed ticket says, and the paper feed's keyframes. The components in this folder only draw it.
 */

/** sessionStorage key: set once the visitor has boarded (or left) through the intro this session. */
export const INTRO_SEEN_KEY = "nt-intro-seen";

/**
 * Whether the ticket printer greets this visitor. Only a fresh ride that starts at the top:
 * - the initial mode is the ride (Express already covers no-WebGL, and reduced motion without a
 *   saved choice; a reduced-motion visitor who chose the ride still gets it, without motion);
 * - the URL has no station in it (empty, a bare "#", or "#departure"): a deep link goes straight
 *   to its stop, and so does any other hash (a stale or mistyped link was still a link);
 * - not already seen in this browser session.
 */
export function shouldShowIntro(env: { mode: RideMode; hash: string; seen: boolean }): boolean {
  if (env.mode !== "ride" || env.seen) return false;
  return env.hash === "" || env.hash === "#" || env.hash === "#departure";
}

/** Session storage, or undefined where even touching it throws (some private modes). */
function sessionStore(storage?: Storage): Storage | undefined {
  try {
    return storage ?? window.sessionStorage;
  } catch {
    return undefined;
  }
}

/** True once the intro was dismissed this session. Unreadable storage reads as "not seen". */
export function readIntroSeen(storage?: Storage): boolean {
  try {
    return sessionStore(storage)?.getItem(INTRO_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/** Remembers the dismissal for this session; silently does nothing if storage is blocked. */
export function markIntroSeen(storage?: Storage): void {
  try {
    sessionStore(storage)?.setItem(INTRO_SEEN_KEY, "1");
  } catch {
    // Not remembered: a reload would show the ticket again, which is harmless.
  }
}

/** Everything printed on the machine and the ticket, apart from the route and the date. */
export const TICKET = {
  plate: "Night Train",
  screenRoute: "NIGHT TRAIN · DEPARTURE → TERMINUS",
  passenger: "Visitor",
  fare: "one curious scroll",
  header: "THE NIGHT TRAIN",
  admit: "ADMIT ONE",
  seat: "Window",
  stamp: "VALID FOR ONE JOURNEY",
  stub: "PASSENGER STUB",
} as const;

/** One stop on the ticket's route list. */
export interface TicketStop {
  id: StationId;
  name: string;
  /** Where the train is now (the route's "current" project): circled in red. */
  current: boolean;
  /** Not built yet: drawn dashed, like the route map. */
  upcoming: boolean;
}

/** The ticket's route: every station, in ride order, with the route map's markers. */
export function ticketStops(stations: Station[] = STATIONS): TicketStop[] {
  return stations.map((s) => ({
    id: s.id,
    name: s.name,
    current: s.status === "current",
    upcoming: s.status === "upcoming",
  }));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * The date as a ticket punch prints it: "13 Nov 2026". Built by hand rather than with
 * toLocaleDateString so every browser and locale prints exactly the same thing.
 */
export function formatTicketDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Every line of text the machine and the ticket print (used by tests: nothing private on it). */
export function ticketLines(date: Date): string[] {
  return [
    TICKET.plate,
    TICKET.screenRoute,
    `Passenger: ${TICKET.passenger}`,
    `Fare: ${TICKET.fare}`,
    TICKET.header,
    TICKET.admit,
    ...ticketStops().map((s) => s.name),
    formatTicketDate(date),
    TICKET.seat,
    TICKET.stamp,
    TICKET.stub,
  ];
}

/**
 * The paper feed, ported unchanged from Heet's reference printer: the ticket starts tucked up
 * inside the slot (2px showing) and comes out in 10 short moves with brief holds in between,
 * like a dot-matrix head finishing each line. Played linearly over `seconds` at `times`
 * (the even-to-odd spans are the moves; the printer chatter follows them).
 */
export const FEED = {
  seconds: 1.75,
  transforms: [
    "translateY(calc(-100% + 2px))",
    "translateY(-91%)",
    "translateY(-91%)",
    "translateY(-81%)",
    "translateY(-81%)",
    "translateY(-70%)",
    "translateY(-70%)",
    "translateY(-58%)",
    "translateY(-58%)",
    "translateY(-45%)",
    "translateY(-45%)",
    "translateY(-32%)",
    "translateY(-32%)",
    "translateY(-20%)",
    "translateY(-20%)",
    "translateY(-10%)",
    "translateY(-10%)",
    "translateY(-3%)",
    "translateY(-3%)",
    "translateY(0%)",
  ],
  times: [0, 0.075, 0.105, 0.18, 0.21, 0.285, 0.315, 0.39, 0.42, 0.495, 0.525, 0.6, 0.63, 0.705, 0.735, 0.81, 0.84, 0.915, 0.945, 1],
} as const;

/**
 * The intro's clock (seconds). Processing shows at once; printing starts when the 3D scene has
 * drawn its first frame, but never before `minProcessing` (so the machine is read, not flashed)
 * and never after `maxProcessing` (a slow GPU doesn't hold the visitor). The ticket is complete
 * `settle` after the feed ends: 1.2 + 1.85 = 3.05 s at the earliest, 4 + 1.85 = 5.85 s at most.
 */
export const INTRO_TIMING = {
  minProcessing: 1.2,
  maxProcessing: 4,
  settle: 0.1,
  /** The ticket slides up and away and the night fades out when boarding. */
  exit: 0.36,
} as const;
