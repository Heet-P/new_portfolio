import { Search, Wifi, BatteryMedium } from "lucide-react";

export function TopNav() {
  const menuItems = ["Work", "About", "Projects", "Blog", "Contact", "More"];

  return (
    <nav className="absolute top-0 left-0 w-full h-8 flex items-center justify-between px-4 z-50 text-xs font-medium bg-zinc-950/40 backdrop-blur-2xl border-b border-white/10">
      {/* Left Menu */}
      <div className="flex items-center gap-6">
        <span className="font-bold text-white cursor-pointer hover:text-white/80 transition-colors">
          Heet Parikh
        </span>
        <ul className="flex items-center gap-4 text-zinc-300">
          {menuItems.map((item) => (
            <li key={item} className="cursor-pointer hover:text-white transition-colors">
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Right Menu & Status */}
      <div className="flex items-center gap-4 text-zinc-300">
        <button className="bg-orange-500/90 hover:bg-orange-500 text-white px-3 py-0.5 rounded shadow-[0_0_10px_rgba(249,115,22,0.3)] transition-all cursor-pointer">
          View Live
        </button>
        <div className="flex items-center gap-3">
          <Search size={14} className="cursor-pointer hover:text-white" />
          <Wifi size={14} />
          <BatteryMedium size={14} />
          <span className="text-white font-mono tracking-tighter">
            {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </nav>
  );
}