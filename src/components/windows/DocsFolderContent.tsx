"use client";

interface DocsFolderContentProps {
  onOpen: (id: string, rect: DOMRect) => void;
}

export function DocsFolderContent({ onOpen }: DocsFolderContentProps) {
  const files = [
    { id: "resume_pdf", name: "Resume_HeetParikh.pdf", size: "1.2 MB" },
  ];

  return (
    <div className="flex flex-col h-full bg-[#1e1e20] text-zinc-300 font-sans rounded-b-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-[#252528] shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-zinc-500">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="cursor-not-allowed"><path d="M15 18l-6-6 6-6"/></svg>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="cursor-not-allowed"><path d="M9 18l6-6-6-6"/></svg>
          </div>
          <h3 className="text-sm font-semibold text-white ml-2 tracking-wide">Docs</h3>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex content-start gap-2 flex-wrap bg-[#1c1c1e]">
        {files.map(file => (
          <div 
            key={file.id}
            onDoubleClick={(e) => onOpen(file.id, e.currentTarget.getBoundingClientRect())}
            className="w-28 flex flex-col items-center gap-2 p-3 hover:bg-white/10 rounded-xl cursor-pointer group transition-all duration-200"
          >
            {/* Custom Premium PDF File Icon */}
            <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-700 rounded-lg flex items-center justify-center border border-white/20 shadow-md group-hover:shadow-[0_8px_16px_rgba(0,0,0,0.4)] group-hover:-translate-y-1 transition-all relative overflow-hidden">
               <div className="absolute top-0 right-0 w-4 h-4 bg-white/20 rounded-bl-lg" /> {/* Folded corner effect */}
               <span className="font-black text-white text-lg drop-shadow-md">PDF</span>
            </div>

            <span className="text-xs font-medium text-zinc-300 text-center truncate w-full group-hover:text-white px-1">
              {file.name}
            </span>
          </div>
        ))}
      </div>

      <div className="h-7 shrink-0 border-t border-white/5 bg-[#252528] flex items-center px-4 text-[11px] text-zinc-500 font-medium">
        {files.length} item(s)
      </div>
    </div>
  );
}