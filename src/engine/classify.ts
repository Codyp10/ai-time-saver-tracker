import type { NormalizedConversation, TaskCategory } from "@/types/conversation";

export interface ClassificationResult {
  category: TaskCategory;
  confidence: "high" | "low";
}

const RULES: { category: TaskCategory; patterns: RegExp[] }[] = [
  {
    category: "email",
    patterns: [/\b(email|inbox|reply to|follow.?up)\b/i],
  },
  {
    category: "coding",
    patterns: [
      /\b(bug|debug|refactor|typescript|python|javascript|react|api|sql|git|compile|function|class|npm)\b/i,
    ],
  },
  {
    category: "translation",
    patterns: [/\b(translate|translation|localize|spanish|french|german)\b/i],
  },
  {
    category: "meeting_notes",
    patterns: [/\b(meeting|standup|sync notes|summarize (the )?call)\b/i],
  },
  {
    category: "image_gen",
    patterns: [/\b(image|logo|illustration|dall|midjourney|generate (a )?picture)\b/i],
  },
  {
    category: "support",
    patterns: [/\b(customer|ticket|support|help desk|complaint)\b/i],
  },
  {
    category: "analysis",
    patterns: [/\b(analyze|analysis|spreadsheet|forecast|financial|metrics|dashboard)\b/i],
  },
  {
    category: "research",
    patterns: [/\b(research|summarize|summary|explain|sources|literature)\b/i],
  },
  {
    category: "writing",
    patterns: [
      /\b(write|draft|compose|blog|copy|essay|report|marketing|linkedin post)\b/i,
    ],
  },
  {
    category: "brainstorm",
    patterns: [/\b(brainstorm|ideas for|pitch|outline options)\b/i],
  },
  {
    category: "learning",
    patterns: [/\b(learn|teach me|tutorial|how does .+ work|course)\b/i],
  },
];

export function classifyConversation(
  conv: NormalizedConversation,
): ClassificationResult {
  const firstUser = conv.messages.find((m) => m.role === "user");
  const text = `${conv.title} ${firstUser?.text ?? ""}`.toLowerCase();

  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      return { category: rule.category, confidence: "high" };
    }
  }

  return { category: "other", confidence: "low" };
}

export async function classifyWithLlm(
  conv: NormalizedConversation,
  apiKey: string,
): Promise<ClassificationResult> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const firstUser = conv.messages.find((m) => m.role === "user")?.text ?? "";
  const lastAssistant = [...conv.messages]
    .reverse()
    .find((m) => m.role === "assistant")?.text ?? "";
  const snippet = `Title: ${conv.title}\nUser: ${firstUser.slice(0, 1500)}\nAssistant: ${lastAssistant.slice(0, 1500)}`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Classify this AI conversation into exactly one category: writing, email, coding, support, analysis, translation, research, meeting_notes, brainstorm, image_gen, learning, other. Return JSON: {"category":"..."}`,
      },
      { role: "user", content: snippet },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw) as { category?: string };
    const cat = parsed.category as TaskCategory | undefined;
    const valid = Object.keys(TASK_TABLE_PLACEHOLDER);
    if (cat && valid.includes(cat)) {
      return { category: cat, confidence: "high" };
    }
  } catch {
    /* fall through */
  }
  return classifyConversation(conv);
}

const TASK_TABLE_PLACEHOLDER = [
  "writing",
  "email",
  "coding",
  "support",
  "analysis",
  "translation",
  "research",
  "meeting_notes",
  "brainstorm",
  "image_gen",
  "learning",
  "other",
];
