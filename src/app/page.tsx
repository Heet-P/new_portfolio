import { ExpressView } from "@/express/ExpressView";
import { InitialMode } from "@/ride/InitialMode";
import { ModeToggle } from "@/ride/ModeToggle";

// The Express view is the page's real HTML (SEO, no-JS, reduced motion, fast lane).
// The 3D ride is layered on top of it in later tasks.
export default function Home() {
  return (
    <>
      <InitialMode />
      <ModeToggle />
      <ExpressView />
    </>
  );
}
