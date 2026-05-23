import { describe, expect, it } from "vitest";
import type { MonthlyReport, NormalizedConversation, Platform } from "@/types/conversation";
import {
  computePlatformBreakdown,
  computeTopicMix,
  computeTrendForecast,
  computeUsageHeatmap,
} from "./insights";

function mockMessage(day: number, hour = 10) {
  return {
    id: `m-${day}-${hour}`,
    role: "user" as const,
    text: "hello",
    timestamp: new Date(`2024-06-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00Z`),
  };
}

function mockConv(platform: Platform, day: number, category = "coding" as const): NormalizedConversation {
  return {
    id: `${platform}-${day}`,
    platform,
    title: "Debug React component",
    messages: [mockMessage(day), { ...mockMessage(day, 11), role: "assistant", text: "fix it" }],
    createdAt: new Date(`2024-06-${String(day).padStart(2, "0")}T10:00:00Z`),
    updatedAt: new Date(`2024-06-${String(day).padStart(2, "0")}T11:00:00Z`),
  };
}

function mockReport(
  monthKey: string,
  platforms: Platform[],
  minutesSaved = 60,
): MonthlyReport {
  const analyses = platforms.map((p, i) => ({
    conversation: mockConv(p, i + 1),
    category: "coding" as const,
    classificationConfidence: "high" as const,
    study: "Software engineering",
    minutesSpent: 10,
    minutesSaved: minutesSaved / platforms.length,
    assistantWords: 100,
  }));

  const byPlatform = {
    chatgpt: 0,
    claude: 0,
    grok: 0,
    gemini: 0,
    cursor: 0,
    claude_code: 0,
  };
  for (const a of analyses) {
    byPlatform[a.conversation.platform] += a.minutesSaved;
  }

  return {
    id: monthKey,
    monthKey,
    createdAt: new Date().toISOString(),
    skillLevel: "intermediate",
    conversations: analyses.map((a) => a.conversation),
    analyses,
    totals: {
      minutesSpent: 30,
      minutesSaved,
      minutesSavedLow: 40,
      minutesSavedHigh: 80,
      conversationCount: analyses.length,
      byPlatform,
      byCategory: {
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
      },
      byModel: {},
      busiestHour: 10,
      busiestDay: "Monday",
    },
    usedLlmClassifier: false,
  };
}

describe("computePlatformBreakdown", () => {
  it("returns conversation and time saved percentages per platform", () => {
    const report = mockReport("2024-06", ["chatgpt", "chatgpt", "claude"], 90);
    const rows = computePlatformBreakdown(report);

    expect(rows).toHaveLength(2);
    expect(rows[0]!.platform).toBe("ChatGPT");
    expect(rows[0]!.conversationPct).toBe(67);
    expect(rows[0]!.minutesSaved).toBe(60);
    expect(rows[1]!.platform).toBe("Claude");
    expect(rows[1]!.conversationPct).toBe(33);
  });
});

describe("computeUsageHeatmap", () => {
  it("builds calendar days with activity counts for the month", () => {
    const report = mockReport("2024-06", ["chatgpt", "claude"]);
    const heatmap = computeUsageHeatmap(report);

    expect(heatmap.year).toBe(2024);
    expect(heatmap.month).toBe(6);
    expect(heatmap.days).toHaveLength(30);
    expect(heatmap.days[0]!.activity).toBe(2);
    expect(heatmap.days[1]!.activity).toBe(2);
    expect(heatmap.maxActivity).toBeGreaterThan(0);
  });
});

describe("computeTopicMix", () => {
  it("groups categories into topic buckets when classification exists", () => {
    const report = mockReport("2024-06", ["chatgpt"]);
    report.analyses[0]!.category = "writing";
    report.totals.byCategory.coding = 0;
    report.totals.byCategory.writing = 60;

    const mix = computeTopicMix(report);
    expect(mix.hasData).toBe(true);
    expect(mix.buckets.find((b) => b.key === "writing")?.conversations).toBe(1);
  });

  it("returns hasData false when only unclassified other tasks", () => {
    const report = mockReport("2024-06", ["chatgpt"]);
    report.analyses[0]!.category = "other";
    report.analyses[0]!.classificationConfidence = "low";
    report.totals.byCategory.coding = 0;
    report.totals.byCategory.other = 60;

    const mix = computeTopicMix(report);
    expect(mix.hasData).toBe(false);
  });
});

describe("computeTrendForecast", () => {
  it("projects annual hours from recent monthly averages", () => {
    const current = mockReport("2024-06", ["chatgpt"], 120);
    const history = [
      mockReport("2024-04", ["chatgpt"], 60),
      mockReport("2024-05", ["chatgpt"], 90),
    ];

    const forecast = computeTrendForecast(current, history);
    expect(forecast.hasForecast).toBe(true);
    expect(forecast.monthsUsed).toBe(3);
    expect(forecast.monthlyAverageHours).toBe(1.5);
    expect(forecast.projectedAnnualHours).toBe(18);
    expect(forecast.trendDirection).toBe("up");
    expect(forecast.recentChangePct).toBe(33);
  });

  it("works with a single month of history", () => {
    const current = mockReport("2024-06", ["chatgpt"], 60);
    const forecast = computeTrendForecast(current, []);
    expect(forecast.hasForecast).toBe(true);
    expect(forecast.projectedAnnualHours).toBe(12);
  });
});
