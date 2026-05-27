import { describe, expect, it } from "vitest";
import type { MonthlyReport, Platform } from "@/types/conversation";
import { buildAnnualReport, yearsWithReports } from "./annual";

function mockReport(
  monthKey: string,
  minutesSaved: number,
  platform: Platform = "chatgpt",
  category: "coding" | "writing" | "research" = "coding",
): MonthlyReport {
  const analysis = {
    conversation: {
      id: `c-${monthKey}`,
      platform,
      title: "Test",
      messages: [
        {
          id: "m1",
          role: "user" as const,
          text: "hi",
          timestamp: new Date(`${monthKey}-15T14:00:00Z`),
        },
        {
          id: "m2",
          role: "assistant" as const,
          text: "ok",
          timestamp: new Date(`${monthKey}-15T15:00:00Z`),
        },
      ],
      createdAt: new Date(`${monthKey}-15T14:00:00Z`),
      updatedAt: new Date(`${monthKey}-15T15:00:00Z`),
    },
    category,
    classificationConfidence: "high" as const,
    study: "Test",
    minutesSpent: 10,
    minutesSaved,
    assistantWords: 50,
  };

  const byPlatform = {
    chatgpt: 0,
    claude: 0,
    grok: 0,
    gemini: 0,
    cursor: 0,
    claude_code: 0,
  };
  byPlatform[platform] = minutesSaved;

  const byCategory = {
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
  };
  byCategory[category] = minutesSaved;

  return {
    id: monthKey,
    monthKey,
    createdAt: new Date().toISOString(),
    skillLevel: "intermediate",
    conversations: [analysis.conversation],
    analyses: [analysis],
    totals: {
      minutesSpent: 10,
      minutesSaved,
      minutesSavedLow: Math.round(minutesSaved * 0.65),
      minutesSavedHigh: Math.round(minutesSaved * 1.35),
      conversationCount: 1,
      byPlatform,
      byCategory,
      byModel: {},
      busiestHour: 14,
      busiestDay: "Monday",
    },
    usedLlmClassifier: false,
  };
}

describe("buildAnnualReport", () => {
  it("returns null when no reports match the year", () => {
    expect(buildAnnualReport([mockReport("2024-06", 60)], 2025)).toBeNull();
  });

  it("aggregates totals and month snapshots for a partial year", () => {
    const reports = [
      mockReport("2025-01", 100, "chatgpt", "coding"),
      mockReport("2025-03", 200, "claude", "writing"),
    ];
    const annual = buildAnnualReport(reports, 2025)!;

    expect(annual.year).toBe(2025);
    expect(annual.monthsIncluded).toBe(2);
    expect(annual.monthsMissing).toBe(10);
    expect(annual.totals.minutesSaved).toBe(300);
    expect(annual.totals.conversationCount).toBe(2);
    expect(annual.totals.byPlatform.chatgpt).toBe(100);
    expect(annual.totals.byPlatform.claude).toBe(200);
    expect(annual.bestMonthKey).toBe("2025-03");
    expect(annual.platformLeader).toBe("Claude");

    const jan = annual.byMonth.find((m) => m.monthKey === "2025-01");
    const feb = annual.byMonth.find((m) => m.monthKey === "2025-02");
    expect(jan?.hasData).toBe(true);
    expect(jan?.minutesSaved).toBe(100);
    expect(feb?.hasData).toBe(false);
    expect(feb?.minutesSaved).toBe(0);
  });

  it("picks personality from dominant topic bucket by minutes saved", () => {
    const reports = [
      mockReport("2025-01", 50, "chatgpt", "coding"),
      mockReport("2025-02", 120, "chatgpt", "writing"),
    ];
    const annual = buildAnnualReport(reports, 2025)!;
    expect(annual.personality.dominantBucket).toBe("writing");
    expect(annual.personality.label).toBe("The Wordsmith");
  });

  it("returns top conversations sorted by minutes saved", () => {
    const reports = [
      mockReport("2025-01", 10),
      mockReport("2025-02", 90),
      mockReport("2025-03", 40),
    ];
    const annual = buildAnnualReport(reports, 2025)!;
    expect(annual.topConversations).toHaveLength(3);
    expect(annual.topConversations[0]!.minutesSaved).toBe(90);
    expect(annual.topConversations[1]!.minutesSaved).toBe(40);
  });

  it("recomputes busiest hour from message timestamps", () => {
    const reports = [mockReport("2025-06", 60)];
    const expectedHour = new Date("2025-06-15T14:00:00Z").getHours();
    const annual = buildAnnualReport(reports, 2025)!;
    expect(annual.totals.busiestHour).toBe(expectedHour);
  });
});

describe("yearsWithReports", () => {
  it("returns distinct years descending", () => {
    const years = yearsWithReports([
      mockReport("2024-11", 10),
      mockReport("2025-01", 20),
      mockReport("2025-06", 30),
    ]);
    expect(years).toEqual([2025, 2024]);
  });
});
