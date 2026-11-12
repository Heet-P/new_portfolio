import { ExpressView } from "@/express/ExpressView";

// The Express view is the page's real HTML (SEO, no-JS, reduced motion, fast lane).
// The 3D ride is layered on top of it in later tasks.
export default function Home() {
  return <ExpressView />;
}
