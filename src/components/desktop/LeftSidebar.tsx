import { MdxIcon, DemoIcon, FolderIcon, ContactIcon } from "@/components/ui/PortfolioIcons";

// A sleek native gear icon for Settings
const GearIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export function LeftSidebar({ onOpen }: { onOpen: (id: string, rect: DOMRect) => void }) {
  const shortcuts = [
    { id: "home", name: "About", icon: MdxIcon },
    { id: "projects", name: "Projects", icon: MdxIcon },
    { id: "journey", name: "Journey", icon: MdxIcon },
    { id: "videos", name: "Videos", icon: FolderIcon },
    { id: "docs", name: "Docs", icon: FolderIcon },
    { id: "contact", name: "Contact", icon: ContactIcon },
    { id: "settings", name: "Settings", icon: GearIcon },
  ];

  return (
    <aside className="absolute top-16 left-6 flex flex-col gap-6 z-40 w-24">
      {shortcuts.map((shortcut) => (
        <button
          key={shortcut.id}
          onClick={(e) => onOpen(shortcut.id, e.currentTarget.getBoundingClientRect())}
          className="flex flex-col items-center justify-center gap-1.5 cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-lg p-1"
          aria-label={`Open ${shortcut.name} window`}
        >
          <div className="w-14 h-14 flex items-center justify-center rounded-lg group-hover:bg-white/10 transition-colors p-1">
            <shortcut.icon className="w-12 h-12 transform group-hover:scale-105 transition-transform" />
          </div>
          <span className="text-[12px] font-medium text-white text-center leading-tight px-1" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}>
            {shortcut.name}
          </span>
        </button>
      ))}
    </aside>
  );
}