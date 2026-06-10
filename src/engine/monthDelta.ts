import type { MonthlyReport, Platform, TaskCategory } from "@/types/conversation";

export interface CategoryShift {
  category: TaskCategory;
  deltaMinutes: number;
  pctChange: number | null;
}

export interface MonthDelta {
  hasPrevious: boolean;
  previousMonthKey: string | null;
  minutesSavedDelta: number;
  minutesSavedPctChange: number | null;
  conversationsDelta: number;
  topGainer: CategoryShift | null;
  topDecliner: CategoryShift | null;
  newPlatforms: Platform[];
}

const EMPTY_DELTA: MonthDelta = {
  hasPrevious: false,
  previousMonthKey: null,
  minutesSavedDelta: 0,
  minutesSavedPctChange: null,
  conversationsDelta: 0,
  topGainer: null,
  topDecliner: null,
  newPlatforms: [],
};

export function findPreviousReport(
  current: MonthlyReport,
  history: MonthlyReport[],
): MonthlyReport | null {
  let previous: MonthlyReport | null = null;
  for (const r of history) {
    if (r.monthKey >= current.monthKey) continue;
    if (!previous || r.monthKey > previous.monthKey) previous = r;
  }
  return previous;
}

function platformsUsed(report: MonthlyReport): Set<Platform> {
  const used = new Set<Platform>();
  for (const [p, mins] of Object.entries(report.totals.byPlatform) as [Platform, number][]) {
    if (mins > 0) used.add(p);
  }
  for (const a of report.analyses) {
    used.add(a.conversation.platform);
  }
  return used;
}

export function computeMonthDelta(
  current: MonthlyReport,
  previous: MonthlyReport | null,
): MonthDelta {
  if (!previous) return EMPTY_DELTA;

  const prevSaved = previous.totals.minutesSaved;
  const minutesSavedDelta = current.totals.minutesSaved - prevSaved;
  const minutesSavedPctChange =
    prevSaved > 0 ? Math.round((minutesSavedDelta / prevSaved) * 100) : null;

  let topGainer: CategoryShift | null = null;
  let topDecliner: CategoryShift | null = null;
  const categories = new Set([
    ...Object.keys(current.totals.byCategory),
    ...Object.keys(previous.totals.byCategory),
  ]) as Set<TaskCategory>;
  for (const category of categories) {
    const currentMins = current.totals.byCategory[category] ?? 0;
    const prevMins = previous.totals.byCategory[category] ?? 0;
    const deltaMinutes = currentMins - prevMins;
    if (deltaMinutes === 0) continue;
    const shift: CategoryShift = {
      category,
      deltaMinutes,
      pctChange: prevMins > 0 ? Math.round((deltaMinutes / prevMins) * 100) : null,
    };
    if (deltaMinutes > 0 && (!topGainer || deltaMinutes > topGainer.deltaMinutes)) {
      topGainer = shift;
    }
    if (deltaMinutes < 0 && (!topDecliner || deltaMinutes < topDecliner.deltaMinutes)) {
      topDecliner = shift;
    }
  }

  const prevPlatforms = platformsUsed(previous);
  const newPlatforms = [...platformsUsed(current)].filter((p) => !prevPlatforms.has(p));

  return {
    hasPrevious: true,
    previousMonthKey: previous.monthKey,
    minutesSavedDelta,
    minutesSavedPctChange,
    conversationsDelta:
      current.totals.conversationCount - previous.totals.conversationCount,
    topGainer,
    topDecliner,
    newPlatforms,
  };
}
