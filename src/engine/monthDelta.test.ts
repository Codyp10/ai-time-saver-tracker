import { describe, expect, it } from "vitest";
import type { MonthlyReport, Platform, TaskCategory } from "@/types/conversation";
import { computeMonthDelta, findPreviousReport } from "./monthDelta";

function mockReport(
  monthKey: string,
  minutesSaved: number,
  options: {
    platforms?: Platform[];
    byCategory?: Partial<Record<TaskCategory, number>>;
    conversationCount?: number;
  } = {},
): MonthlyReport {
  const platforms = options.platforms ?? ["chatgpt"];

  const byPlatform: Record<Platform, number> = {
    chatgpt: 0,
    claude: 0,
    grok: 0,
    gemini: 0,
    cursor: 0,
    claude_code: 0,
  };
  for (const p of platforms) {
    byPlatform[p] += minutesSaved / platforms.length;
  }

  const byCategory: Record<TaskCategory, number> = {
    writing: 0,
    email: 0,
    coding: minutesSaved,
    support: 0,
    analysis: 0,
    translation: 0,
    research: 0,
    meeting_notes: 0,
    brainstorm: 0,
    image_gen: 0,
    learning: 0,
    other: 0,
    ...options.byCategory,
  };

  return {
    id: monthKey,
    monthKey,
    createdAt: new Date().toISOString(),
    skillLevel: "intermediate",
    conversations: [],
    analyses: [],
    totals: {
      minutesSpent: 10,
      minutesSaved,
      minutesSavedLow: Math.round(minutesSaved * 0.65),
      minutesSavedHigh: Math.round(minutesSaved * 1.35),
      conversationCount: options.conversationCount ?? 5,
      byPlatform,
      byCategory,
      byModel: {},
      busiestHour: 10,
      busiestDay: "Monday",
    },
    usedLlmClassifier: false,
  };
}

describe("findPreviousReport", () => {
  it("returns the closest earlier month, skipping the current and newer ones", () => {
    const current = mockReport("2024-06", 60);
    const history = [
      mockReport("2024-07", 10),
      mockReport("2024-06", 60),
      mockReport("2024-03", 20),
      mockReport("2024-05", 30),
    ];
    expect(findPreviousReport(current, history)?.monthKey).toBe("2024-05");
  });

  it("returns null when no earlier report exists", () => {
    const current = mockReport("2024-06", 60);
    expect(findPreviousReport(current, [current])).toBeNull();
    expect(findPreviousReport(current, [])).toBeNull();
  });
});

describe("computeMonthDelta", () => {
  it("returns an empty delta when there is no previous month", () => {
    const delta = computeMonthDelta(mockReport("2024-06", 60), null);
    expect(delta.hasPrevious).toBe(false);
    expect(delta.previousMonthKey).toBeNull();
    expect(delta.newPlatforms).toEqual([]);
    expect(delta.topGainer).toBeNull();
  });

  it("computes saved-time and conversation deltas with percentages", () => {
    const previous = mockReport("2024-05", 100, { conversationCount: 10 });
    const current = mockReport("2024-06", 150, { conversationCount: 16 });

    const delta = computeMonthDelta(current, previous);
    expect(delta.hasPrevious).toBe(true);
    expect(delta.previousMonthKey).toBe("2024-05");
    expect(delta.minutesSavedDelta).toBe(50);
    expect(delta.minutesSavedPctChange).toBe(50);
    expect(delta.conversationsDelta).toBe(6);
  });

  it("guards the percentage when the previous month saved zero", () => {
    const previous = mockReport("2024-05", 0, { byCategory: { coding: 0 } });
    const current = mockReport("2024-06", 90);

    const delta = computeMonthDelta(current, previous);
    expect(delta.minutesSavedDelta).toBe(90);
    expect(delta.minutesSavedPctChange).toBeNull();
    expect(delta.topGainer?.category).toBe("coding");
    expect(delta.topGainer?.pctChange).toBeNull();
  });

  it("finds the biggest category gainer and decliner", () => {
    const previous = mockReport("2024-05", 100, {
      byCategory: { coding: 50, writing: 40, research: 10 },
    });
    const current = mockReport("2024-06", 120, {
      byCategory: { coding: 90, writing: 10, research: 20 },
    });

    const delta = computeMonthDelta(current, previous);
    expect(delta.topGainer).toEqual({ category: "coding", deltaMinutes: 40, pctChange: 80 });
    expect(delta.topDecliner).toEqual({ category: "writing", deltaMinutes: -30, pctChange: -75 });
  });

  it("detects platforms that are new this month", () => {
    const previous = mockReport("2024-05", 100, { platforms: ["chatgpt"] });
    const current = mockReport("2024-06", 100, { platforms: ["chatgpt", "cursor"] });

    const delta = computeMonthDelta(current, previous);
    expect(delta.newPlatforms).toEqual(["cursor"]);
  });

  it("reports no new platforms when usage is unchanged", () => {
    const previous = mockReport("2024-05", 100, { platforms: ["chatgpt", "claude"] });
    const current = mockReport("2024-06", 80, { platforms: ["claude"] });

    expect(computeMonthDelta(current, previous).newPlatforms).toEqual([]);
  });
});
