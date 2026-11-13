"use client";

import { AnimatePresence, motion } from "motion/react";
import { type ComponentPropsWithoutRef, createContext, type ReactNode, useContext } from "react";
import { FEED } from "./ticket";
import styles from "./TicketPrinter.module.css";

/*
 * A ticket machine that prints a ticket: a compound component ported from Heet's reference
 * receipt printer (media-inbox/ticket-printer). The mechanics are kept as they were: the three
 * stages, the stepped paper feed (keyframes + times, 1.75 s), the curves, the zig-zag tear and
 * the status crossfade. The look is the Night Train's newspaper (CSS module); Tailwind, the
 * icon set and the textures of the reference are replaced by CSS and inline SVG.
 *
 *   <TicketPrinter.Root stage>
 *     <TicketPrinter.Machine> <Header/> <Screen> ... <Status/> </Screen> </Machine>
 *     <TicketPrinter.Output> <Paper> ...the ticket... </Paper> </Output>
 *   </TicketPrinter.Root>
 */

export type TicketPrinterStage = "processing" | "printing" | "complete";
export type TicketFeedMotion = "smooth" | "stepped";

type RootProps = Omit<ComponentPropsWithoutRef<"section">, "children"> & {
  /** false = every stage change is instant (reduced motion). */
  animate?: boolean;
  children: ReactNode;
  /** The paper comes out one line at a time ("stepped", the default) or in one glide. */
  feedMotion?: TicketFeedMotion;
  /**
   * How a jump to "complete" lets the rest of the paper out: "feed" = the reference's 1.75 s
   * ease-in-out; "fast" = 0.2 s ease-out (the visitor pressed Skip and is waiting on it).
   */
  settle?: "feed" | "fast";
  stage: TicketPrinterStage;
};

type StatusProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  /** Custom status content; defaults to the stage's label. */
  children?: ReactNode;
};

type PrinterContext = { animate: boolean; feedMotion: TicketFeedMotion; settle: "feed" | "fast"; stage: TicketPrinterStage };

const Context = createContext<PrinterContext | null>(null);

/** Emil's curves (the same as --ease-out / --ease-in-out in globals.css). */
const easeOut = [0.23, 1, 0.32, 1] as const;
const easeInOut = [0.77, 0, 0.175, 1] as const;

/*
 * The torn bottom edge: 40 teeth, 4px deep, as one polygon. It runs along the top edge, down
 * the right side, then zig-zags right to left along the bottom (points alternate between the
 * very bottom and 4px above it).
 */
const TOOTH_COUNT = 40;
const TOOTH_DEPTH = 4;
const toothPoints = Array.from({ length: TOOTH_COUNT * 2 }, (_, i) => {
  const x = 100 - ((i + 1) * 100) / (TOOTH_COUNT * 2);
  const y = i % 2 === 0 ? "100%" : `calc(100% - ${TOOTH_DEPTH}px)`;
  return `${x}% ${y}`;
}).join(", ");
const tornEdge = `polygon(0 0, 100% 0, 100% calc(100% - ${TOOTH_DEPTH}px), ${toothPoints})`;

/** What the screen says at each stage (Night Train wording). */
export const STATUS_LABELS: Record<TicketPrinterStage, string> = {
  processing: "Checking the timetable…",
  printing: "Printing your ticket…",
  complete: "Ticket ready — all aboard",
};

/** Joins class names, skipping empty ones. */
const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

function usePrinter(part: string): PrinterContext {
  const context = useContext(Context);
  if (!context) throw new Error(`${part} must be used inside TicketPrinter.Root.`);
  return context;
}

function Root({ "aria-label": label = "Ticket printer", animate = true, children, className, feedMotion = "stepped", settle = "feed", stage, ...props }: RootProps) {
  return (
    <Context.Provider value={{ animate, feedMotion, settle, stage }}>
      <section aria-label={label} className={cx(styles.root, className)} data-stage={stage} {...props}>
        {children}
      </section>
    </Context.Provider>
  );
}

/** The enamel body. The paper slot sits along its bottom edge, above everything inside. */
function Machine({ children, className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cx(styles.machine, className)} {...props}>
      {children}
      <div aria-hidden="true" className={styles.slot} />
    </div>
  );
}

function Header({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cx(styles.header, className)} {...props} />;
}

/** The ink-dot display: glowing type on a dark dot grid, with a vignette over the glass. */
function Screen({ children, className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cx(styles.screen, className)} {...props}>
      <div className={styles.screenContent}>{children}</div>
    </div>
  );
}

/** A spinning arc while working, a check in a circle once the ticket is out (inline SVG). */
function StatusIndicator({ animate, stage }: { animate: boolean; stage: TicketPrinterStage }) {
  const complete = stage === "complete";
  // The icon swap is a small scale + fade (never from scale 0), as in the reference.
  const swap = {
    animate: { opacity: 1, transform: "scale(1)" },
    exit: { opacity: animate ? 0 : 1, transform: animate ? "scale(0.96)" : "scale(1)" },
    initial: { opacity: animate ? 0 : 1, transform: animate ? "scale(0.94)" : "scale(1)" },
    transition: { duration: animate ? 0.16 : 0, ease: easeOut },
  };
  return (
    <span aria-hidden="true" className={styles.indicator}>
      <AnimatePresence initial={false} mode="sync">
        {complete ? (
          <motion.span key="complete" className={cx(styles.icon, styles.iconDone)} {...swap}>
            <svg viewBox="0 0 20 20" width="18" height="18" focusable="false">
              <circle cx="10" cy="10" r="9" fill="currentColor" />
              <path d="M5.8 10.4l2.7 2.7 5.7-6" fill="none" stroke="#16120e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.span>
        ) : (
          <motion.span key="working" className={styles.icon} {...swap}>
            <svg className={animate ? styles.spin : undefined} viewBox="0 0 20 20" width="18" height="18" focusable="false">
              <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
              <path d="M10 2.5a7.5 7.5 0 0 1 7.5 7.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/**
 * The stage, announced politely. Labels crossfade in place: the old one drifts up 4px and fades,
 * the new one rises from 4px below (0.18 s ease-out), stacked in one grid cell so nothing jumps.
 */
function Status({ children, className, ...props }: StatusProps) {
  const { animate, stage } = usePrinter("TicketPrinter.Status");
  return (
    <div className={cx(styles.status, className)} {...props}>
      <StatusIndicator animate={animate} stage={stage} />
      <div aria-live="polite" className={styles.statusText} role="status">
        <AnimatePresence initial={false} mode="sync">
          <motion.div
            key={stage}
            className={styles.statusLabel}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: animate ? 0 : 1, transform: animate ? "translateY(-4px)" : "translateY(0px)" }}
            initial={{ opacity: animate ? 0 : 1, transform: animate ? "translateY(4px)" : "translateY(0px)" }}
            transition={{ duration: animate ? 0.18 : 0, ease: easeOut }}
          >
            {children ?? STATUS_LABELS[stage]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** The ticket stock: warm paper, its bottom edge torn along the zig-zag. */
function Paper({ className, style, ...props }: ComponentPropsWithoutRef<"article">) {
  return <article className={cx(styles.paper, className)} style={{ clipPath: tornEdge, ...style }} {...props} />;
}

/**
 * Where the ticket comes out. It tucks in under the machine's slot (overlapping the machine by
 * 16px) and clips the paper, so the ticket seems to emerge from the slot. Processing: hidden
 * up inside. Printing: the stepped feed (linear between the reference's keyframes). Complete:
 * fully out. A soft dark line under the slot shades the paper as it leaves the machine.
 */
function Output({ children, className, ...props }: ComponentPropsWithoutRef<"div">) {
  const { animate, feedMotion, settle, stage } = usePrinter("TicketPrinter.Output");
  const visible = stage !== "processing";
  const stepped = feedMotion === "stepped" && stage === "printing" && animate;
  const fast = settle === "fast" && stage === "complete";
  const transform =
    stage === "printing" && animate
      ? stepped
        ? [...FEED.transforms]
        : "translateY(0%)"
      : visible || !animate
        ? "translateY(0%)"
        : FEED.transforms[0];

  return (
    <div className={cx(styles.output, className)} data-feed={fast ? "fast" : stepped ? "stepped" : "smooth"} {...props}>
      {visible ? <div aria-hidden="true" className={styles.slotShadow} /> : null}
      <motion.div
        className={styles.feed}
        // Hidden from assistive tech until the ticket is fully out (then the route reads as text).
        aria-hidden={stage !== "complete"}
        initial={false}
        animate={{ opacity: visible ? 1 : 0, transform }}
        transition={{
          opacity: { duration: animate ? 0.16 : 0, ease: easeOut },
          transform: {
            duration: !animate ? 0 : fast ? 0.2 : FEED.seconds,
            ease: stepped ? "linear" : fast ? easeOut : easeInOut,
            times: stepped ? [...FEED.times] : undefined,
          },
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

export const TicketPrinter = { Header, Machine, Output, Paper, Root, Screen, Status };
