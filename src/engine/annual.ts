import type {
  ConversationAnalysis,
  MonthlyReport,
  Platform,
  TaskCategory,
} from "@/types/conversation";
import { monthKey, parseMonthKey } from "@/utils/month";
import type { TopicBucket } from "./insights";

const PLATFORM_LABELS: Record<Platform, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  grok: "Grok",
  gemini: "Gemini",
  cursor: "Cursor",
  claude_code: "Claude Code",
};

const CATEGORY_TO_BUCKET: Record<TaskCategory, TopicBucket> = {
  coding: "coding",
  writing: "writing",
  email: "writing",
  brainstorm: "writing",
  meeting_notes: "writing",
  translation: "writing",
  research: "research",
  analysis: "research",
  learning: "research",
  support: "other",
  image_gen: "other",
  other: "other",
};

const PERSONALITY_BY_BUCKET: Record<TopicBucket, { label: string; tagline: string }> = {
  coding: {
    label: "The Builder",
    tagline: "You ship with AI as your pair programmer.",
  },
  writing: {
    label: "The Wordsmith",
    tagline: "Drafts, edits, and polish — AI at your side.",
  },
  research: {
    label: "The Researcher",
    tagline: "You dig deep and synthesize fast.",
  },
  other: {
    label: "The Generalist",
    tagline: "A little of everything, AI everywhere.",
  },
};

export interface AnnualMonthSnapshot {
  monthKey: string;
  minutesSaved: number;
  minutesSpent: number;
  conversationCount: number;
  hasData: boolean;
}

export interface AnnualPersonality {
  label: string;
  tagline: string;
  dominantBucket: TopicBucket;
  bucketMinutesSaved: Record<TopicBucket, number>;
}

export interface AnnualTotals {
  minutesSpent: number;
  minutesSaved: number;
  minutesSavedLow: number;
  minutesSavedHigh: number;
  conversationCount: number;
  byPlatform: Record<Platform, number>;
  byCategory: Record<TaskCategory, number>;
  byModel: Record<string, number>;
  busiestHour: number;
  busiestDay: string;
}

export interface AnnualReport {
  year: number;
  monthsIncluded: number;
  monthsMissing: number;
  totals: AnnualTotals;
  byMonth: AnnualMonthSnapshot[];
  bestMonthKey: string | null;
  topConversations: ConversationAnalysis[];
  personality: AnnualPersonality;
  platformLeader: string;
}

function reportsForYear(reports: MonthlyReport[], year: number): MonthlyReport[] {
  return reports
    .filter((r) => parseMonthKey(r.monthKey).year === year)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

function mergePlatformTotals(
  target: Record<Platform, number>,
  source: Record<Platform, number>,
): void {
  for (const [p, v] of Object.entries(source) as [Platform, number][]) {
    target[p] = (target[p] ?? 0) + v;
  }
}

function mergeCategoryTotals(
  target: Record<TaskCategory, number>,
  source: Record<TaskCategory, number>,
): void {
  for (const [c, v] of Object.entries(source) as [TaskCategory, number][]) {
    target[c] = (target[c] ?? 0) + v;
  }
}

function mergeModelTotals(target: Record<string, number>, source: Record<string, number>): void {
  for (const [m, v] of Object.entries(source)) {
    target[m] = (target[m] ?? 0) + v;
  }
}

function computeBusiestFromReports(reports: MonthlyReport[]): {
  busiestHour: number;
  busiestDay: string;
} {
  const hourCounts = new Array(24).fill(0);
  const dayCounts = new Map<string, number>();

  for (const report of reports) {
    for (const a of report.analyses) {
      for (const m of a.conversation.messages) {
        const ts = m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp);
        hourCounts[ts.getHours()]++;
        const day = ts.toLocaleDateString("en-US", { weekday: "long" });
        dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
      }
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

  return { busiestHour, busiestDay };
}

function computePersonality(reports: MonthlyReport[]): AnnualPersonality {
  const bucketMinutesSaved: Record<TopicBucket, number> = {
    coding: 0,
    writing: 0,
    research: 0,
    other: 0,
  };

  for (const report of reports) {
    for (const a of report.analyses) {
      const bucket = CATEGORY_TO_BUCKET[a.category];
      bucketMinutesSaved[bucket] += a.minutesSaved;
    }
  }

  const order: TopicBucket[] = ["coding", "writing", "research", "other"];
  let dominantBucket: TopicBucket = "other";
  let max = 0;
  for (const key of order) {
    if (bucketMinutesSaved[key] > max) {
      max = bucketMinutesSaved[key];
      dominantBucket = key;
    }
  }

  const { label, tagline } = PERSONALITY_BY_BUCKET[dominantBucket];
  return { label, tagline, dominantBucket, bucketMinutesSaved };
}

function platformLeaderFromTotals(byPlatform: Record<Platform, number>): string {
  let leader: Platform = "chatgpt";
  let max = 0;
  for (const [p, mins] of Object.entries(byPlatform) as [Platform, number][]) {
    if (mins > max) {
      max = mins;
      leader = p;
    }
  }
  return max > 0 ? (PLATFORM_LABELS[leader] ?? leader) : "—";
}

export function buildAnnualReport(
  reports: MonthlyReport[],
  year: number,
): AnnualReport | null {
  const yearReports = reportsForYear(reports, year);
  if (yearReports.length === 0) return null;

  const reportByMonth = new Map(yearReports.map((r) => [r.monthKey, r]));

  const byMonth: AnnualMonthSnapshot[] = [];
  for (let month = 1; month <= 12; month++) {
    const key = monthKey(year, month);
    const report = reportByMonth.get(key);
    byMonth.push({
      monthKey: key,
      minutesSaved: report?.totals.minutesSaved ?? 0,
      minutesSpent: report?.totals.minutesSpent ?? 0,
      conversationCount: report?.totals.conversationCount ?? 0,
      hasData: !!report,
    });
  }

  const totals: AnnualTotals = {
    minutesSpent: 0,
    minutesSaved: 0,
    minutesSavedLow: 0,
    minutesSavedHigh: 0,
    conversationCount: 0,
    byPlatform: {
      chatgpt: 0,
      claude: 0,
      grok: 0,
      gemini: 0,
      cursor: 0,
      claude_code: 0,
    },
    byCategory: {
      writing: 0,
      email: 0,
      coding: 0,
      support: 0,
      analysis: 0,
      translation: 0,
      research: 0,
      meeting_notes: 0,
      brainstorm: 0,
      image_gen: 0,
      learning: 0,
      other: 0,
    },
    byModel: {},
    busiestHour: 0,
    busiestDay: "Monday",
  };

  for (const report of yearReports) {
    totals.minutesSpent += report.totals.minutesSpent;
    totals.minutesSaved += report.totals.minutesSaved;
    totals.minutesSavedLow += report.totals.minutesSavedLow;
    totals.minutesSavedHigh += report.totals.minutesSavedHigh;
    totals.conversationCount += report.totals.conversationCount;
    mergePlatformTotals(totals.byPlatform, report.totals.byPlatform);
    mergeCategoryTotals(totals.byCategory, report.totals.byCategory);
    mergeModelTotals(totals.byModel, report.totals.byModel);
  }

  const { busiestHour, busiestDay } = computeBusiestFromReports(yearReports);
  totals.busiestHour = busiestHour;
  totals.busiestDay = busiestDay;

  const includedWithData = byMonth.filter((m) => m.hasData);
  const bestMonthKey =
    includedWithData.length > 0
      ? includedWithData.reduce((a, b) =>
          a.minutesSaved >= b.minutesSaved ? a : b,
        ).monthKey
      : null;

  const topConversations = yearReports
    .flatMap((r) => r.analyses)
    .sort((a, b) => b.minutesSaved - a.minutesSaved)
    .slice(0, 10);

  return {
    year,
    monthsIncluded: yearReports.length,
    monthsMissing: 12 - yearReports.length,
    totals,
    byMonth,
    bestMonthKey,
    topConversations,
    personality: computePersonality(yearReports),
    platformLeader: platformLeaderFromTotals(totals.byPlatform),
  };
}

export function yearsWithReports(reports: MonthlyReport[]): number[] {
  const years = new Set<number>();
  for (const r of reports) {
    years.add(parseMonthKey(r.monthKey).year);
  }
  return [...years].sort((a, b) => b - a);
}
