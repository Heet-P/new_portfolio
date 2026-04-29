import { MdxIcon, FolderIcon, ContactIcon } from "@/components/ui/PortfolioIcons";

interface RightSidebarProps {
  onOpen: (id: string, rect: DOMRect) => void;
  openWindows: string[];
  minimizedWindows: string[];
}

export function RightSidebar({ onOpen, openWindows, minimizedWindows }: RightSidebarProps) {
  const shortcuts = [
    { id: "changelog", name: "Changelog",    icon: MdxIcon },
    { id: "journey",   name: "My journey",   icon: FolderIcon },
    { id: "cv",        name: "Download CV",  icon: FolderIcon },
    { id: "contact",   name: "Work with me", icon: ContactIcon },
  ];

  return (
    <aside className="absolute top-14 bottom-2 right-2 sm:right-4 lg:right-6 flex flex-col justify-evenly z-40 w-16 sm:w-20 lg:w-28 items-end overflow-hidden">
      {shortcuts.map((shortcut) => {
        const isRunning = openWindows.includes(shortcut.id);

        const iconVisual = (
          <>
            <div className={`w-9 h-9 sm:w-11 sm:h-11 lg:w-14 lg:h-14 flex items-center justify-center rounded-lg transition-colors p-0.5 sm:p-1 ${isRunning ? "bg-white/10" : "group-hover:bg-white/10"}`}>
              <shortcut.icon className="w-7 h-7 sm:w-9 sm:h-9 lg:w-12 lg:h-12 transform group-hover:scale-105 transition-transform" />
            </div>
            <span className="text-[9px] sm:text-[10px] lg:text-[12px] font-medium text-white text-center leading-tight px-1" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}>
              {shortcut.name}
            </span>
            <div className={`w-1 h-1 rounded-full bg-orange-500 transition-opacity ${isRunning ? "opacity-100" : "opacity-0"}`} />
          </>
        );

        if (shortcut.id === "cv") {
          return (
            <a
              key={shortcut.id}
              href="/Resume_HeetParikh.pdf"
              download="Resume_HeetParikh.pdf"
              className="flex flex-col items-center justify-center gap-0.5 cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-lg p-1"
              aria-label="Download CV"
            >
              {iconVisual}
            </a>
          );
        }

        return (
          <button
            key={shortcut.id}
            onClick={(e) => onOpen(shortcut.id, e.currentTarget.getBoundingClientRect())}
            className="flex flex-col items-center justify-center gap-0.5 cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-lg p-1"
            aria-label={`Open ${shortcut.name}`}
          >
            {iconVisual}
          </button>
        );
      })}
    </aside>
  );
}
