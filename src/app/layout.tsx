import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Heet Parikh",
  description: "Portfolio of Heet Parikh, ridden as a night train.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
