export function ExperienceContent() {
  const journey = [
    {
      date: "01/2026 – Present",
      role: "Web Master",
      company: "TechGenius Club, CSPIT CHARUSAT | Anand, Gujarat",
      bullets: [
        "Led development of QuizVerse, a production-grade quiz platform purpose-built for the club's annual tech event, serving 200+ concurrent users.",
        "Implemented anti-cheating mechanisms and real-time team leaderboards, directly improving event integrity and reducing manual admin workload by 3+ hours per session.",
        "Owned the full development lifecycle — from requirements gathering with club organizers to deployment and live event support."
      ]
    }
  ];

  return (
    <div className="p-8 h-full bg-[#141414]">
      <div className="mb-10 border-b-4 border-orange-500 inline-block pr-8 pb-2">
        <h2 className="text-3xl font-black text-white tracking-tight uppercase">Work_History.mdx</h2>
      </div>
      
      <div className="space-y-10">
        {journey.map((item, i) => (
          <div key={i} className="relative border-2 border-zinc-600 bg-mac-dark p-6 shadow-[6px_6px_0px_0px_rgba(249,115,22,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(249,115,22,1)] transition-all">
            
            {/* Brutalist Date Tag */}
            <div className="absolute -top-4 -right-2 bg-orange-500 text-black font-black text-xs px-3 py-1 border-2 border-zinc-800 uppercase">
              {item.date}
            </div>
            
            <h3 className="text-xl font-black text-white uppercase tracking-wide">{item.role}</h3>
            <h4 className="text-sm font-bold text-orange-400 mb-5 tracking-widest">{item.company}</h4>
            
            <ul className="space-y-3">
              {item.bullets.map((bullet, j) => (
                 <li key={j} className="text-sm text-zinc-300 leading-relaxed flex items-start">
                   <span className="text-orange-500 mr-3 font-black text-lg leading-none">{"->"}</span>
                   {bullet}
                 </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}