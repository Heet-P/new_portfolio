"use client";

import type { ComponentProps } from "react";
import { type AnalyticsEvent, type AnalyticsProps, track } from "@/analytics/track";
import { getSound } from "./sound";

/**
 * A plain <a> that gives the soft paper tap when clicked (silent while sound is off). A tiny
 * client island, so the newspaper's front page can stay a server component in Express.
 * `analytics` (plain data, so a server component can pass it) is reported when the link is clicked.
 */
export function TapLink({
  onClick,
  analytics,
  ...props
}: ComponentProps<"a"> & { analytics?: { event: AnalyticsEvent; props?: AnalyticsProps } }) {
  return (
    <a
      {...props}
      onClick={(e) => {
        getSound().tap();
        if (analytics) track(analytics.event, analytics.props);
        onClick?.(e);
      }}
    />
  );
}
