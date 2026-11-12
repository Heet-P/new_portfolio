"use client";

import { useEffect, useRef } from "react";

/**
 * Splits a stat like "~25%" or "383 ms" into prefix / number / suffix.
 * Only values with ONE plain number are animated: "2nd" (ordinal), "96-97%" (range)
 * and "Top 6" would read as nonsense mid-count, so they stay static.
 */
function parse(value: string) {
  const match = /^([~<]?)(\d+(?:\.\d+)?)([^\da-z].*)?$/i.exec(value);
  if (!match) return null;
  const [, prefix, number, suffix = ""] = match;
  if (/\d/.test(suffix)) return null;
  const decimals = number.split(".")[1]?.length ?? 0;
  return { prefix, target: Number(number), decimals, suffix };
}

const COUNT_MS = 900; // a deliberate "tally" read, not UI feedback, so longer than 300ms is fine
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * A stat number that counts up once when it scrolls into view.
 *
 * The server renders the FINAL value, so no-JS visitors and crawlers see real numbers.
 * After hydration, a stat that is still below the fold is quietly reset to zero and
 * counted up the first time it enters the viewport. Stats already on screen at load
 * are left alone (resetting them would flash), as is everything under reduced motion.
 */
export function StatValue({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    const parts = parse(value);
    if (!el || !parts || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const format = (n: number) => `${parts.prefix}${n.toFixed(parts.decimals)}${parts.suffix}`;
    let frame = 0;
    let firstCallback = true;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const wasFirst = firstCallback;
        firstCallback = false;

        if (!entry.isIntersecting) {
          // Off screen: park it at zero, ready to count when it arrives.
          if (wasFirst) el.textContent = format(0);
          return;
        }
        observer.disconnect();
        if (wasFirst) return; // visible on load: keep the server-rendered final value

        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / COUNT_MS);
          el.textContent = format(parts.target * easeOut(t));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      el.textContent = value; // never leave a half-counted number behind
    };
  }, [value]);

  // The animated digits are hidden from screen readers; they get the stable value instead.
  return (
    <>
      <span ref={ref} aria-hidden="true">
        {value}
      </span>
      <span className="sr-only">{value}</span>
    </>
  );
}
