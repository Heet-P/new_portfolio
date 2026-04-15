import type { Metadata } from "next";
import { Arvo } from "next/font/google";
import "./globals.css";

// Configure Arvo Font
const arvo = Arvo({
  weight: ['400', '700'],
  subsets: ["latin"],
  variable: "--font-arvo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Heet Parikh | Developer Portfolio",
  description: "Crafting digital experiences in React, C++, and game development. Welcome to my interactive desktop.",
  icons: {
    icon: "/images/icon.png",
    shortcut: "/images/icon.png",
    apple: "/images/icon.png",
  },
  openGraph: {
    title: "Heet Parikh | Developer Portfolio",
    description: "Interactive macOS-inspired developer portfolio.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${arvo.variable} font-sans antialiased bg-zinc-950 text-zinc-50 overflow-hidden selection:bg-orange-500/30`}
      >
        {children}
      </body>
    </html>
  );
}