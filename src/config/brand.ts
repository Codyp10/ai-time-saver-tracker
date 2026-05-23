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
  url: "https://theaiwrapped.com",
  ogImage: "/og.jpg",
  ogImageAlt:
    "AI Wrapped — Your AI month, wrapped. 47 hrs saved. Upload chat exports and see how much time AI saved you.",
  sponsor: {
    enabled: true,
    label: "Sponsor",
    headline: "Get your business featured here",
    subcopy:
      "Reach privacy-minded AI users every month. This spot is open for sponsorship.",
    ctaLabel: "Get in touch",
    ctaHref: "/contact",
    icon: "campaign",
    inquiryEmail: "codyp10@gmail.com",
  },
  support: {
    heading: "Support the project",
    subcopy: "Help keep AI Wrapped free and privacy-focused.",
    coffeeUrl: "https://ko-fi.com/theaiwrapped",
    coffeeLabel: "Buy me a coffee",
  },
  github: {
    repoUrl: "https://github.com/Codyp10/ai-time-saver-tracker",
    issuesUrl: "https://github.com/Codyp10/ai-time-saver-tracker/issues/new",
    reportCopy: "Found a bug or upload issue?",
    reportLinkLabel: "Report it on GitHub",
  },
} as const;
