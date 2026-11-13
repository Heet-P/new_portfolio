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

const TITLE = "Heet Parikh — Full-Stack & AI Developer";
const DESCRIPTION =
  "Portfolio of Heet Parikh, full-stack and AI developer: ride a night train through his projects, or read every stop at once in The Project Post.";

/*
 * Title, description and the social card. The card's image is app/opengraph-image.jpg (a still
 * of the ride, with its alt text beside it), picked up by Next's file convention. No
 * metadataBase is set: on Vercel, Next resolves the image URL against the production domain.
 */
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", siteName: "The Project Post" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${blackletter.variable} ${headline.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
