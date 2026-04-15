"use client";

interface SettingsContentProps {
  currentTheme: string;
  setTheme: (theme: string) => void;
}

export function SettingsContent({ currentTheme, setTheme }: SettingsContentProps) {
  const funFacts = [
    "User is a gamer, mostly plays VALORANT and is Immortal-1 in India.",
    "Dreams to make his Own AAA-Game but doesn't know single peice of UNITY or UE5.",
    "Loves Collecting Monster Energy Drinks.",
    "Location: Vadodara, Gujarat, India."
  ];

  return (
    <div className="h-full bg-[#111214] text-zinc-200 flex flex-col overflow-y-auto no-scrollbar font-sans selection:bg-orange-500/30">
      
      {/* Header / Profile Section */}
      <div className="relative h-32 bg-gradient-to-r from-orange-600 to-orange-400 shrink-0">
         <div className="absolute -bottom-12 left-8">
            <div className="w-24 h-24 rounded-full border-4 border-[#111214] bg-zinc-800 overflow-hidden relative shadow-xl">
               <img 
                 src="/images/pfp.jpeg" 
                 alt="Heet Parikh" 
                 className="w-full h-full object-cover"
                 onError={(e) => {
                   e.currentTarget.style.display = 'none';
                   e.currentTarget.parentElement!.innerHTML = '<span class="flex items-center justify-center h-full text-xs font-mono text-zinc-500">PFP</span>';
                 }}
               />
            </div>
         </div>
      </div>

      <div className="pt-16 px-8 pb-8">
        <h1 className="text-2xl font-black text-white">Heet Parikh</h1>
        <p className="text-orange-500 font-mono text-xs mt-1 mb-8">SYS_ADMIN // DEVELOPER</p>

        {/* Fun Facts */}
        <div className="mb-10">
          <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4 border-b border-white/10 pb-2">User Diagnostics (Fun Facts)</h2>
          <ul className="space-y-3">
            {funFacts.map((fact, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm text-zinc-300 bg-white/5 p-3 rounded-lg border border-white/5">
                <span className="text-orange-500 mt-0.5">✦</span>
                {fact}
              </li>
            ))}
          </ul>
        </div>

        {/* Theme Settings */}
        <div>
          <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4 border-b border-white/10 pb-2">Display Settings</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Theme: Default */}
            <button 
              onClick={() => setTheme('default')}
              className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                currentTheme === 'default' ? 'border-orange-500 bg-orange-500/10' : 'border-zinc-700 bg-[#1c1d21] hover:border-zinc-500'
              }`}
            >
              <div className="w-full h-16 bg-black rounded-md border border-zinc-700 flex items-center justify-center overflow-hidden relative">
                 <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800 via-zinc-950 to-black" />
                 <span className="relative z-10 text-[10px] font-mono text-zinc-500">Bespoke Art</span>
              </div>
              <span className={`text-xs font-bold ${currentTheme === 'default' ? 'text-orange-500' : 'text-zinc-400'}`}>Default OS</span>
            </button>

            {/* Theme: Light */}
            <button 
              onClick={() => setTheme('light')}
              className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                currentTheme === 'light' ? 'border-orange-500 bg-orange-500/10' : 'border-zinc-700 bg-[#1c1d21] hover:border-zinc-500'
              }`}
            >
              <div className="w-full h-16 bg-zinc-200 rounded-md border border-zinc-300" />
              <span className={`text-xs font-bold ${currentTheme === 'light' ? 'text-orange-500' : 'text-zinc-400'}`}>Minimal Light</span>
            </button>

            {/* Theme: Windows OG */}
            <button 
              onClick={() => setTheme('windows')}
              className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                currentTheme === 'windows' ? 'border-orange-500 bg-orange-500/10' : 'border-zinc-700 bg-[#1c1d21] hover:border-zinc-500'
              }`}
            >
              <div className="w-full h-16 bg-[#005A9E] rounded-md border border-blue-800 relative overflow-hidden flex items-end">
                <div className="w-full h-1/2 bg-[#3A8000]" /> {/* Mock grassy hill */}
              </div>
              <span className={`text-xs font-bold ${currentTheme === 'windows' ? 'text-orange-500' : 'text-zinc-400'}`}>Windows OG</span>
            </button>

          </div>
        </div>

      </div>
    </div>
  );
}