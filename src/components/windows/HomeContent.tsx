export function HomeContent() {
  return (
    <div className="p-8 text-zinc-300 font-mono text-sm leading-relaxed h-full flex flex-col justify-center max-w-2xl mx-auto">
      <div className="text-orange-500 mb-4 animate-pulse">System initialized. Auth: 24CS058.</div>
      <h1 className="text-3xl text-white font-bold mb-6 font-sans">Crafting digital experiences.</h1>
      <p className="mb-4">
        Hey, I'm Heet. I build fast, scalable web applications and dive deep into game engine architecture. 
        Whether it's optimizing React renders or managing memory in C++, I engineer software that feels native and performs flawlessly.
      </p>
      <div className="mt-8 p-4 bg-black/50 border border-white/5 rounded-md">
        <code className="text-green-400">~ $ ./execute_vision.sh</code>
        <br />
        <span className="text-zinc-500">Loading modules: Web Development, Game Design, AI Architecture... [OK]</span>
      </div>
    </div>
  );
}