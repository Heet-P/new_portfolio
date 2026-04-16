"use client";

interface SettingsContentProps {
  currentTheme: string;
  setTheme: (theme: string) => void;
}

export function SettingsContent({ currentTheme, setTheme }: SettingsContentProps) {
  const funFacts = [
    "A Gamer with Peak Rank: Immortal-1 (India) in VALORANT. Hardstuck or chilling? You decide.",
    "Dream to develop a AAA-Title.However, Current Progress: Zero Unity/UE5 knowledge. Pure delusion right now.",
    "Sustaining in life from an extensive collection of Monster Energy cans.",
    "Location : Vadodara, Gujarat, India."
  ];

  return (
    <div className="h-full bg-[#0a0a0a] text-white font-mono text-sm selection:bg-orange-500/30 overflow-y-auto no-scrollbar relative">
      
      {/* 1. THE PROFILE TERMINAL BLOCK */}
      {/* Large square window on the right with a solid offset shadow */}
      <div className="absolute top-10 right-10 w-48 h-48 border-4 border-orange-500 bg-zinc-900 shadow-[8px_8px_0_0_rgba(249,115,22,1)] z-10 hidden md:block">
         <img
           src="/images/pfp.jpeg"
           alt="Heet Parikh"
           className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
           onError={(e) => {
             e.currentTarget.style.display = 'none';
           }}
         />
      </div>

      {/* 2. SYSTEM INFORMATION AREA */}
      <div className="p-10 pr-10 md:pr-72">
        <div className="mb-12 border-b-4 border-orange-500 inline-block pr-12 pb-2">
            <h1 className="text-4xl font-black uppercase tracking-tighter">User_Settings</h1>
        </div>

        {/* Identity Card */}
        <div className="mb-12 p-6 border-2 border-zinc-700 bg-zinc-950 shadow-[4px_4px_0_0_#3f3f46] relative overflow-hidden">
          <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">Authenticated_Identity</h2>
          <h3 className="text-3xl font-black text-white uppercase tracking-tight">Heet Parikh</h3>
          <p className="text-orange-500 font-bold mt-1 tracking-widest text-xs underline decoration-2 underline-offset-4">SYS_ADMIN // GAME_ARCHITECT</p>
        </div>

        {/* Fun Facts / Diagnostics */}
        <div className="mb-12">
          <h2 className="text-xs font-bold text-zinc-600 uppercase tracking-[0.3em] mb-6 flex items-center gap-4">
            <span>Diagnostics.log</span>
            <div className="h-px bg-zinc-800 flex-1" />
          </h2>
          <div className="space-y-4">
            {funFacts.map((fact, idx) => (
              <div key={idx} className="flex items-start gap-4 p-4 border-2 border-zinc-800 bg-[#0f0f0f] hover:border-orange-500/50 transition-colors group">
                <span className="text-orange-500 font-black">[{idx}]</span>
                <span className="text-zinc-300 leading-relaxed group-hover:text-white">{fact}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Theme Engine */}
        <div>
          <h2 className="text-xs font-bold text-zinc-600 uppercase tracking-[0.3em] mb-6 flex items-center gap-4">
            <span>Env_Override.cfg</span>
            <div className="h-px bg-zinc-800 flex-1" />
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* Theme: Default */}
            <button 
              onClick={() => setTheme('default')}
              className={`flex flex-col items-center gap-4 p-4 border-2 transition-all ${
                currentTheme === 'default' 
                  ? 'border-orange-500 bg-orange-500/5 shadow-[6px_6px_0_0_rgba(249,115,22,1)]' 
                  : 'border-zinc-800 bg-zinc-950 hover:border-zinc-600'
              }`}
            >
              <div className="w-full h-24 bg-black border border-zinc-800 relative overflow-hidden">
                 <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-800 via-zinc-950 to-black opacity-50" />
                 <div className="absolute inset-0 flex items-center justify-center text-[10px] text-zinc-700 font-bold">MODE::INTERACTIVE</div>
              </div>
              <span className={`text-sm font-black uppercase tracking-tighter ${currentTheme === 'default' ? 'text-orange-500' : 'text-zinc-500'}`}>01_Default_OS</span>
            </button>

            {/* Theme: Windows OG */}
            <button 
              onClick={() => setTheme('windows')}
              className={`flex flex-col items-center gap-4 p-4 border-2 transition-all ${
                currentTheme === 'windows' 
                  ? 'border-orange-500 bg-orange-500/5 shadow-[6px_6px_0_0_rgba(249,115,22,1)]' 
                  : 'border-zinc-800 bg-zinc-950 hover:border-zinc-600'
              }`}
            >
              <div className="w-full h-24 bg-[#005A9E] border border-blue-900 relative overflow-hidden flex items-end">
                <div className="w-full h-1/3 bg-[#2a6b00]" />
                <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white/20 font-bold">MODE::RETRO_LEGACY</div>
              </div>
              <span className={`text-sm font-black uppercase tracking-tighter ${currentTheme === 'windows' ? 'text-orange-500' : 'text-zinc-500'}`}>02_Windows_XP</span>
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}