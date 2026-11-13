"use client";

import { type ComponentProps, useState } from "react";
import { TapLink } from "@/sound/TapLink";

/**
 * The resume ticket's link (Express): once clicked, the ticket stays punched, a conductor's
 * hole through its stub, so the visitor can see they already took one. The hole itself is CSS
 * (`data-punched`), opacity/transform only; the soft paper tap comes from TapLink.
 */
export function TicketLink(props: ComponentProps<"a">) {
  const [punched, setPunched] = useState(false);
  return <TapLink {...props} data-punched={punched || undefined} onClick={() => setPunched(true)} />;
}
