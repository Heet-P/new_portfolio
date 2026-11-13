import { ExpressView } from "@/express/ExpressView";
import { IntroGate } from "@/intro/IntroGate";
import { InitialMode } from "@/ride/InitialMode";
import { ModeToggle } from "@/ride/ModeToggle";
import controls from "@/ride/ModeToggle.module.css";
import { ExpressGate, Ride } from "@/ride/Ride";
import { SoundToggle } from "@/sound/SoundToggle";

// The Express view is the page's real HTML (SEO, no-JS, reduced motion, fast lane).
// The ride is layered on top of it: in ride mode Express is hidden and the scroll-driven ride mounts.
export default function Home() {
  return (
    <>
      <InitialMode />
      {/* Top-right: sound on/off and the switch between the ride and Express, in both views. */}
      <div className={controls.controls}>
        <SoundToggle />
        <ModeToggle />
      </div>
      <ExpressGate>
        <ExpressView />
      </ExpressGate>
      <Ride />
      {/* First ride of the session at the top of the route: the ticket-printer intro, over everything.
          After <InitialMode />, so it sees the mode that was just chosen. */}
      <IntroGate />
    </>
  );
}
