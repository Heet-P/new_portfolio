"use client";

import { useState, useEffect } from "react";

export function TopNav() {
  const [time, setTime] = useState<Date | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute top-0 left-0 w-full h-8 bg-[#1c1c1e]/80 backdrop-blur-md border-b border-white/10 z-50 flex items-center justify-between px-4 text-xs font-medium text-zinc-300">
       
       <div className="flex items-center gap-4">
         {/* Functional Dropdown Menu */}
         <div className="relative">
            <button 
              onClick={() => setMenuOpen(!menuOpen)} 
              className={`font-black text-white px-2 py-1 rounded transition-colors ${menuOpen ? 'bg-white/20' : 'hover:bg-white/10'}`}
            >
              Heet OS
            </button>
            
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute top-full left-0 mt-1 w-48 bg-[#1c1c1e] border border-white/10 rounded-md shadow-2xl py-1 z-50">
                   <div 
                     className="px-4 py-1.5 hover:bg-orange-500 hover:text-white cursor-pointer" 
                     onClick={() => window.location.reload()}
                   >
                     Restart System...
                   </div>
                </div>
              </>
            )}
         </div>
         <span className="hidden sm:inline hover:text-white cursor-pointer">File</span>
         <span className="hidden sm:inline hover:text-white cursor-pointer">Edit</span>
         <span className="hidden sm:inline hover:text-white cursor-pointer">View</span>
       </div>
       
       <div className="flex items-center gap-4">
          <span>100%</span>
          {/* Live Clock */}
          <span>{time ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "..."}</span>
       </div>
    </div>
  );
}