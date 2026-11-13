import type { Metadata } from "next";
import { Merriweather, Newsreader } from "next/font/google";
import localFont from "next/font/local";
import { PROFILE } from "@/content/route";
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

const SITE_URL = "https://www.heetp.tech";
const TITLE = "Heet Parikh — Full-Stack & AI Developer";
const DESCRIPTION =
  "I'm Heet Parikh, a full-stack and AI developer. Ride a night train through my projects, or read every stop at once in The Project Post.";

/*
 * Title, description, canonical URL and the social card. The card's image is
 * app/opengraph-image.jpg (with its alt text beside it), picked up by Next's file convention.
 * metadataBase is the production domain so the canonical link and image URLs always point at
 * heetp.tech (the apex domain redirects to www), even on preview deployments.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  authors: [{ name: "Heet Parikh", url: SITE_URL }],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "profile",
    url: "/",
    siteName: "Heet Parikh",
    firstName: "Heet",
    lastName: "Parikh",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

/*
 * Structured data (schema.org JSON-LD) so search engines know this page is about the person
 * Heet Parikh and can tie it to the same person's GitHub and LinkedIn ("sameAs") — the signal
 * that helps a name search surface this site and a knowledge-style result.
 */
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": `${SITE_URL}/#person`,
      name: "Heet Parikh",
      url: `${SITE_URL}/`,
      image: `${SITE_URL}/opengraph-image.jpg`,
      jobTitle: "Full-Stack & AI Developer",
      description: DESCRIPTION,
      email: `mailto:${PROFILE.email}`,
      address: { "@type": "PostalAddress", addressLocality: "Vadodara", addressRegion: "Gujarat", addressCountry: "IN" },
      alumniOf: { "@type": "CollegeOrUniversity", name: "CSPIT, CHARUSAT" },
      knowsAbout: ["Next.js", "TypeScript", "React", "Node.js", "Python", "AI integrations", "Voice AI agents", "Model Context Protocol", "Machine learning"],
      sameAs: [PROFILE.github, PROFILE.linkedin],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: "Heet Parikh",
      alternateName: "The Project Post",
      publisher: { "@id": `${SITE_URL}/#person` },
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${blackletter.variable} ${headline.variable} ${body.variable}`}>
      <body>
        <script
          type="application/ld+json"
          // Static, trusted content built from our own constants (no user input).
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA).replace(/</g, "\\u003c") }}
        />
        {children}
      </body>
    </html>
  );
}
