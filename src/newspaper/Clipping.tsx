"use client";

import { type CSSProperties, type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { useSpring } from "motion/react";
import type { StationId } from "@/content/route";
import { getSound } from "@/sound/sound";
import { ILLUSTRATION_SIZE, ILLUSTRATIONS } from "./illustrations";
import { FINE_POINTER, REDUCED_MOTION, useMediaQuery } from "./motionPrefs";
import { Ornament } from "./ornaments";
import styles from "./newspaper.module.css";

/** Cursor-tilt parallax never leans the clipping further than this (degrees). */
export const MAX_TILT = 3;

/**
 * Spring for the tilt: Motion's bounce 0.15 at a 0.35 s visual duration. Soft enough to read
 * as paper lifting under the hand, not a 3D card flipping; no React render per frame (the
 * springs write the transform straight to the element).
 */
const TILT_SPRING = { visualDuration: 0.35, bounce: 0.15 } as const;

const clamp = (n: number) => (n > 1 ? 1 : n < -1 ? -1 : n);

/**
 * Where the pointer is over the clipping, as a tilt toward it: x leans top/bottom (rotateX),
 * y leans left/right (rotateY). Centre is flat; edges (and beyond, for a fast flick) reach
 * MAX_TILT. The side under the pointer dips, as if pressing a loose cut-out with a finger.
 */
export function tiltFor(clientX: number, clientY: number, rect: Pick<DOMRect, "left" | "top" | "width" | "height">) {
  const nx = clamp(((clientX - rect.left) / rect.width) * 2 - 1);
  const ny = clamp(((clientY - rect.top) / rect.height) * 2 - 1);
  // `+ 0` turns a -0 into 0, so a centred pointer is exactly flat.
  return { x: ny * MAX_TILT + 0, y: nx * MAX_TILT + 0 };
}

/**
 * A stop's illustration, pasted onto the page like a newspaper clipping: slightly tilted, a soft
 * shadow under it, a strip of paper tape over one corner. The sketch keeps its own warmer card
 * and deckled edges on purpose (it is a cut-out, not printed on this page).
 *
 * Served as WebP in two widths via srcSet, decoded off the main thread; lazy-loaded unless
 * `priority` says it is above the fold ("eager": the cabin's page; "high": also fetched first,
 * the Express lead, which is the page's largest paint). If the
 * stop has no illustration, or the file fails to load, an ink ornament fills the frame instead.
 *
 * `whimsy` (Express only, never the cabin): on hover the clipping lifts off the page and the
 * tape peels a little (CSS, fine pointers only), it leans up to 3 degrees toward the cursor on
 * a spring; a mouse press pats it down and a click gives a soft paper tap (when sound is on).
 * `children` are printed on the clipping and move with it (the Stop press stamp).
 */
export function Clipping({
  id,
  whimsy = false,
  priority,
  children,
}: {
  id: StationId;
  whimsy?: boolean;
  priority?: "eager" | "high";
  children?: ReactNode;
}) {
  const art = ILLUSTRATIONS[id];
  const [failed, setFailed] = useState(false);
  const { w, h } = ILLUSTRATION_SIZE;

  const reduced = useMediaQuery(REDUCED_MOTION);
  const fine = useMediaQuery(FINE_POINTER);
  const parallax = whimsy && fine && !reduced;

  const tiltRef = useRef<HTMLDivElement>(null);
  const rect = useRef<DOMRect | null>(null);
  const rotateX = useSpring(0, TILT_SPRING);
  const rotateY = useSpring(0, TILT_SPRING);

  // The springs write the transform themselves: no React render per animation frame.
  useEffect(() => {
    if (!parallax) return;
    const el = tiltRef.current;
    const write = () => {
      if (el) el.style.transform = `perspective(900px) rotateX(${-rotateX.get()}deg) rotateY(${rotateY.get()}deg)`;
    };
    const offX = rotateX.on("change", write);
    const offY = rotateY.on("change", write);
    return () => {
      offX();
      offY();
      rotateX.jump(0);
      rotateY.jump(0);
      if (el) el.style.transform = "";
    };
  }, [parallax, rotateX, rotateY]);

  const pointer = parallax
    ? {
        // Measure once per hover, not per move: no layout read on every pointer event.
        onPointerEnter: (e: PointerEvent<HTMLElement>) => {
          rect.current = e.currentTarget.getBoundingClientRect();
        },
        onPointerMove: (e: PointerEvent<HTMLElement>) => {
          rect.current ??= e.currentTarget.getBoundingClientRect();
          const t = tiltFor(e.clientX, e.clientY, rect.current);
          rotateX.set(t.x);
          rotateY.set(t.y);
        },
        onPointerLeave: () => {
          rect.current = null;
          rotateX.set(0);
          rotateY.set(0);
        },
      }
    : {};

  return (
    <figure
      className={styles.clipping}
      style={{ "--tilt": `${art?.tilt ?? 0}deg` } as CSSProperties}
      data-whimsy={whimsy || undefined}
      data-parallax={whimsy ? (parallax ? "on" : "off") : undefined}
      // On click, not pointerdown: a touch scroll that starts on the illustration is not a tap.
      onClick={whimsy ? () => getSound().tap() : undefined}
      {...pointer}
    >
      {/* The tape strip: a real element (not ::before) so it can peel on hover. */}
      <span className={styles.tape} aria-hidden="true" />
      {/* lift: CSS hover lift + shadow. tilt: the spring-driven lean toward the cursor. */}
      <div className={styles.clippingLift}>
        <div className={styles.clippingTilt} ref={tiltRef} data-tilt="">
          {art && !failed ? (
            // Plain <img>: static export serves the pre-sized WebPs as-is (no image optimizer).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className={styles.clippingImg}
              src={`/illustrations/${id}.webp`}
              srcSet={`/illustrations/${id}-600.webp 600w, /illustrations/${id}-900.webp 900w, /illustrations/${id}.webp ${w}w`}
              // Its laid-out width (measured): about half the page on wide screens, the column
              // minus its gutters on tablets and phones. Accurate, so phones fetch 600w/900w.
              sizes="(min-width: 900px) 560px, (min-width: 640px) calc(100vw - 72px), calc(100vw - 28px)"
              alt={art.alt}
              width={w}
              height={h}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority === "high" ? "high" : undefined}
              decoding="async"
              onError={() => setFailed(true)}
            />
          ) : (
            <div className={styles.ornamentFrame} data-testid="ornament">
              <Ornament />
            </div>
          )}
          {children}
        </div>
      </div>
    </figure>
  );
}
