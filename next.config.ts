import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static site: `next build` writes plain HTML/JS/CSS to `out/`.
  output: "export",
  // The image optimizer needs a server; static export must serve images as-is.
  images: { unoptimized: true },
};

export default nextConfig;
