import { MdxIcon, DemoIcon, FolderIcon, ContactIcon } from "@/components/ui/PortfolioIcons";

export function LeftSidebar({ onOpen }: { onOpen: (id: string, rect: DOMRect) => void }) {
  const shortcuts = [
    { id: "home", name: "home.mdx", icon: MdxIcon },
    { id: "projects", name: "projects.mdx", icon: MdxIcon },
    { id: "demo", name: "demo.mov", icon: DemoIcon },
    { id: "docs", name: "Docs", icon: FolderIcon },
  ];

  return (
    <aside className="absolute top-16 left-6 flex flex-col gap-6 z-40 w-24">
      {shortcuts.map((shortcut) => (
        <div 
          key={shortcut.id} 
          // Capture the exact location of the icon on click
          onClick={(e) => onOpen(shortcut.id, e.currentTarget.getBoundingClientRect())}
          className="flex flex-col items-center justify-center gap-1.5 cursor-pointer group"
        >
          <div className="w-14 h-14 flex items-center justify-center rounded-lg group-hover:bg-white/10 transition-colors p-1">
            <shortcut.icon className="w-12 h-12 transform group-hover:scale-105 transition-transform" />
          </div>
          <span className="text-[12px] font-medium text-white text-center leading-tight px-1" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}>
            {shortcut.name}
          </span>
        </div>
      ))}
    </aside>
  );
}