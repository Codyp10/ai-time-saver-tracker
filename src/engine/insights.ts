import type { MonthlyReport, Platform, TaskCategory } from "@/types/conversation";
import { parseMonthKey } from "@/utils/month";

const PLATFORM_LABELS: Record<Platform, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  grok: "Grok",
  gemini: "Gemini",
  cursor: "Cursor",
  claude_code: "Claude Code",
};

export interface PlatformInsight {
  platform: string;
  conversations: number;
  conversationPct: number;
  minutesSaved: number;
  timeSavedPct: number;
}

export interface HeatmapDay {
  date: string;
  dayOfMonth: number;
  activity: number;
  intensity: 0 | 1 | 2 | 3 | 4;
}

export interface HeatmapData {
  year: number;
  month: number;
  days: HeatmapDay[];
  startOffset: number;
  maxActivity: number;
}

export type TopicBucket = "coding" | "writing" | "research" | "other";

export interface TopicMixBucket {
  key: TopicBucket;
  label: string;
  conversations: number;
  minutesSaved: number;
  pct: number;
}

export interface TopicMixInsight {
  hasData: boolean;
  buckets: TopicMixBucket[];
  usedLlm: boolean;
}

export interface TrendForecast {
  hasForecast: boolean;
  monthlyAverageHours: number;
  projectedAnnualHours: number;
  monthsUsed: number;
  trendDirection: "up" | "down" | "flat";
  recentChangePct: number | null;
}

const TOPIC_BUCKET_LABELS: Record<TopicBucket, string> = {
  coding: "Coding",
  writing: "Writing",
  research: "Research",
  other: "Other",
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

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export function computePlatformBreakdown(report: MonthlyReport): PlatformInsight[] {
  const convosByPlatform = new Map<string, number>();
  for (const a of report.analyses) {
    const label = PLATFORM_LABELS[a.conversation.platform] ?? a.conversation.platform;
    convosByPlatform.set(label, (convosByPlatform.get(label) ?? 0) + 1);
  }

  const totalConvos = report.analyses.length;
  const totalSaved = report.totals.minutesSaved;

  const platforms = new Set([
    ...convosByPlatform.keys(),
    ...Object.entries(report.totals.byPlatform)
      .filter(([, mins]) => mins > 0)
      .map(([p]) => PLATFORM_LABELS[p as Platform] ?? p),
  ]);

  return [...platforms]
    .map((platform) => {
      const platformKey = (Object.entries(PLATFORM_LABELS).find(([, label]) => label === platform)?.[0] ??
        platform) as Platform;
      const conversations = convosByPlatform.get(platform) ?? 0;
      const minutesSaved = report.totals.byPlatform[platformKey] ?? 0;
      return {
        platform,
        conversations,
        conversationPct: pct(conversations, totalConvos),
        minutesSaved,
        timeSavedPct: pct(minutesSaved, totalSaved),
      };
    })
    .filter((p) => p.conversations > 0 || p.minutesSaved > 0)
    .sort((a, b) => b.minutesSaved - a.minutesSaved || b.conversations - a.conversations);
}

export function computeUsageHeatmap(report: MonthlyReport): HeatmapData {
  const { year, month } = parseMonthKey(report.monthKey);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startOffset = new Date(year, month - 1, 1).getDay();

  const activityByDay = new Map<number, number>();

  for (const a of report.analyses) {
    for (const m of a.conversation.messages) {
      const ts = m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp);
      if (ts.getFullYear() === year && ts.getMonth() + 1 === month) {
        const day = ts.getDate();
        activityByDay.set(day, (activityByDay.get(day) ?? 0) + 1);
      }
    }
  }

  const maxActivity = Math.max(...activityByDay.values(), 0);

  const intensityFor = (activity: number): 0 | 1 | 2 | 3 | 4 => {
    if (activity === 0) return 0;
    if (maxActivity <= 1) return 2;
    const ratio = activity / maxActivity;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  };

  const days: HeatmapDay[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const activity = activityByDay.get(day) ?? 0;
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    days.push({ date, dayOfMonth: day, activity, intensity: intensityFor(activity) });
  }

  return { year, month, days, startOffset, maxActivity };
}

export function computeTopicMix(report: MonthlyReport): TopicMixInsight {
  const bucketStats: Record<TopicBucket, { conversations: number; minutesSaved: number }> = {
    coding: { conversations: 0, minutesSaved: 0 },
    writing: { conversations: 0, minutesSaved: 0 },
    research: { conversations: 0, minutesSaved: 0 },
    other: { conversations: 0, minutesSaved: 0 },
  };

  let classifiedCount = 0;

  for (const a of report.analyses) {
    const bucket = CATEGORY_TO_BUCKET[a.category];
    bucketStats[bucket].conversations += 1;
    bucketStats[bucket].minutesSaved += a.minutesSaved;
    if (a.classificationConfidence === "high" || a.category !== "other") {
      classifiedCount += 1;
    }
  }

  const hasClassification =
    report.usedLlmClassifier ||
    classifiedCount >= Math.ceil(report.analyses.length * 0.25);

  const totalSaved = report.totals.minutesSaved;

  const buckets: TopicMixBucket[] = (["coding", "writing", "research", "other"] as TopicBucket[]).map(
    (key) => ({
      key,
      label: TOPIC_BUCKET_LABELS[key],
      conversations: bucketStats[key].conversations,
      minutesSaved: bucketStats[key].minutesSaved,
      pct: pct(bucketStats[key].minutesSaved, totalSaved),
    }),
  );

  const hasData =
    hasClassification && buckets.some((b) => b.conversations > 0 && (b.key !== "other" || b.pct < 95));

  return {
    hasData,
    buckets: buckets.filter((b) => b.conversations > 0),
    usedLlm: report.usedLlmClassifier,
  };
}

const RECENT_MONTHS_FOR_FORECAST = 6;

export function computeTrendForecast(
  currentReport: MonthlyReport,
  history: MonthlyReport[],
): TrendForecast {
  const byMonth = new Map<string, MonthlyReport>();
  for (const r of history) {
    byMonth.set(r.monthKey, r);
  }
  byMonth.set(currentReport.monthKey, currentReport);

  const sorted = [...byMonth.values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  const recent = sorted.slice(-RECENT_MONTHS_FOR_FORECAST);

  if (recent.length === 0) {
    return {
      hasForecast: false,
      monthlyAverageHours: 0,
      projectedAnnualHours: 0,
      monthsUsed: 0,
      trendDirection: "flat",
      recentChangePct: null,
    };
  }

  const totalMinutes = recent.reduce((s, r) => s + r.totals.minutesSaved, 0);
  const monthlyAverageHours = totalMinutes / recent.length / 60;
  const projectedAnnualHours = monthlyAverageHours * 12;

  let trendDirection: "up" | "down" | "flat" = "flat";
  let recentChangePct: number | null = null;

  if (recent.length >= 2) {
    const prev = recent[recent.length - 2]!.totals.minutesSaved;
    const latest = recent[recent.length - 1]!.totals.minutesSaved;
    if (prev > 0) {
      recentChangePct = Math.round(((latest - prev) / prev) * 100);
      if (recentChangePct > 5) trendDirection = "up";
      else if (recentChangePct < -5) trendDirection = "down";
    } else if (latest > 0) {
      trendDirection = "up";
      recentChangePct = 100;
    }
  }

  return {
    hasForecast: recent.length >= 1,
    monthlyAverageHours,
    projectedAnnualHours,
    monthsUsed: recent.length,
    trendDirection,
    recentChangePct,
  };
}

export { PLATFORM_LABELS };
