export function ContactContent() {
  return (
    <div className="h-full p-6 font-mono text-sm flex flex-col">
      <div className="flex-1 bg-black/50 border border-white/10 rounded-lg p-4 overflow-y-auto">
        <div className="text-zinc-500 mb-4">
          Last login: {new Date().toDateString()} on ttys000<br />
          System Auth ID: <span className="text-orange-500">24CS058</span><br />
          User: Heet Parikh
        </div>
        
        <div className="mb-4">
          <span className="text-green-400">guest@portfolio</span>
          <span className="text-white">:</span>
          <span className="text-blue-400">~</span>
          <span className="text-white">$ ./initiate_contact.sh</span>
        </div>

        <div className="text-zinc-300 space-y-4 mb-6">
          <p>{">"} INITIALIZING SECURE CHANNEL...</p>
          <p>{">"} READY FOR TRANSMISSION.</p>
          
          <div className="flex gap-4 mt-4">
            <a href="mailto:heet16@gmail.com" className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded text-white transition-colors border border-white/10">
              [ Send Email ]
            </a>
            <a href="https://linkedin.com/in/heetparikh" target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-[#0a66c2]/20 hover:bg-[#0a66c2]/40 rounded text-[#0a66c2] transition-colors border border-[#0a66c2]/30">
              [ Ping LinkedIn ]
            </a>
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-white/10 flex items-center gap-2">
          <span className="text-green-400">guest@portfolio</span>
          <span className="text-white">~ $</span>
          <span className="w-2 h-4 bg-zinc-400 animate-pulse inline-block" />
        </div>
      </div>
    </div>
  );
}