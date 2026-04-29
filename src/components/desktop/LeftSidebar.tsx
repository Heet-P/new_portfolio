import { MdxIcon, FolderIcon, ContactIcon } from "@/components/ui/PortfolioIcons";

const GearIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

interface LeftSidebarProps {
  onOpen: (id: string, rect: DOMRect) => void;
  openWindows: string[];
  minimizedWindows: string[];
}

export function LeftSidebar({ onOpen, openWindows, minimizedWindows }: LeftSidebarProps) {
  const shortcuts = [
    { id: "home",     name: "About",    icon: MdxIcon },
    { id: "projects", name: "Projects", icon: MdxIcon },
    { id: "journey",  name: "Journey",  icon: MdxIcon },
    { id: "videos",   name: "Videos",   icon: FolderIcon },
    { id: "docs",     name: "Docs",     icon: FolderIcon },
    { id: "contact",  name: "Contact",  icon: ContactIcon },
    { id: "settings", name: "Settings", icon: GearIcon },
  ];

  return (
    <aside className="absolute top-14 bottom-2 left-2 sm:left-4 lg:left-6 flex flex-col justify-evenly z-40 w-16 sm:w-20 lg:w-24 overflow-hidden">
      {shortcuts.map((shortcut) => {
        const isRunning = openWindows.includes(shortcut.id);
        const isMinimized = minimizedWindows.includes(shortcut.id);

        return (
          <button
            key={shortcut.id}
            onClick={(e) => onOpen(shortcut.id, e.currentTarget.getBoundingClientRect())}
            className="flex flex-col items-center justify-center gap-0.5 cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-lg p-1"
            aria-label={`Open ${shortcut.name} window`}
          >
            <div className={`w-9 h-9 sm:w-11 sm:h-11 lg:w-14 lg:h-14 flex items-center justify-center rounded-lg transition-colors p-0.5 sm:p-1 ${isRunning && !isMinimized ? "bg-white/10" : "group-hover:bg-white/10"}`}>
              <shortcut.icon className="w-7 h-7 sm:w-9 sm:h-9 lg:w-12 lg:h-12 transform group-hover:scale-105 transition-transform" />
            </div>
            <span className="text-[9px] sm:text-[10px] lg:text-[12px] font-medium text-white text-center leading-tight px-1" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}>
              {shortcut.name}
            </span>
            <div className={`w-1 h-1 rounded-full bg-orange-500 transition-opacity ${isRunning ? "opacity-100" : "opacity-0"}`} />
          </button>
        );
      })}
    </aside>
  );
}
