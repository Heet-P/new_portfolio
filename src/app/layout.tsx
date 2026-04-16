import type { Metadata } from "next";
import { Arvo } from "next/font/google";
import "./globals.css";

const arvo = Arvo({
  weight: ['400', '700'],
  subsets: ["latin"],
  variable: "--font-arvo",
  display: "swap",
});

// --- OPTIMIZED METADATA ---
export const metadata: Metadata = {
  // Putting your name first is crucial for "Heet Parikh" search results
  title: "Heet Parikh | Software Engineer",
  description: "Official website of Heet Parikh. Explore my interactive OS portfolio featuring C++ game mechanics, React apps, and AI systems like FormAI and emoDiary.",
  metadataBase: new URL("https://your-actual-domain.com"), // REPLACE THIS with your real domain
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/images/icon.png",
    apple: "/images/icon.png",
  },
  openGraph: {
    title: "Heet Parikh | Software Engineer Portfolio",
    description: "Interactive macOS-inspired portfolio of Heet Parikh.",
    url: "https://your-actual-domain.com", // REPLACE THIS
    siteName: "Heet Parikh Portfolio",
    type: "website",
    images: [
      {
        url: "/images/pfp.jpeg", // This ensures your face shows up in link previews
        width: 1200,
        height: 630,
        alt: "Heet Parikh Portfolio Preview",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* --- JSON-LD STRUCTURED DATA --- */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Person",
              "name": "Heet Parikh",
              "alternateName": "Heet",
              "url": "https://heetparikh.me", // REPLACE THIS
              "image": "https://heetparikh.me/images/pfp.jpeg", // REPLACE THIS
              "jobTitle": "Software Developer",
              "alumniOf": {
                "@type": "CollegeOrUniversity",
                "name": "CHARUSAT"
              },
              "sameAs": [
                "https://www.linkedin.com/in/heetparikh/",
                "https://github.com/Heet-P",
                "https://instagram.com/heet_1606"
              ],
              "description": "Software engineer specializing in React, FastAPI, and C++ game development."
            }),
          }}
        />
      </head>
      <body
        className={`${arvo.variable} font-sans antialiased bg-zinc-950 text-zinc-50 overflow-hidden selection:bg-orange-500/30`}
      >
        {children}
      </body>
    </html>
  );
}