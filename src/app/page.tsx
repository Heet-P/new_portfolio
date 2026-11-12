import { ExpressView } from "@/express/ExpressView";
import { InitialMode } from "@/ride/InitialMode";
import { ModeToggle } from "@/ride/ModeToggle";
import { ExpressGate, Ride } from "@/ride/Ride";

// The Express view is the page's real HTML (SEO, no-JS, reduced motion, fast lane).
// The ride is layered on top of it: in ride mode Express is hidden and the scroll-driven ride mounts.
export default function Home() {
  return (
    <>
      <InitialMode />
      <ModeToggle />
      <ExpressGate>
        <ExpressView />
      </ExpressGate>
      <Ride />
    </>
  );
}
