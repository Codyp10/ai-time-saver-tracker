import type {
  ConversationAnalysis,
  MonthlyReport,
  NormalizedConversation,
  Platform,
  SkillLevel,
  TaskCategory,
} from "@/types/conversation";
import { classifyConversation, classifyWithLlm } from "./classify";
import { CONFIDENCE_BAND_DEFAULT, CONFIDENCE_BAND_REGEX, TASK_TABLE } from "./taskTable";
import { estimateConversationMinutes } from "./timeSpent";
import { assistantWordCount, estimateMinutesSaved } from "./timeSaved";

const ALL_CATEGORIES: TaskCategory[] = [
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

const ALL_PLATFORMS: Platform[] = ["chatgpt", "claude", "grok", "gemini"];

export async function buildMonthlyReport(
  conversations: NormalizedConversation[],
  monthKey: string,
  skillLevel: SkillLevel,
  openaiApiKey?: string,
): Promise<MonthlyReport> {
  const analyses: ConversationAnalysis[] = [];
  let usedLlm = false;
  const lowConfidence: NormalizedConversation[] = [];

  for (const conv of conversations) {
    const base = classifyConversation(conv);
    if (base.confidence === "low") {
      lowConfidence.push(conv);
    } else {
      analyses.push(analyzeOne(conv, base.category, "high", skillLevel));
    }
  }

  if (openaiApiKey && lowConfidence.length > 0) {
    usedLlm = true;
    const batch = lowConfidence.slice(0, 100);
    for (const conv of batch) {
      try {
        const result = await classifyWithLlm(conv, openaiApiKey);
        analyses.push(analyzeOne(conv, result.category, result.confidence, skillLevel));
      } catch {
        const fallback = classifyConversation(conv);
        analyses.push(
          analyzeOne(conv, fallback.category, "low", skillLevel),
        );
      }
    }
    for (const conv of lowConfidence.slice(100)) {
      const fallback = classifyConversation(conv);
      analyses.push(analyzeOne(conv, fallback.category, "low", skillLevel));
    }
  } else {
    for (const conv of lowConfidence) {
      const fallback = classifyConversation(conv);
      analyses.push(analyzeOne(conv, fallback.category, "low", skillLevel));
    }
  }

  const minutesSpent = analyses.reduce((s, a) => s + a.minutesSpent, 0);
  const minutesSaved = analyses.reduce((s, a) => s + a.minutesSaved, 0);
  const band =
    usedLlm || lowConfidence.length === 0
      ? CONFIDENCE_BAND_DEFAULT
      : CONFIDENCE_BAND_REGEX;

  const byPlatform = emptyPlatformRecord();
  const byCategory = emptyCategoryRecord();
  const byModel: Record<string, number> = {};

  const hourCounts = new Array(24).fill(0);
  const dayCounts = new Map<string, number>();

  for (const a of analyses) {
    byPlatform[a.conversation.platform] += a.minutesSaved;
    byCategory[a.category] += a.minutesSaved;
    for (const m of a.conversation.messages) {
      if (m.model) {
        byModel[m.model] = (byModel[m.model] ?? 0) + 1;
      }
      hourCounts[m.timestamp.getHours()]++;
      const day = m.timestamp.toLocaleDateString("en-US", { weekday: "long" });
      dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    }
  }

  let busiestHour = 0;
  let maxHour = 0;
  hourCounts.forEach((c, h) => {
    if (c > maxHour) {
      maxHour = c;
      busiestHour = h;
    }
  });

  let busiestDay = "Monday";
  let maxDay = 0;
  dayCounts.forEach((c, d) => {
    if (c > maxDay) {
      maxDay = c;
      busiestDay = d;
    }
  });

  return {
    id: crypto.randomUUID(),
    monthKey,
    createdAt: new Date().toISOString(),
    skillLevel,
    conversations,
    analyses,
    totals: {
      minutesSpent: Math.round(minutesSpent),
      minutesSaved: Math.round(minutesSaved),
      minutesSavedLow: Math.round(minutesSaved * (1 - band)),
      minutesSavedHigh: Math.round(minutesSaved * (1 + band)),
      conversationCount: analyses.length,
      byPlatform,
      byCategory,
      byModel,
      busiestHour,
      busiestDay,
    },
    usedLlmClassifier: usedLlm,
  };
}

function analyzeOne(
  conv: NormalizedConversation,
  category: TaskCategory,
  confidence: "high" | "low",
  skillLevel: SkillLevel,
): ConversationAnalysis {
  return {
    conversation: conv,
    category,
    classificationConfidence: confidence,
    study: TASK_TABLE[category].study,
    minutesSpent: estimateConversationMinutes(conv),
    minutesSaved: estimateMinutesSaved(conv, category, skillLevel),
    assistantWords: assistantWordCount(conv),
  };
}

function emptyPlatformRecord(): Record<Platform, number> {
  return Object.fromEntries(ALL_PLATFORMS.map((p) => [p, 0])) as Record<Platform, number>;
}

function emptyCategoryRecord(): Record<TaskCategory, number> {
  return Object.fromEntries(ALL_CATEGORIES.map((c) => [c, 0])) as Record<
    TaskCategory,
    number
  >;
}

export function topCategory(
  byCategory: Record<TaskCategory, number>,
): TaskCategory {
  let best: TaskCategory = "other";
  let max = 0;
  for (const [cat, val] of Object.entries(byCategory) as [TaskCategory, number][]) {
    if (val > max) {
      max = val;
      best = cat;
    }
  }
  return best;
}

export function formatHours(minutes: number): string {
  const h = minutes / 60;
  if (h < 1) return `${Math.round(minutes)} min`;
  return `${h.toFixed(1)} hrs`;
}

export const HOURS_PER_BOOK = 5.3;
