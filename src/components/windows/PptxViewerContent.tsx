"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Transition types ──────────────────────────────────────────────────────────
type TransitionType = "origami" | "push" | "morph";

function buildVariants(dir: number, type: TransitionType) {
  const eIn = [0.16, 1, 0.3, 1] as [number, number, number, number];
  const eOut = [0.5, 0, 0.75, 0] as [number, number, number, number];

  if (type === "origami") {
    return {
      initial: { rotateY: dir > 0 ? 90 : -90, opacity: 0 },
      animate: { rotateY: 0, opacity: 1, transition: { duration: 0.6, ease: eIn } },
      exit: { rotateY: dir > 0 ? -90 : 90, opacity: 0, transition: { duration: 0.45, ease: eOut } },
    };
  }
  if (type === "push") {
    return {
      initial: { x: dir > 0 ? "100%" : "-100%" },
      animate: { x: 0, transition: { duration: 0.48, ease: eIn } },
      exit: { x: dir > 0 ? "-50%" : "50%", opacity: 0, transition: { duration: 0.38, ease: eOut } },
    };
  }
  // morph / dissolve
  return {
    initial: { opacity: 0, scale: 0.95, filter: "blur(6px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)", transition: { duration: 0.45, ease: eIn } },
    exit: { opacity: 0, scale: 1.04, filter: "blur(6px)", transition: { duration: 0.32, ease: eOut } },
  };
}

// ─── Slide definitions ─────────────────────────────────────────────────────────
const SLIDES: { id: number; transition: TransitionType; render: () => React.ReactNode }[] = [
  {
    id: 0,
    transition: "morph",
    render: () => (
      <div className="flex flex-col items-center justify-center h-full text-center px-12 gap-6">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-orange-500/5 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-orange-600/5 blur-3xl" />
        </div>
        <span className="text-orange-400/60 font-mono text-[11px] uppercase tracking-[0.3em]">
          Portfolio · Presentation Deck
        </span>
        <h1 className="text-5xl font-black text-white leading-tight relative">
          Why Should You<br />
          <span className="text-transparent bg-clip-text bg-linear-to-r from-orange-400 to-red-500">
            Hire Me?
          </span>
        </h1>
        <div className="flex items-center gap-4">
          <div className="w-14 h-px bg-orange-500/30" />
          <p className="text-zinc-300 font-light text-lg">
            By <span className="text-white font-semibold">Heet Parikh</span>
          </p>
          <div className="w-14 h-px bg-orange-500/30" />
        </div>
        <div className="flex gap-2.5 flex-wrap justify-center mt-1">
          {["Full-Stack Engineer", "AI Builder", "Product Thinker"].map((tag) => (
            <span key={tag} className="bg-white/5 border border-white/10 text-zinc-300 text-xs px-3 py-1 rounded-full font-mono">
              {tag}
            </span>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 1,
    transition: "push",
    render: () => (
      <div className="flex flex-col h-full px-12 py-9 gap-7">
        <div>
          <div className="text-orange-400 font-mono text-[10px] uppercase tracking-[0.2em] mb-1.5">01 — Technical Skills</div>
          <h2 className="text-3xl font-bold text-white">Technical Arsenal</h2>
          <div className="w-10 h-0.5 bg-linear-to-r from-orange-500 to-transparent mt-2.5" />
        </div>
        <div className="grid grid-cols-2 gap-4 flex-1">
          {[
            { cat: "Frontend", techs: ["React", "Next.js 15", "TypeScript", "Tailwind CSS", "Framer Motion"] },
            { cat: "Backend", techs: ["Python", "FastAPI", "Node.js", "PostgreSQL", "REST APIs"] },
            { cat: "AI / ML", techs: ["Claude API", "LangChain", "OpenAI", "RAG Pipelines"] },
            { cat: "Tools & Infra", techs: ["Git", "Vercel", "Supabase", "Docker"] },
          ].map(({ cat, techs }) => (
            <div key={cat} className="bg-white/3 border border-white/[0.07] rounded-xl p-4 flex flex-col gap-3">
              <div className="text-orange-400 text-[10px] font-mono uppercase tracking-wider">{cat}</div>
              <div className="flex flex-wrap gap-1.5">
                {techs.map((t) => (
                  <span key={t} className="bg-white/[0.07] text-zinc-200 text-xs px-2.5 py-0.5 rounded-md font-medium border border-white/8">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-zinc-500 text-xs font-mono">
          End-to-end product development — database schema to polished UI.
        </p>
      </div>
    ),
  },
  {
    id: 2,
    transition: "origami",
    render: () => (
      <div className="flex flex-col h-full px-12 py-9 gap-7">
        <div>
          <div className="text-orange-400 font-mono text-[10px] uppercase tracking-[0.2em] mb-1.5">02 — Portfolio</div>
          <h2 className="text-3xl font-bold text-white">What I&apos;ve Shipped</h2>
          <div className="w-10 h-0.5 bg-linear-to-r from-orange-500 to-transparent mt-2.5" />
        </div>
        <div className="flex flex-col gap-4 flex-1 justify-center">
          {[
            {
              name: "emoDiary",
              role: "Lead Developer",
              desc: "AI-powered journaling app that reads emotional context using Claude API with memory across sessions.",
              tags: ["Next.js", "Claude AI", "PostgreSQL"],
              accent: "border-purple-500/25 from-purple-500/10 to-purple-900/5",
              dot: "bg-purple-400",
            },
            {
              name: "FormAI",
              role: "Full-Stack Dev",
              desc: "Government form assistant that simplifies complex bureaucratic forms through conversational AI.",
              tags: ["React", "Python", "FastAPI"],
              accent: "border-blue-500/25 from-blue-500/10 to-blue-900/5",
              dot: "bg-blue-400",
            },
            {
              name: "QuizVerse",
              role: "Full-Stack Dev",
              desc: "Gamified quiz platform with AI-generated questions, real-time leaderboards, and adaptive difficulty.",
              tags: ["Next.js", "TypeScript", "Supabase"],
              accent: "border-green-500/25 from-green-500/10 to-green-900/5",
              dot: "bg-green-400",
            },
          ].map((p) => (
            <div key={p.name} className={`bg-linear-to-r ${p.accent} border rounded-xl p-4 flex items-start gap-4`}>
              <div className={`w-2 h-2 rounded-full ${p.dot} mt-1.5 shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-1">
                  <span className="text-white font-bold">{p.name}</span>
                  <span className="text-zinc-500 text-xs font-mono">{p.role}</span>
                </div>
                <p className="text-zinc-400 text-sm leading-snug">{p.desc}</p>
              </div>
              <div className="flex gap-1.5 flex-wrap shrink-0 max-w-[130px]">
                {p.tags.map((t) => (
                  <span key={t} className="bg-black/25 text-zinc-400 text-[10px] px-2 py-0.5 rounded font-mono border border-white/[0.07]">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 3,
    transition: "push",
    render: () => (
      <div className="flex flex-col h-full px-12 py-9 gap-7">
        <div>
          <div className="text-orange-400 font-mono text-[10px] uppercase tracking-[0.2em] mb-1.5">03 — Value Proposition</div>
          <h2 className="text-3xl font-bold text-white">What You Actually Get</h2>
          <div className="w-10 h-0.5 bg-linear-to-r from-orange-500 to-transparent mt-2.5" />
        </div>
        <div className="flex flex-col gap-6 flex-1 justify-center">
          {[
            {
              n: "01",
              title: "Ships Production-Ready Code",
              desc: "Clean architecture, TypeScript everywhere, no cowboy code. PRs you'll want to approve.",
            },
            {
              n: "02",
              title: "Moves Fast, Builds Right",
              desc: "Rapid iteration without sacrificing maintainability. Thinks about the next engineer reading the code.",
            },
            {
              n: "03",
              title: "Thinks in Full Systems",
              desc: "Considers every layer — UX flow, API contract, database schema — not just the assigned ticket.",
            },
            {
              n: "04",
              title: "AI-Native by Default",
              desc: "Knows when AI adds real value vs. hype. Integrates Claude, OpenAI and LLMs into production products.",
            },
          ].map(({ n, title, desc }) => (
            <div key={n} className="flex items-start gap-5">
              <div className="text-orange-500/50 font-black text-2xl font-mono leading-none shrink-0 w-8 pt-0.5">{n}</div>
              <div>
                <div className="text-white font-semibold text-base mb-0.5">{title}</div>
                <div className="text-zinc-400 text-sm leading-relaxed">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 4,
    transition: "morph",
    render: () => (
      <div className="flex flex-col items-center justify-center h-full text-center px-12 gap-7 relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-orange-500/5 blur-3xl" />
        </div>
        <div className="text-orange-400/60 font-mono text-[11px] uppercase tracking-[0.3em]">04 — Let&apos;s Connect</div>
        <h2 className="text-4xl font-black text-white leading-tight">
          Let&apos;s Build Something<br />
          <span className="text-transparent bg-clip-text bg-linear-to-r from-orange-400 to-red-500">
            Great Together.
          </span>
        </h2>
        <div className="flex flex-col gap-2.5 mt-1">
          {[
            { label: "Email", value: "heet16@gmail.com" },
            { label: "LinkedIn", value: "linkedin.com/in/heetparikh" },
            { label: "GitHub", value: "github.com/Heet-P" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-2 justify-center">
              <span className="text-zinc-600 font-mono text-xs w-16 text-right">{label}</span>
              <span className="text-zinc-300 font-mono text-sm">{value}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/25 text-orange-400 text-sm font-medium px-5 py-2.5 rounded-full mt-2">
          <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
          Available for Opportunities
        </div>
      </div>
    ),
  },
];

// ─── Component ─────────────────────────────────────────────────────────────────
export function PptxViewerContent() {
  const [current, setCurrent] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [activeTransition, setActiveTransition] = useState<TransitionType>(SLIDES[0].transition);
  const containerRef = useRef<HTMLDivElement>(null);

  const goNext = useCallback(() => {
    if (current < SLIDES.length - 1) {
      const next = current + 1;
      setActiveTransition(SLIDES[next].transition);
      setDir(1);
      setCurrent(next);
    }
  }, [current]);

  const goPrev = useCallback(() => {
    if (current > 0) {
      const next = current - 1;
      setActiveTransition(SLIDES[next].transition);
      setDir(-1);
      setCurrent(next);
    }
  }, [current]);

  const goTo = useCallback((i: number) => {
    if (i === current) return;
    setActiveTransition(SLIDES[i].transition);
    setDir(i > current ? 1 : -1);
    setCurrent(i);
  }, [current]);

  // Focus container so keyboard works immediately on open.
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const v = buildVariants(dir, activeTransition);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
          e.preventDefault();
          goNext();
        }
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          goPrev();
        }
      }}
      className="flex flex-col h-full bg-[#12121a] outline-none select-none"
    >
      {/* ── Slide canvas ── */}
      <div
        className="flex-1 relative overflow-hidden"
        style={{ perspective: "1400px" }}
      >
        {/* Invisible click zones — left half = prev, right half = next */}
        {current > 0 && (
          <button
            onClick={goPrev}
            aria-label="Previous slide"
            className="absolute left-0 top-0 w-1/2 h-full z-10 cursor-w-resize opacity-0"
          />
        )}
        {current < SLIDES.length - 1 && (
          <button
            onClick={goNext}
            aria-label="Next slide"
            className="absolute right-0 top-0 w-1/2 h-full z-10 cursor-e-resize opacity-0"
          />
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={v.initial}
            animate={v.animate}
            exit={v.exit}
            className="absolute inset-0 bg-[#12121a] flex flex-col"
          >
            <div className="flex-1 relative">
              {SLIDES[current].render()}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Hover arrow overlays */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20 pointer-events-none opacity-0 hover:opacity-100 transition-opacity group-hover:opacity-100">
          {current > 0 && (
            <button
              onClick={goPrev}
              className="pointer-events-auto w-9 h-9 rounded-full bg-black/50 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-black/70 transition-colors"
              aria-label="Previous slide"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
        </div>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 pointer-events-none opacity-0 hover:opacity-100 transition-opacity">
          {current < SLIDES.length - 1 && (
            <button
              onClick={goNext}
              className="pointer-events-auto w-9 h-9 rounded-full bg-black/50 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-black/70 transition-colors"
              aria-label="Next slide"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── PowerPoint-style bottom bar ── */}
      <div className="h-10 shrink-0 bg-[#1e1e26] border-t border-white/6 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={goPrev}
            disabled={current === 0}
            aria-label="Previous slide"
            className="text-zinc-500 hover:text-zinc-200 disabled:opacity-25 disabled:cursor-not-allowed transition-colors p-0.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          {/* Slide dot navigator */}
          <div className="flex items-center gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === current
                    ? "w-6 bg-orange-500"
                    : "w-1.5 bg-white/20 hover:bg-white/40"
                }`}
              />
            ))}
          </div>

          <button
            onClick={goNext}
            disabled={current === SLIDES.length - 1}
            aria-label="Next slide"
            className="text-zinc-500 hover:text-zinc-200 disabled:opacity-25 disabled:cursor-not-allowed transition-colors p-0.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-4 text-zinc-600 font-mono text-[11px]">
          <span className="text-zinc-400">
            {current + 1} <span className="text-zinc-600">/ {SLIDES.length}</span>
          </span>
          <span className="hidden sm:inline">← → to navigate</span>
          <span className="text-orange-500/60 uppercase tracking-wider text-[10px]">
            {activeTransition}
          </span>
        </div>
      </div>
    </div>
  );
}
