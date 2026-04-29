"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { AnimatePresence } from "framer-motion";
import { TopNav } from "@/components/desktop/TopNav";
import { LeftSidebar } from "@/components/desktop/LeftSidebar";
import { RightSidebar } from "@/components/desktop/RightSidebar";
import { MacWindow } from "@/components/windows/MacWindow";
import { HomeContent } from "@/components/windows/HomeContent";
import { ProjectsContent } from "@/components/windows/ProjectsContent";
import { DemoContent } from "@/components/windows/DemoContent";
import { ExperienceContent } from "@/components/windows/ExperienceContent";
import { ContactContent } from "@/components/windows/ContactContent";
import { VideosFolderContent } from "@/components/windows/VideosFolderContent";
import { DocsFolderContent } from "@/components/windows/DocsFolderContent";
import { PdfViewerContent } from "@/components/windows/PdfViewerContent";
import { SettingsContent } from "@/components/windows/SettingsContent";
import { PptxViewerContent } from "@/components/windows/PptxViewerContent";

import customBg from "@/assets/images/bg-removed.png";

export default function Desktop() {
  const [openWindows, setOpenWindows] = useState<string[]>([]);
  // windowOrder tracks focus history — last item is the topmost (active) window.
  const [windowOrder, setWindowOrder] = useState<string[]>([]);
  const [minimizedWindows, setMinimizedWindows] = useState<string[]>([]);
  const [origins, setOrigins] = useState<Record<string, DOMRect>>({});
  const [isAnyWindowMaximized, setIsAnyWindowMaximized] = useState(false);
  const [bgTheme, setBgTheme] = useState<string>("default");

  // Ref for the window canvas — passed to MacWindow as dragConstraints so windows
  // can't escape the viewport.
  const canvasRef = useRef<HTMLDivElement>(null);

  // The active window is simply the top of the focus stack.
  const activeWindow = windowOrder[windowOrder.length - 1] ?? "";

  const bringToFront = (id: string) => {
    setWindowOrder(prev => [...prev.filter(w => w !== id), id]);
  };

  // zIndex within the canvas stacking context: bottom window = 1, topmost = n.
  const getWindowZIndex = (id: string): number => {
    const idx = windowOrder.indexOf(id);
    return idx === -1 ? 1 : idx + 1;
  };

  const openWindow = (id: string, rect: DOMRect) => {
    setIsAnyWindowMaximized(false);
    setOrigins(prev => ({ ...prev, [id]: rect }));

    if (!openWindows.includes(id)) {
      setOpenWindows(prev => [...prev, id]);
    }
    // Restore from minimized if needed.
    if (minimizedWindows.includes(id)) {
      setMinimizedWindows(prev => prev.filter(w => w !== id));
    }
    bringToFront(id);
  };

  const closeWindow = (id: string) => {
    setOpenWindows(prev => prev.filter(w => w !== id));
    setMinimizedWindows(prev => prev.filter(w => w !== id));
    setWindowOrder(prev => prev.filter(w => w !== id));
  };

  const minimizeWindow = (id: string) => {
    setMinimizedWindows(prev => [...prev, id]);
    // Remove from focus stack so the next window becomes active.
    setWindowOrder(prev => prev.filter(w => w !== id));
  };

  const handleWindowMaximize = (isMaximized: boolean) => {
    setIsAnyWindowMaximized(isMaximized);
  };

  const windowContents: Record<string, React.ReactNode> = {
    "home": <HomeContent />,
    "projects": <ProjectsContent />,
    "journey": <ExperienceContent />,
    "contact": <ContactContent />,
    "changelog": (
      <div className="p-8 text-zinc-400 font-mono text-sm leading-relaxed">
        <h2 className="text-white font-bold mb-4">v1.1.0 - The OS Update</h2>
        <p className="mb-2">- Engineered File Explorer & native PDF reader.</p>
        <p className="mb-2">- Integrated global theme engine.</p>
        <p className="mb-2">- Refined window scaling and media player mechanics.</p>
      </div>
    ),
  };

  // Shared props to reduce repetition across MacWindow declarations.
  const windowProps = (id: string) => ({
    id,
    isActive: activeWindow === id,
    isMinimized: minimizedWindows.includes(id),
    zIndex: getWindowZIndex(id),
    originRect: origins[id],
    onFocus: () => bringToFront(id),
    onClose: () => closeWindow(id),
    onMinimize: () => minimizeWindow(id),
    onMaximize: handleWindowMaximize,
    constraintsRef: canvasRef,
  });

  return (
    <main className="relative w-screen h-screen overflow-hidden text-zinc-50 bg-black selection:bg-orange-500/30">

      {/* --- CONDITIONAL BACKGROUND LAYER (z-0) --- */}

      {bgTheme === "light" && (
        <div className="absolute inset-0 z-0 bg-[#e5e5e5] transition-colors duration-500" />
      )}

      {bgTheme === "windows" && (
        <div className="absolute inset-0 z-0 bg-black">
          <Image
            src="/images/windows_og.jpg"
            alt="Classic OS Background"
            fill
            className="object-cover"
            priority
          />
        </div>
      )}

      {bgTheme === "default" && (
        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-auto transition-opacity duration-500">
          <div className="relative w-full max-w-7xl aspect-video">
            <Image
              src={customBg}
              alt="Interactive Desktop Environment"
              fill
              className="object-contain pointer-events-none"
              priority
            />

            <a
              href="https://linkedin.com/in/heetparikh"
              target="_blank"
              rel="noopener noreferrer"
              className="absolute rounded-2xl cursor-pointer group"
              style={{ top: "54%", left: "27.5%", width: "12%", height: "20%" }}
              title="LinkedIn"
            >
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 text-white text-[10px] px-2 py-1 rounded pointer-events-none">LinkedIn</span>
            </a>

            <a
              href="https://github.com/Heet-P"
              target="_blank"
              rel="noopener noreferrer"
              className="absolute rounded-2xl cursor-pointer group"
              style={{ top: "59%", left: "40.5%", width: "14%", height: "22%" }}
              title="GitHub"
            >
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 text-white text-[10px] px-2 py-1 rounded pointer-events-none">GitHub</span>
            </a>

            <a
              href="https://instagram.com/heet_1606"
              target="_blank"
              rel="noopener noreferrer"
              className="absolute rounded-2xl cursor-pointer group"
              style={{ top: "55%", left: "59.5%", width: "14%", height: "22%" }}
              title="Instagram"
            >
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 text-white text-[10px] px-2 py-1 rounded pointer-events-none">Instagram</span>
            </a>
          </div>
        </div>
      )}

      {/* --- DESKTOP UI OVERLAYS --- */}
      <TopNav />
      <LeftSidebar
        onOpen={openWindow}
        openWindows={openWindows}
        minimizedWindows={minimizedWindows}
      />
      <RightSidebar
        onOpen={openWindow}
        openWindows={openWindows}
        minimizedWindows={minimizedWindows}
      />

      {/* --- CENTRAL WINDOW CANVAS --- */}
      <div
        ref={canvasRef}
        className={`absolute top-8 inset-x-0 bottom-0 pointer-events-none flex items-center justify-center ${isAnyWindowMaximized ? "z-60" : "z-10"}`}
      >
        <AnimatePresence>

          {openWindows.includes("home") && (
            <MacWindow
              key="home"
              {...windowProps("home")}
              title="About.txt"
              width="w-[850px]"
              height="h-[600px]"
              defaultPosition={{ x: -150, y: -50 }}
            >
              {windowContents["home"]}
            </MacWindow>
          )}

          {openWindows.includes("projects") && (
            <MacWindow
              key="projects"
              {...windowProps("projects")}
              title="Projects.txt"
              width="w-[950px]"
              height="h-[650px]"
              defaultPosition={{ x: 50, y: 20 }}
            >
              {windowContents["projects"]}
            </MacWindow>
          )}

          {openWindows.includes("changelog") && (
            <MacWindow
              key="changelog"
              {...windowProps("changelog")}
              title="changelog.txt"
              width="w-[600px]"
              height="h-[450px]"
              defaultPosition={{ x: 200, y: -100 }}
            >
              {windowContents["changelog"]}
            </MacWindow>
          )}

          {openWindows.includes("journey") && (
            <MacWindow
              key="journey"
              {...windowProps("journey")}
              title="Journey.txt"
              width="w-[800px]"
              height="h-[600px]"
              defaultPosition={{ x: 150, y: -20 }}
            >
              {windowContents["journey"]}
            </MacWindow>
          )}

          {openWindows.includes("contact") && (
            <MacWindow
              key="contact"
              {...windowProps("contact")}
              title="terminal — bash"
              width="w-[650px]"
              height="h-[450px]"
              defaultPosition={{ x: 250, y: 100 }}
            >
              {windowContents["contact"]}
            </MacWindow>
          )}

          {openWindows.includes("videos") && (
            <MacWindow
              key="videos"
              {...windowProps("videos")}
              title="Videos"
              width="w-[950px]"
              height="h-[650px]"
              defaultPosition={{ x: -100, y: -50 }}
            >
              <VideosFolderContent onOpen={openWindow} />
            </MacWindow>
          )}

          {openWindows.includes("video_emodiary") && (
            <MacWindow
              key="video_emodiary"
              {...windowProps("video_emodiary")}
              title="emoDiary.mp4"
              width="w-[850px]"
              height="h-[550px]"
              defaultPosition={{ x: 50, y: 50 }}
            >
              <DemoContent src="/videos/emoDiary.mp4" title="emoDiary - AI Journaling Web App" />
            </MacWindow>
          )}

          {openWindows.includes("video_formai") && (
            <MacWindow
              key="video_formai"
              {...windowProps("video_formai")}
              title="FormAI.mp4"
              width="w-[850px]"
              height="h-[550px]"
              defaultPosition={{ x: 75, y: 75 }}
            >
              <DemoContent src="/videos/FormAI.mp4" title="FormAI - Government Assistant" />
            </MacWindow>
          )}

          {openWindows.includes("video_quizverse") && (
            <MacWindow
              key="video_quizverse"
              {...windowProps("video_quizverse")}
              title="QuizVerse.mp4"
              width="w-[850px]"
              height="h-[550px]"
              defaultPosition={{ x: 100, y: 100 }}
            >
              <DemoContent src="/videos/QuizVerse.mp4" title="QuizVerse - Gamified Platform" />
            </MacWindow>
          )}

          {openWindows.includes("docs") && (
            <MacWindow
              key="docs"
              {...windowProps("docs")}
              title="Docs"
              width="w-[950px]"
              height="h-[600px]"
              defaultPosition={{ x: -10, y: 30 }}
            >
              <DocsFolderContent onOpen={openWindow} />
            </MacWindow>
          )}

          {openWindows.includes("resume_pdf") && (
            <MacWindow
              key="resume_pdf"
              {...windowProps("resume_pdf")}
              title="Resume_HeetParikh.pdf"
              width="w-[850px]"
              height="h-[85vh]"
              defaultPosition={{ x: 50, y: 0 }}
            >
              <PdfViewerContent fileUrl="/Resume_HeetParikh.pdf" />
            </MacWindow>
          )}

          {openWindows.includes("settings") && (
            <MacWindow
              key="settings"
              {...windowProps("settings")}
              title="System Settings"
              width="w-[950px]"
              height="h-[650px]"
              defaultPosition={{ x: -50, y: -20 }}
            >
              <SettingsContent currentTheme={bgTheme} setTheme={setBgTheme} />
            </MacWindow>
          )}

          {openWindows.includes("pptx_hire") && (
            <MacWindow
              key="pptx_hire"
              {...windowProps("pptx_hire")}
              title="WhyHireMe.pptx — PowerPoint"
              width="w-[1000px]"
              height="h-[680px]"
              defaultPosition={{ x: -30, y: -20 }}
            >
              <PptxViewerContent />
            </MacWindow>
          )}

        </AnimatePresence>
      </div>
    </main>
  );
}
