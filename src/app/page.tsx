"use client";

import { useState } from "react";
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

// Import your custom art
import customBg from "@/assets/images/bg-removed.png";

export default function Desktop() {
  const [openWindows, setOpenWindows] = useState<string[]>([]);
  const [activeWindow, setActiveWindow] = useState<string>("");
  const [origins, setOrigins] = useState<Record<string, DOMRect>>({});
  const [isAnyWindowMaximized, setIsAnyWindowMaximized] = useState(false);
  const [bgTheme, setBgTheme] = useState<string>("default");
  
  const windowContents: Record<string, React.ReactNode> = {
    "home": <HomeContent />,
    "projects": <ProjectsContent />,
    "journey": <ExperienceContent />,
    "experience": <ExperienceContent />, 
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

  const openWindow = (id: string, rect: DOMRect) => {
    setIsAnyWindowMaximized(false); 
    setOrigins(prev => ({ ...prev, [id]: rect }));
    if (!openWindows.includes(id)) setOpenWindows([...openWindows, id]);
    setActiveWindow(id);
  };

  const closeWindow = (id: string) => {
    const updated = openWindows.filter(w => w !== id);
    setOpenWindows(updated);
    if (activeWindow === id) setActiveWindow(updated[updated.length - 1] || "");
    if (updated.length === 0) setIsAnyWindowMaximized(false);
  };

  const handleWindowMaximize = (isMaximized: boolean) => {
    setIsAnyWindowMaximized(isMaximized);
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden text-zinc-50 bg-black selection:bg-orange-500/30">
      
      {/* --- CONDITIONAL BACKGROUND LAYER (z-0) --- */}
      
      {/* 1. Theme: Minimal Light */}
      {bgTheme === 'light' && (
        <div className="absolute inset-0 z-0 bg-[#e5e5e5] transition-colors duration-500" />
      )}

      {/* 2. Theme: Windows OG */}
      {bgTheme === 'windows' && (
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

      {/* 3. Theme: Default Interactive Art */}
      {bgTheme === 'default' && (
        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-auto transition-opacity duration-500">
          <div className="relative w-full max-w-7xl aspect-[16/9]">
            <Image 
              src={customBg} 
              alt="Interactive Desktop Environment" 
              fill 
              className="object-contain pointer-events-none"
              priority
            />

            {/* LinkedIn Hitbox */}
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

            {/* GitHub Hitbox */}
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

            {/* Instagram Hitbox */}
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
      <LeftSidebar onOpen={openWindow} />
      <RightSidebar onOpen={openWindow} />

      {/* --- CENTRAL WINDOW CANVAS --- */}
      <div className={`absolute inset-0 pointer-events-none flex items-center justify-center ${isAnyWindowMaximized ? 'z-60' : 'z-10'}`}>
         <AnimatePresence>
           
           {/* HOME */}
           {openWindows.includes("home") && (
             <MacWindow
               key="home"
               id="home"
               title="home.mdx"
               originRect={origins["home"]}
               width="w-[850px]"
               height="h-[600px]"
               defaultPosition={{ x: -150, y: -50 }}
               isActive={activeWindow === "home"}
               onFocus={() => setActiveWindow("home")}
               onClose={() => closeWindow("home")}
               onMaximize={handleWindowMaximize} 
             >
                {windowContents["home"]}
             </MacWindow>
           )}

           {/* PROJECTS */}
           {openWindows.includes("projects") && (
             <MacWindow
               key="projects"
               id="projects"
               title="projects.mdx"
               originRect={origins["projects"]}
               width="w-[950px]"
               height="h-[650px]"
               defaultPosition={{ x: 50, y: 20 }}
               isActive={activeWindow === "projects"}
               onFocus={() => setActiveWindow("projects")}
               onClose={() => closeWindow("projects")}
               onMaximize={handleWindowMaximize}
             >
                {windowContents["projects"]}
             </MacWindow>
           )}

           {/* CHANGELOG */}
           {openWindows.includes("changelog") && (
             <MacWindow
               key="changelog"
               id="changelog"
               title="changelog.mdx"
               originRect={origins["changelog"]}
               defaultPosition={{ x: 200, y: -100 }}
               width="w-[600px]"
               height="h-[450px]"
               isActive={activeWindow === "changelog"}
               onFocus={() => setActiveWindow("changelog")}
               onClose={() => closeWindow("changelog")}
               onMaximize={handleWindowMaximize}
             >
                {windowContents["changelog"]}
             </MacWindow>
           )}

           {/* VIDEOS FOLDER */}
           {openWindows.includes("videos") && (
             <MacWindow
               key="videos"
               id="videos"
               title="Videos"
               originRect={origins["videos"]}
               defaultPosition={{ x: -100, y: -50 }}
               width="w-[950px]"
               height="h-[650px]"
               isActive={activeWindow === "videos"}
               onFocus={() => setActiveWindow("videos")}
               onClose={() => closeWindow("videos")}
               onMaximize={handleWindowMaximize}
             >
                <VideosFolderContent onOpen={openWindow} />
             </MacWindow>
           )}

           {/* EMODIARY VIDEO PLAYER */}
           {openWindows.includes("video_emodiary") && (
             <MacWindow
               key="video_emodiary"
               id="video_emodiary"
               title="emoDiary.mp4"
               originRect={origins["video_emodiary"]}
               defaultPosition={{ x: 50, y: 50 }}
               width="w-[850px]"
               height="h-[550px]"
               isActive={activeWindow === "video_emodiary"}
               onFocus={() => setActiveWindow("video_emodiary")}
               onClose={() => closeWindow("video_emodiary")}
               onMaximize={handleWindowMaximize}
             >
                <DemoContent src="/videos/emoDiary.mp4" title="emoDiary - AI Journaling Web App" />
             </MacWindow>
           )}

           {/* FORMAI VIDEO PLAYER */}
           {openWindows.includes("video_formai") && (
             <MacWindow
               key="video_formai"
               id="video_formai"
               title="FormAI.mp4"
               originRect={origins["video_formai"]}
               defaultPosition={{ x: 75, y: 75 }}
               width="w-[850px]"
               height="h-[550px]"
               isActive={activeWindow === "video_formai"}
               onFocus={() => setActiveWindow("video_formai")}
               onClose={() => closeWindow("video_formai")}
               onMaximize={handleWindowMaximize}
             >
                <DemoContent src="/videos/FormAI.mp4" title="FormAI - Government Assistant" />
             </MacWindow>
           )}

           {/* QUIZVERSE VIDEO PLAYER */}
           {openWindows.includes("video_quizverse") && (
             <MacWindow
               key="video_quizverse"
               id="video_quizverse"
               title="QuizVerse.mp4"
               originRect={origins["video_quizverse"]}
               defaultPosition={{ x: 100, y: 100 }}
               width="w-[850px]"
               height="h-[550px]"
               isActive={activeWindow === "video_quizverse"}
               onFocus={() => setActiveWindow("video_quizverse")}
               onClose={() => closeWindow("video_quizverse")}
               onMaximize={handleWindowMaximize}
             >
                <DemoContent src="/videos/QuizVerse.mp4" title="QuizVerse - Gamified Platform" />
             </MacWindow>
           )}

           {/* DOCS FOLDER */}
           {openWindows.includes("docs") && (
             <MacWindow
               key="docs"
               id="docs"
               title="Docs"
               originRect={origins["docs"]}
               defaultPosition={{ x: -10, y: 30 }}
               width="w-[950px]"
               height="h-[600px]"
               isActive={activeWindow === "docs"}
               onFocus={() => setActiveWindow("docs")}
               onClose={() => closeWindow("docs")}
               onMaximize={handleWindowMaximize}
             >
                <DocsFolderContent onOpen={openWindow} />
             </MacWindow>
           )}

           {/* PDF VIEWER WINDOW */}
           {openWindows.includes("resume_pdf") && (
             <MacWindow
               key="resume_pdf"
               id="resume_pdf"
               title="Resume_HeetParikh.pdf"
               originRect={origins["resume_pdf"]}
               defaultPosition={{ x: 50, y: 0 }}
               width="w-[850px]"
               height="h-[85vh]"
               isActive={activeWindow === "resume_pdf"}
               onFocus={() => setActiveWindow("resume_pdf")}
               onClose={() => closeWindow("resume_pdf")}
               onMaximize={handleWindowMaximize}
             >
                <PdfViewerContent fileUrl="/Resume_HeetParikh.pdf" />
             </MacWindow>
           )}

           {/* EXPERIENCE / JOURNEY WINDOW */}
           {(openWindows.includes("experience") || openWindows.includes("journey")) && (
             <MacWindow
               key={openWindows.includes("experience") ? "experience" : "journey"}
               id={openWindows.includes("experience") ? "experience" : "journey"}
               title="experience.mdx"
               originRect={origins[openWindows.includes("experience") ? "experience" : "journey"]}
               defaultPosition={{ x: 150, y: -20 }}
               width="w-[800px]"
               height="h-[600px]"
               isActive={activeWindow === "experience" || activeWindow === "journey"}
               onFocus={() => setActiveWindow(openWindows.includes("experience") ? "experience" : "journey")}
               onClose={() => closeWindow(openWindows.includes("experience") ? "experience" : "journey")}
               onMaximize={handleWindowMaximize}
             >
                {windowContents["journey"]}
             </MacWindow>
           )}

           {/* CONTACT TERMINAL WINDOW */}
           {openWindows.includes("contact") && (
             <MacWindow
               key="contact"
               id="contact"
               title="terminal — bash"
               originRect={origins["contact"]}
               defaultPosition={{ x: 250, y: 100 }}
               width="w-[650px]"
               height="h-[450px]"
               isActive={activeWindow === "contact"}
               onFocus={() => setActiveWindow("contact")}
               onClose={() => closeWindow("contact")}
               onMaximize={handleWindowMaximize}
             >
                {windowContents["contact"]}
             </MacWindow>
           )}

           {/* SETTINGS WINDOW */}
           {openWindows.includes("settings") && (
             <MacWindow
               key="settings"
               id="settings"
               title="System Settings"
               originRect={origins["settings"]}
               defaultPosition={{ x: -200, y: -50 }}
               width="w-[750px]"
               height="h-[550px]"
               isActive={activeWindow === "settings"}
               onFocus={() => setActiveWindow("settings")}
               onClose={() => closeWindow("settings")}
               onMaximize={handleWindowMaximize}
             >
                <SettingsContent currentTheme={bgTheme} setTheme={setBgTheme} />
             </MacWindow>
           )}

         </AnimatePresence>
      </div>
    </main>
  );
}