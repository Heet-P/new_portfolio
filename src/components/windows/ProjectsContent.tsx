"use client";

import { useState, useEffect } from "react";

export function ProjectsContent() {
  const projects = [
    {
      id: "formai",
      title: "FormAI — Multilingual Government Assistant",
      desc: "Engineered an OCR-powered form parsing pipeline using Llama Vision 90B, enabling accurate field extraction from government PDFs in any language. Designed a conversational AI validation layer using Gemini Flash that guides users through clarifying Q&A, reducing form errors.",
      image: "/images/formAI.png", // Updated file name
      theme: "blue",
      github: "https://github.com/Heet-P/ocr_llama90b", // Add your real links here
      live: "https://formai-demo.vercel.app"
    },
    {
      id: "emodiary",
      title: "emoDiary — AI Journaling Web App",
      desc: "Built a multilingual mental health journaling platform supporting Hindi & English via Sarvam AI TTS. Implemented an AI-driven monthly insights engine that analyzes emotion-tagged journal entries, delivering personalized mental health summaries. Architected a zero-data-retention backend.",
      image: "/images/emoDiary.png", // Updated file name
      theme: "teal",
      github: "https://github.com/heet-p/emoDiary",
      live: "https://emodiary.xyz"
    },
    {
      id: "quizverse",
      title: "QuizVerse — Gamified Quiz Platform",
      desc: "Engineered a real-time team leaderboard leveraging live quiz scores, reducing admin oversight by 3+ hours per event and displaying live updates to 200 concurrent users simultaneously. Developed a configurable anti-cheat suite.",
      image: "/images/quizzx.jpg", // Updated file name
      theme: "purple",
      github: "https://github.com/dhrumil246/BlueVerse",
      live: "https://blue-verse-one.vercel.app/"
    }
  ];

  const themes = {
    blue: { bg: "bg-[#1d4ed8]", border: "border-[#1d4ed8]", text: "text-[#3b82f6]" },
    teal: { bg: "bg-[#0f766e]", border: "border-[#0f766e]", text: "text-[#14b8a6]" },
    purple: { bg: "bg-[#7e22ce]", border: "border-[#7e22ce]", text: "text-[#a855f7]" },
  };

  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (isHovered) return;
    const timer = setInterval(() => {
      setActiveIndex((current) => (current + 1) % projects.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [isHovered, projects.length]);

  const activeProject = projects[activeIndex];
  const activeTheme = themes[activeProject.theme as keyof typeof themes];

  return (
    <div className="h-full bg-[#1c1c1e] text-zinc-200 font-sans p-6 overflow-y-auto no-scrollbar selection:bg-white/20">
      <div 
        className="w-full max-w-5xl mx-auto flex flex-col"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        
        {/* Top Tabs */}
        <div className="flex gap-1 overflow-x-auto no-scrollbar relative z-10 px-4">
          {projects.map((p, idx) => {
            const isActive = idx === activeIndex;
            const projectTheme = themes[p.theme as keyof typeof themes];
            
            return (
              <button
                key={p.id}
                onClick={() => setActiveIndex(idx)}
                className={`px-5 py-3 text-sm font-bold rounded-t-lg transition-all duration-300 ${
                  isActive 
                    ? `${projectTheme.bg} text-white shadow-lg translate-y-[2px]` 
                    : "bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                }`}
              >
                {p.title.split('—')[0].trim()}
              </button>
            );
          })}
        </div>

        {/* Main Content Box */}
        <div className={`relative border-[4px] rounded-2xl rounded-tl-none bg-[#151619] transition-colors duration-500 ${activeTheme.border}`}>
          
          <div className="p-8 md:p-10 flex flex-col md:flex-row gap-8 items-start">
            
            {/* Left: Text Content & Buttons */}
            <div className="flex-1 flex flex-col h-full justify-between min-h-[12rem]">
              <div className="space-y-6">
                <h2 className="text-3xl font-black text-white tracking-tight">{activeProject.title}</h2>
                <p className="text-zinc-400 text-lg leading-relaxed">{activeProject.desc}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-4 mt-8 pt-6 border-t border-white/10">
                <a 
                  href={activeProject.github} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#24292e] hover:bg-[#2f363d] text-white font-bold rounded-lg transition-colors border border-zinc-700 shadow-sm"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                  GitHub Repo
                </a>
                <a 
                  href={activeProject.live} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className={`flex items-center gap-2 px-5 py-2.5 ${activeTheme.bg} hover:brightness-110 text-white font-bold rounded-lg transition-all shadow-md`}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                  See Live
                </a>
              </div>
            </div>

            {/* Right: Image/Illustration */}
            <div className="w-full md:w-[40%] aspect-[4/3] bg-[#111214] border-2 border-zinc-800 rounded-xl overflow-hidden flex items-center justify-center shrink-0 relative">
               <span className="absolute text-xs text-zinc-600 font-mono z-0 text-center px-4">
                 [ Missing Asset: {activeProject.image} ]
               </span>
               <img 
                 src={activeProject.image} 
                 alt={activeProject.title}
                 className="w-full h-full object-cover relative z-10"
                 onError={(e) => {
                   e.currentTarget.style.display = 'none';
                 }}
               />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}