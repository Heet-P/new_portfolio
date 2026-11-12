import type { Metadata } from "next";
import { Fraunces, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

/*
 * Fonts (self-hosted by next/font at build time, no runtime Google requests):
 * - Fraunces: a soft, slightly old-style serif for names and big numbers; warm, not corporate.
 * - Instrument Sans: a crisp, friendly sans for reading paragraphs.
 * - IBM Plex Mono: the "departure board" voice for dates, stop numbers and labels.
 * Each is exposed as a CSS variable so globals.css and modules can pick them by role.
 */
const serif = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});
const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Heet Parikh",
  description: "Portfolio of Heet Parikh, ridden as a night train.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
