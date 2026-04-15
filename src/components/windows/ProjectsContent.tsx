export function ProjectsContent() {
  const projects = [
    {
      title: "Meeting Monitor",
      tech: "React • FastAPI • Vercel",
      desc: "An AI-powered meeting assistant. Engineered a buttery-smooth React frontend wired to a robust FastAPI backend for real-time processing."
    },
    {
      title: "C++ Game Engine Mechanics",
      tech: "C++ • Algorithms",
      desc: "Deep dive into low-level memory management, inheritance structures, and optimizing sorting algorithms specifically for high-performance gameplay loops."
    },
    {
      title: "GDG Technical Pitch",
      tech: "Web & Game Dev",
      desc: "Selected for the GDG Technical Team pitching round, bridging the gap between web infrastructure and interactive game environments."
    }
  ];

  return (
    <div className="p-8 h-full">
      <h2 className="text-2xl font-bold text-white mb-6 font-sans">Projects.mdx</h2>
      <div className="space-y-6">
        {projects.map((p, i) => (
          <div key={i} className="p-5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
            <div className="flex justify-between items-baseline mb-2">
              <h3 className="text-lg font-bold text-orange-400">{p.title}</h3>
              <span className="text-xs font-mono text-zinc-500">{p.tech}</span>
            </div>
            <p className="text-sm text-zinc-400">{p.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}