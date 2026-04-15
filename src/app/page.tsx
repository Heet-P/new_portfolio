"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { TopNav } from "@/components/desktop/TopNav";
import { LeftSidebar } from "@/components/desktop/LeftSidebar";
import { RightSidebar } from "@/components/desktop/RightSidebar";
import { MacWindow } from "@/components/windows/MacWindow";
import { HomeContent } from "@/components/windows/HomeContent";
import { ProjectsContent } from "@/components/windows/ProjectsContent";

export default function Desktop() {
  const [openWindows, setOpenWindows] = useState<string[]>([]);
  const [activeWindow, setActiveWindow] = useState<string>("");
  
  // Store the exact coordinate box of the clicked icon
  const [origins, setOrigins] = useState<Record<string, DOMRect>>({});

  const openWindow = (id: string, rect: DOMRect) => {
    setOrigins(prev => ({ ...prev, [id]: rect })); // Save the origin
    if (!openWindows.includes(id)) setOpenWindows([...openWindows, id]);
    setActiveWindow(id);
  };

  const closeWindow = (id: string) => {
    const updated = openWindows.filter(w => w !== id);
    setOpenWindows(updated);
    if (activeWindow === id) setActiveWindow(updated[updated.length - 1] || "");
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden text-zinc-50 selection:bg-orange-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800 via-zinc-950 to-black z-0">
        <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
      </div>

      <TopNav />
      <LeftSidebar onOpen={openWindow} />
      <RightSidebar onOpen={openWindow} />

      <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
         <AnimatePresence>
           
           {openWindows.includes("home") && (
             <MacWindow
               key="home"
               id="home"
               title="home.mdx"
               originRect={origins["home"]}
               defaultPosition={{ x: -150, y: -50 }}
               width="w-[700px]"
               height="h-[450px]"
               isActive={activeWindow === "home"}
               onFocus={() => setActiveWindow("home")}
               onClose={() => closeWindow("home")}
             >
                <HomeContent />
             </MacWindow>
           )}

           {openWindows.includes("projects") && (
             <MacWindow
               key="projects"
               id="projects"
               title="projects.mdx"
               originRect={origins["projects"]}
               defaultPosition={{ x: 100, y: 50 }}
               width="w-[650px]"
               height="h-[500px]"
               isActive={activeWindow === "projects"}
               onFocus={() => setActiveWindow("projects")}
               onClose={() => closeWindow("projects")}
             >
                <ProjectsContent />
             </MacWindow>
           )}

           {openWindows.includes("changelog") && (
             <MacWindow
               key="changelog"
               id="changelog"
               title="changelog.mdx"
               originRect={origins["changelog"]}
               defaultPosition={{ x: 200, y: -100 }}
               width="w-[500px]"
               height="h-[400px]"
               isActive={activeWindow === "changelog"}
               onFocus={() => setActiveWindow("changelog")}
               onClose={() => closeWindow("changelog")}
             >
                <div className="p-8 text-zinc-400 font-mono text-sm">
                  <h2 className="text-white font-bold mb-4">v1.0.5 - The Hyper-Smooth Update</h2>
                  <p>- Strip blur filters for 60fps hardware acceleration</p>
                  <p>- Implement dynamic DOMRect origin math</p>
                </div>
             </MacWindow>
           )}

         </AnimatePresence>
      </div>
    </main>
  );
}