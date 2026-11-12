"use client";

import { type CSSProperties, useState } from "react";
import type { StationId } from "@/content/route";
import { ILLUSTRATION_SIZE, ILLUSTRATIONS } from "./illustrations";
import { Ornament } from "./ornaments";
import styles from "./newspaper.module.css";

/**
 * A stop's illustration, pasted onto the page like a newspaper clipping: slightly tilted, a soft
 * shadow under it, a strip of paper tape over one corner. The sketch keeps its own warmer card
 * and deckled edges on purpose (it is a cut-out, not printed on this page).
 *
 * Served as WebP in two widths via srcSet; lazy-loaded and decoded off the main thread. If the
 * stop has no illustration, or the file fails to load, an ink ornament fills the frame instead.
 */
export function Clipping({ id }: { id: StationId }) {
  const art = ILLUSTRATIONS[id];
  const [failed, setFailed] = useState(false);
  const { w, h } = ILLUSTRATION_SIZE;

  return (
    <figure className={styles.clipping} style={{ "--tilt": `${art?.tilt ?? 0}deg` } as CSSProperties}>
      {art && !failed ? (
        // Plain <img>: static export serves the pre-sized WebPs as-is (no image optimizer).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.clippingImg}
          src={`/illustrations/${id}.webp`}
          srcSet={`/illustrations/${id}-600.webp 600w, /illustrations/${id}.webp ${w}w`}
          // Half the page on wide screens, the full column on phones.
          sizes="(min-width: 900px) 520px, calc(100vw - 64px)"
          alt={art.alt}
          width={w}
          height={h}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className={styles.ornamentFrame} data-testid="ornament">
          <Ornament />
        </div>
      )}
    </figure>
  );
}
