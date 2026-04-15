interface DemoContentProps {
  src: string;
  title: string;
}

export function DemoContent({ src, title }: DemoContentProps) {
  return (
    <div className="w-full h-full bg-[#0f0f0f] relative flex items-center justify-center group rounded-b-lg overflow-hidden">
      
      <div className="absolute top-0 left-0 w-full p-4 bg-gradient-to-b from-black/80 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none flex items-center gap-3">
         <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center shrink-0 shadow-lg">
           <span className="text-black font-black text-xs">MP4</span>
         </div>
         <h2 className="text-white font-medium text-sm drop-shadow-md truncate">
           {title}
         </h2>
      </div>

      <video
        src={src}
        controls
        autoPlay
        className="w-full h-full object-contain outline-none"
      />
      
    </div>
  );
}