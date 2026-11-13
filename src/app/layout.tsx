import type { Metadata } from "next";
import { Merriweather, Newsreader } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

/*
 * Fonts for "The Project Post" (all SIL Open Font License; self-hosted by next/font at build
 * time, so the browser never calls Google). Each is exposed as a CSS variable and picked by role
 * in globals.css and the modules:
 * - UnifrakturMaguntia: the blackletter nameplate, like an old broadsheet's masthead. Shipped as
 *   a local file (the same latin subset Google serves) only so its swap fallback can be metric-
 *   matched to a serif (Times New Roman): next/font/google would pick Arial for it, and the
 *   nameplate visibly jumped when the real face arrived.
 * - Merriweather: sturdy, low-contrast news serif for headlines (heavy) and decks (italic).
 * - Newsreader: a text face designed for news reading, for body copy, datelines and buttons.
 */
const blackletter = localFont({
  src: "./fonts/UnifrakturMaguntia-latin.woff2",
  weight: "400",
  variable: "--font-blackletter",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});
const headline = Merriweather({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-headline",
  display: "swap",
});
const body = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Heet Parikh",
  description: "Portfolio of Heet Parikh, ridden as a night train and printed as The Project Post.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${blackletter.variable} ${headline.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
