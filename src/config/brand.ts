export const brand = {
  name: "AI Wrapped",
  wordmark: {
    primary: "AI",
    accent: "Wrapped",
  },
  shortName: "AI Wrapped",
  tagline: "Your AI month, wrapped.",
  heroHeadline: "Your AI month, wrapped.",
  heroSubcopy:
    "Upload your chat exports. See how much time AI saved you. Free, private, and runs entirely in your browser.",
  heroTrustLine: ["Free", "No signup", "Local-only"] as const,
  howItWorks: [
    "Export your chats from ChatGPT, Claude, Cursor, and more.",
    "Drop files here — parsed locally, never uploaded.",
    "Get your wrap with time saved and breakdowns.",
  ] as const,
  privacyLine: "Free. No account. Your files never leave your browser.",
  platformsLine:
    "Works with ChatGPT, Claude, Grok, Gemini, Claude Code, and Cursor.",
  samplePreview: {
    hoursSaved: "47 hrs",
    savedLabel: "saved",
    platformSummary: "Estimated time saved across ChatGPT, Claude, and Cursor.",
    breakdown: [
      { label: "Coding", pct: 62, topTask: "Feature Engineering" },
      { label: "Writing", pct: 24, topTask: "Documentation" },
      { label: "Research", pct: 14, topTask: "API Discovery" },
    ] as const,
  },
  description:
    "Privacy-first monthly wrap of your AI usage — estimated time spent and time saved from your export files.",
  sharePrefix: "My AI Wrapped for",
  shareHashtag: "#AIWrapped",
  navUpload: "Get your wrap",
  processingMessage: "Wrapping your month…",
  footerPrivacy: "Built for privacy.",
  url: "",
} as const;
