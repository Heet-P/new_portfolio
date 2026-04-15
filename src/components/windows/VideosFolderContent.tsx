"use client";

interface VideosFolderContentProps {
  onOpen: (id: string, rect: DOMRect) => void;
}

export function VideosFolderContent({ onOpen }: VideosFolderContentProps) {
  const files = [
    { id: "video_emodiary", name: "emoDiary.mp4", size: "24.5 MB", duration: "02:14" },
    { id: "video_formai", name: "FormAI.mp4", size: "18.2 MB", duration: "01:45" },
    { id: "video_quizverse", name: "QuizVerse.mp4", size: "32.1 MB", duration: "03:20" },
  ];

  return (
    <div className="flex flex-col h-full bg-[#1e1e20] text-zinc-300 font-sans rounded-b-lg overflow-hidden">
      
      {/* Top OS Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-[#252528] shrink-0">
        <div className="flex items-center gap-4">
          {/* Navigation Arrows */}
          <div className="flex items-center gap-2 text-zinc-500">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="cursor-not-allowed"><path d="M15 18l-6-6 6-6"/></svg>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="cursor-not-allowed"><path d="M9 18l6-6-6-6"/></svg>
          </div>
          <h3 className="text-sm font-semibold text-white ml-2 tracking-wide">Videos</h3>
        </div>
        
        {/* Mock Search Bar */}
        <div className="flex items-center bg-black/20 border border-white/10 rounded-md px-3 py-1.5 w-48 shadow-inner hidden sm:flex">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-500 mr-2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <span className="text-xs text-zinc-500 font-medium">Search</span>
        </div>
      </div>

      {/* Main Grid Area */}
      <div className="flex-1 overflow-y-auto p-6 flex content-start gap-2 flex-wrap bg-[#1c1c1e]">
        {files.map(file => (
          <div 
            key={file.id}
            onDoubleClick={(e) => onOpen(file.id, e.currentTarget.getBoundingClientRect())}
            className="w-28 flex flex-col items-center gap-2 p-3 hover:bg-white/10 rounded-xl cursor-pointer group transition-all duration-200"
            title={`Name: ${file.name}\nSize: ${file.size}\nLength: ${file.duration}`}
          >
            {/* Custom Premium Video File Icon */}
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center border border-white/20 shadow-md group-hover:shadow-[0_8px_16px_rgba(0,0,0,0.4)] group-hover:-translate-y-1 transition-all relative overflow-hidden">
               
               {/* Film strip detail at the top */}
               <div className="absolute top-0 left-0 w-full h-3 bg-black/20 border-b border-black/30 flex items-center justify-around px-1">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-1 h-1.5 bg-white/40 rounded-[1px]" />
                  ))}
               </div>

               {/* Play Button Center */}
               <svg width="24" height="24" viewBox="0 0 24 24" fill="white" className="mt-2 drop-shadow-md opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-transform">
                 <path d="M8 5v14l11-7z"/>
               </svg>
            </div>

            {/* File Name */}
            <span className="text-xs font-medium text-zinc-300 text-center truncate w-full group-hover:text-white px-1">
              {file.name}
            </span>
          </div>
        ))}
      </div>

      {/* Bottom Status Bar */}
      <div className="h-7 shrink-0 border-t border-white/5 bg-[#252528] flex items-center px-4 text-[11px] text-zinc-500 font-medium tracking-wide">
        {files.length} items <span className="mx-2">•</span> 146.8 GB available
      </div>

    </div>
  );
}