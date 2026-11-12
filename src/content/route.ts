/**
 * Single source of truth for every chapter of the ride.
 * Both the Express (plain HTML) view and the 3D ride cards read from here,
 * so adding a station = adding one entry to STATIONS.
 *
 * Facts come from HeetParikh_Resume.pdf. The phone number is deliberately
 * NOT stored anywhere in code; it only lives inside the downloadable PDF.
 */

export type StationId =
  | "departure"
  | "mct"
  | "vaani"
  | "yieldguard"
  | "formai"
  | "quizzx"
  | "solar"
  | "next"
  | "terminus";

export type StationKind = "intro" | "internship" | "project" | "open" | "end";

/** A headline number shown big on a station card, e.g. "383 ms" / "voice response". */
export interface Stat {
  value: string;
  label: string;
}

/** Optional per-station media. Left undefined until files arrive in media-inbox/. */
export interface Media {
  video?: { src: string; poster: string };
  photos?: { src: string; alt: string; w: number; h: number }[];
}

export interface Station {
  id: StationId;
  kind: StationKind;
  name: string;
  tagline: string;
  dates?: string;
  /** "current" = where the train is now; "upcoming" is drawn dashed on the route map. */
  status?: "done" | "current" | "upcoming";
  /** Paragraphs, rendered in order. */
  body: string[];
  stats?: Stat[];
  stack?: string[];
  links?: { label: string; href: string }[];
  media?: Media;
  /** Flagship projects get the largest cards and richest scenery props. */
  flagship?: boolean;
}

export const PROFILE: {
  name: string;
  role: string;
  email: string;
  github: string;
  linkedin: string;
  resume: string;
  skills: Record<string, string[]>;
} = {
  name: "Heet Parikh",
  role: "Full-stack developer, AI integrations",
  email: "heet16@gmail.com",
  github: "https://github.com/Heet-P",
  linkedin: "https://www.linkedin.com/in/heetparikh/",
  resume: "/HeetParikh_Resume.pdf",
  // Grouped exactly as on the resume.
  skills: {
    Languages: ["JavaScript", "TypeScript", "Python", "C++", "SQL", "HTML", "CSS"],
    Frontend: ["Next.js", "React.js", "Vite", "Tailwind CSS"],
    Backend: ["Node.js", "Express.js", "FastAPI", "REST APIs", "WebSockets"],
    "AI and Machine Learning": ["ResNet", "XGBoost", "Logistic Regression", "Sarvam AI"],
    "Tools and Platforms": [
      "Git",
      "GitHub",
      "Docker",
      "Supabase",
      "Twilio",
      "Stripe",
      "Razorpay",
      "Vercel",
    ],
  },
};

// Order matters: it is the order of the ride, the route map and the Express page.
export const STATIONS: Station[] = [
  {
    id: "departure",
    kind: "intro",
    name: "Departure",
    tagline: "Full-stack developer. AI integrations.",
    body: [
      "Heet Parikh is a third-year B.Tech student in Computer Science and Engineering at CSPIT, CHARUSAT. CGPA 8.69.",
      "He builds web products in Next.js and TypeScript, and wires AI into them: voice agents, orchestration over MCP, and ranking models.",
      "He is President of the TechGenius Club.",
    ],
    stats: [
      { value: "8.69", label: "CGPA" },
      { value: "2", label: "hackathon podiums" },
    ],
    links: [
      { label: "GitHub", href: PROFILE.github },
      { label: "LinkedIn", href: PROFILE.linkedin },
      { label: "Resume", href: PROFILE.resume },
    ],
  },
  {
    id: "mct",
    kind: "internship",
    name: "MCT IT Solutions",
    tagline: "Payment flows that feel instant.",
    dates: "05/2026 - 06/2026",
    status: "done",
    body: [
      "Software Intern in Ahmedabad. Built payment workflow modules in Next.js and TypeScript, used across 5+ e-commerce checkouts.",
      "Tuned payment UI rendering and interaction flows. Checkout interaction delay dropped by an estimated 25%.",
      "Wrote reusable payment components that cut the effort of adding future payment features by about 40%.",
    ],
    stats: [
      { value: "5+", label: "checkout workflows" },
      { value: "~25%", label: "lower checkout delay" },
      { value: "~40%", label: "less integration effort" },
    ],
    stack: ["Next.js", "TypeScript", "Payment workflows"],
    // TODO(heet): add repo URL (if public) - client work may stay private.
  },
  {
    id: "vaani",
    kind: "project",
    name: "Vaani AI",
    tagline: "An AI sales agent that picks up the phone.",
    dates: "09/2026",
    status: "done",
    flagship: true,
    body: [
      "Sales teams lose time on lead discovery, enrichment and first calls. Vaani handles all three: it finds leads, enriches them, and calls them with an AI voice agent.",
      "Heet built the Next.js frontend and the Supabase database, then tuned the voice pipeline on Twilio and Sarvam AI. Responses land in 383 ms, with text-to-speech under 1.5 s.",
      "After each call, Vaani writes a WhatsApp memo the lead can forward to the decision maker.",
      "Top 6 at the Chaos2Commit Hackathon.",
    ],
    stats: [
      { value: "383 ms", label: "voice response" },
      { value: "<1.5 s", label: "text-to-speech" },
      { value: "Top 6", label: "Chaos2Commit Hackathon" },
    ],
    stack: ["Next.js", "Supabase", "Twilio", "Sarvam AI"],
    // TODO(heet): add repo URL
  },
  {
    id: "yieldguard",
    kind: "project",
    name: "YieldGuard AI",
    tagline: "Finding why chips fail, from wafer images and sensor data.",
    dates: "09/2026",
    status: "done",
    flagship: true,
    body: [
      "Yield-loss root-cause analysis in semiconductor fabs needs wafer images and sensor data together. YieldGuard is an AI orchestrator for exactly that.",
      "IBM Bob coordinates 14 YieldGuard tools over the Model Context Protocol, with Gemini for reasoning and a watsonx.ai Granite fallback.",
      "A ResNet-style CNN trained on WM-811K reached 0.923 macro-F1 and beat a Vision Transformer baseline. An Isolation Forest flags anomalies in SECOM sensor data.",
      "Vector search links each new defect to past root causes.",
      "2nd place at the IBM Hackathon.",
    ],
    stats: [
      { value: "2nd", label: "IBM Hackathon" },
      { value: "0.923", label: "macro-F1 on WM-811K" },
      { value: "14", label: "MCP tools" },
    ],
    stack: ["Next.js", "ResNet", "Isolation Forest", "IBM Bob", "MCP", "Gemini", "watsonx.ai"],
    // TODO(heet): add repo URL
  },
  {
    id: "formai",
    kind: "project",
    name: "FormAI",
    tagline: "Government forms, in your own language.",
    dates: "02/2026",
    status: "done",
    body: [
      "A multilingual assistant that walks people through government forms.",
      "Placed 2nd among 100+ teams at Techathon.",
    ],
    stats: [{ value: "2nd / 100+", label: "teams at Techathon" }],
    // TODO(heet): add repo URL and stack (not listed on the resume)
  },
  {
    id: "quizzx",
    kind: "project",
    name: "QuizzX",
    tagline: "A quiz platform that holds up under a crowd.",
    dates: "2025 - 2026",
    status: "done",
    body: [
      "Built as Web Lead of the TechGenius Club. QuizzX is a quiz platform designed for 200+ concurrent users.",
    ],
    stats: [{ value: "200+", label: "concurrent users" }],
    // TODO(heet): add repo URL and stack (not listed on the resume)
  },
  {
    id: "solar",
    kind: "project",
    name: "Solar Lead Engine",
    tagline: "Which societies and factories should sales call first?",
    dates: "09/2026 - Present",
    status: "current",
    body: [
      "An SGP-II project for the solar industry. A solar farm company needs to know whom to contact first across two states, Maharashtra and Gujarat.",
      "A data-mining pipeline with LLM enrichment scores and ranks outreach targets.",
      "XGBoost and Logistic Regression classifiers, trained on synthetic lead data, reach an estimated 96-97% accuracy in initial evaluation.",
      "An evaluation pipeline and a ranking interface show the sales team who to call.",
    ],
    stats: [
      { value: "96-97%", label: "est. accuracy, initial eval" },
      { value: "2", label: "states: Maharashtra, Gujarat" },
    ],
    stack: ["XGBoost", "Logistic Regression", "LLM enrichment", "Integer Linear Programming"],
    // TODO(heet): add repo URL
  },
  {
    id: "next",
    kind: "open",
    name: "Next stop",
    tagline: "Next stop: your team?",
    status: "upcoming",
    body: [
      "No internship is lined up yet, and Heet is actively looking.",
      "He is open to SDE and AI engineering internships. If that sounds like your team, say hello.",
    ],
  },
  {
    id: "terminus",
    kind: "end",
    name: "Terminus",
    tagline: "End of the line. Say hello.",
    body: [
      "The quickest way to reach Heet is email. LinkedIn and GitHub work too.",
      "The resume is the ticket: take it with you.",
    ],
    links: [
      { label: "Email", href: `mailto:${PROFILE.email}` },
      { label: "LinkedIn", href: PROFILE.linkedin },
      { label: "GitHub", href: PROFILE.github },
      { label: "Resume", href: PROFILE.resume },
    ],
  },
];
