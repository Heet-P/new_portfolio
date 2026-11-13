"use client";

import type { ComponentProps } from "react";
import { getSound } from "./sound";

/**
 * A plain <a> that gives the soft paper tap when clicked (silent while sound is off). A tiny
 * client island, so the newspaper's front page can stay a server component in Express.
 */
export function TapLink({ onClick, ...props }: ComponentProps<"a">) {
  return (
    <a
      {...props}
      onClick={(e) => {
        getSound().tap();
        onClick?.(e);
      }}
    />
  );
}
