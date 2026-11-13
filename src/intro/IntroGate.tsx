"use client";

import { lazy, Suspense, useEffect } from "react";
import { create } from "zustand";
import { matches, REDUCED_MOTION } from "@/newspaper/motionPrefs";
import { useRide } from "@/ride/rideStore";
import { readIntroSeen, shouldShowIntro } from "./ticket";
import styles from "./IntroGate.module.css";

/*
 * The printer (motion, the ticket, its styles) is its own chunk: fetched only for the visitors
 * who will see it, never for Express or a deep link.
 */
const Intro = lazy(() => import("./Intro"));

/** Whether the intro is up, and whether it plays (false) or starts finished (reduced motion). */
type Plan = { instant: boolean } | null;
const useIntroPlan = create<{ plan: Plan }>(() => ({ plan: null }));
const close = () => useIntroPlan.setState({ plan: null });

/**
 * Decides, once per page load, whether the ticket-printer intro greets this visitor, and
 * mounts it if so. The page renders this after <InitialMode />, so by the time this effect runs
 * the initial mode has been chosen (sibling effects run in order) and the scroll driver has not
 * yet rewritten the hash. Switching to Express later never shows it; leaving the ride (the
 * "In a hurry?" button, or the scene failing over to Express) closes it for good.
 */
export function IntroGate() {
  const plan = useIntroPlan((s) => s.plan);

  useEffect(() => {
    const show = shouldShowIntro({ mode: useRide.getState().mode, hash: window.location.hash, seen: readIntroSeen() });
    if (!show) return;
    // Reduced motion (a visitor who chose the ride anyway): the finished ticket, no feed.
    useIntroPlan.setState({ plan: { instant: matches(REDUCED_MOTION) } });
    const unsubscribe = useRide.subscribe((s) => {
      if (s.mode !== "ride") close();
    });
    return () => {
      unsubscribe();
      close();
    };
  }, []);

  if (!plan) return null;
  return (
    <Suspense fallback={<div className={styles.backdrop} aria-hidden="true" />}>
      <Intro instant={plan.instant} onClose={close} />
    </Suspense>
  );
}
