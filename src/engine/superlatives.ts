import type { ConversationAnalysis } from "@/types/conversation";

export type Chronotype = "Night Owl" | "Early Bird" | "Daytime";

export interface BiggestDay {
  date: string;
  minutesSaved: number;
}

export interface Superlatives {
  activeDays: number;
  longestStreak: number;
  biggestDay: BiggestDay | null;
  afterHoursPct: number;
  chronotype: Chronotype;
}

export interface SuperlativesWindow {
  year: number;
  /** 1-12; omit to window by the whole year. */
  month?: number;
}

const WORK_START_HOUR = 8;
const WORK_END_HOUR = 18;
const CHRONOTYPE_THRESHOLD = 0.3;

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function localDateKey(ts: Date): string {
  return `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, "0")}-${String(ts.getDate()).padStart(2, "0")}`;
}

function inWindow(ts: Date, window: SuperlativesWindow): boolean {
  if (Number.isNaN(ts.getTime())) return false;
  if (ts.getFullYear() !== window.year) return false;
  return window.month === undefined || ts.getMonth() + 1 === window.month;
}

function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Math.round(Date.UTC(y!, m! - 1, d!) / 86_400_000);
}

export function longestStreakFromDates(dateKeys: Iterable<string>): number {
  const days = [...new Set(dateKeys)].map(dayNumber).sort((a, b) => a - b);
  if (days.length === 0) return 0;

  let longest = 1;
  let current = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i]! - days[i - 1]! === 1) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }
  }
  return longest;
}

export function computeSuperlatives(
  analyses: ConversationAnalysis[],
  window?: SuperlativesWindow,
): Superlatives {
  const activeDates = new Set<string>();
  const savedByDate = new Map<string, number>();
  let totalMessages = 0;
  let afterHours = 0;
  let nightMessages = 0;
  let earlyMessages = 0;

  for (const a of analyses) {
    const perMessageSaved =
      a.conversation.messages.length > 0 ? a.minutesSaved / a.conversation.messages.length : 0;
    for (const m of a.conversation.messages) {
      const ts = toDate(m.timestamp);
      if (window && !inWindow(ts, window)) continue;
      const dateKey = localDateKey(ts);
      activeDates.add(dateKey);
      savedByDate.set(dateKey, (savedByDate.get(dateKey) ?? 0) + perMessageSaved);

      const hour = ts.getHours();
      totalMessages++;
      if (hour < WORK_START_HOUR || hour >= WORK_END_HOUR) afterHours++;
      if (hour >= 22 || hour < 4) nightMessages++;
      if (hour >= 5 && hour < 9) earlyMessages++;
    }
  }

  let biggestDay: BiggestDay | null = null;
  for (const [date, minutesSaved] of savedByDate) {
    if (!biggestDay || minutesSaved > biggestDay.minutesSaved) {
      biggestDay = { date, minutesSaved };
    }
  }
  if (biggestDay) {
    biggestDay = { ...biggestDay, minutesSaved: Math.round(biggestDay.minutesSaved) };
  }

  let chronotype: Chronotype = "Daytime";
  if (totalMessages > 0) {
    if (nightMessages / totalMessages >= CHRONOTYPE_THRESHOLD) chronotype = "Night Owl";
    else if (earlyMessages / totalMessages >= CHRONOTYPE_THRESHOLD) chronotype = "Early Bird";
  }

  return {
    activeDays: activeDates.size,
    longestStreak: longestStreakFromDates(activeDates),
    biggestDay,
    afterHoursPct: totalMessages > 0 ? Math.round((afterHours / totalMessages) * 100) : 0,
    chronotype,
  };
}
