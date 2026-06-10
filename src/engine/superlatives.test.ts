import { describe, expect, it } from "vitest";
import type { ConversationAnalysis } from "@/types/conversation";
import { computeSuperlatives, longestStreakFromDates } from "./superlatives";

function mockAnalysis(timestamps: Date[], minutesSaved = 60): ConversationAnalysis {
  const first = timestamps[0] ?? new Date(2024, 5, 1, 10);
  return {
    conversation: {
      id: `c-${first.toISOString()}-${Math.random()}`,
      platform: "chatgpt",
      title: "Test",
      messages: timestamps.map((timestamp, i) => ({
        id: `m-${i}`,
        role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
        text: "hi",
        timestamp,
      })),
      createdAt: first,
      updatedAt: timestamps[timestamps.length - 1] ?? first,
    },
    category: "coding",
    classificationConfidence: "high",
    study: "Test",
    minutesSpent: 10,
    minutesSaved,
    assistantWords: 50,
  };
}

describe("longestStreakFromDates", () => {
  it("returns 0 for no dates and 1 for a single day", () => {
    expect(longestStreakFromDates([])).toBe(0);
    expect(longestStreakFromDates(["2024-06-05"])).toBe(1);
  });

  it("counts consecutive days and ignores gaps", () => {
    expect(
      longestStreakFromDates(["2024-06-01", "2024-06-02", "2024-06-03", "2024-06-07", "2024-06-08"]),
    ).toBe(3);
  });

  it("handles duplicates and unsorted input", () => {
    expect(longestStreakFromDates(["2024-06-02", "2024-06-01", "2024-06-02"])).toBe(2);
  });

  it("spans month and year boundaries", () => {
    expect(longestStreakFromDates(["2024-01-31", "2024-02-01", "2024-02-02"])).toBe(3);
    expect(longestStreakFromDates(["2024-12-31", "2025-01-01"])).toBe(2);
  });
});

describe("computeSuperlatives", () => {
  it("returns empty stats for no analyses", () => {
    const s = computeSuperlatives([]);
    expect(s.activeDays).toBe(0);
    expect(s.longestStreak).toBe(0);
    expect(s.biggestDay).toBeNull();
    expect(s.afterHoursPct).toBe(0);
    expect(s.chronotype).toBe("Daytime");
  });

  it("counts active days and longest streak from message timestamps", () => {
    const s = computeSuperlatives([
      mockAnalysis([new Date(2024, 5, 1, 10), new Date(2024, 5, 2, 10)]),
      mockAnalysis([new Date(2024, 5, 3, 10)]),
      mockAnalysis([new Date(2024, 5, 10, 10)]),
    ]);
    expect(s.activeDays).toBe(4);
    expect(s.longestStreak).toBe(3);
  });

  it("finds the biggest day by minutes saved spread across message days", () => {
    const s = computeSuperlatives([
      mockAnalysis([new Date(2024, 5, 1, 10), new Date(2024, 5, 1, 11)], 100),
      mockAnalysis([new Date(2024, 5, 2, 10)], 30),
    ]);
    expect(s.biggestDay).toEqual({ date: "2024-06-01", minutesSaved: 100 });
  });

  it("computes after-hours percentage outside 8am-6pm", () => {
    const s = computeSuperlatives([
      mockAnalysis([
        new Date(2024, 5, 1, 7),
        new Date(2024, 5, 1, 10),
        new Date(2024, 5, 1, 17),
        new Date(2024, 5, 1, 18),
      ]),
    ]);
    expect(s.afterHoursPct).toBe(50);
  });

  it("labels a Night Owl at 30%+ activity between 10pm and 4am", () => {
    const s = computeSuperlatives([
      mockAnalysis([new Date(2024, 5, 1, 23), new Date(2024, 5, 2, 2), new Date(2024, 5, 2, 12)]),
    ]);
    expect(s.chronotype).toBe("Night Owl");
  });

  it("labels an Early Bird at 30%+ activity between 5am and 9am", () => {
    const s = computeSuperlatives([
      mockAnalysis([new Date(2024, 5, 1, 6), new Date(2024, 5, 1, 8), new Date(2024, 5, 1, 14)]),
    ]);
    expect(s.chronotype).toBe("Early Bird");
  });

  it("defaults to Daytime below both thresholds", () => {
    const s = computeSuperlatives([
      mockAnalysis([
        new Date(2024, 5, 1, 10),
        new Date(2024, 5, 1, 13),
        new Date(2024, 5, 1, 15),
        new Date(2024, 5, 1, 23),
      ]),
    ]);
    expect(s.chronotype).toBe("Daytime");
  });
});

describe("computeSuperlatives with a window", () => {
  it("counts all message days when no window is given", () => {
    const s = computeSuperlatives([
      mockAnalysis([new Date(2024, 2, 12, 10), new Date(2024, 4, 5, 10)]),
    ]);
    expect(s.activeDays).toBe(2);
  });

  it("excludes message days outside the monthly window", () => {
    const s = computeSuperlatives(
      [
        mockAnalysis([
          new Date(2024, 2, 12, 10),
          new Date(2024, 2, 13, 10),
          new Date(2024, 4, 5, 10),
        ]),
      ],
      { year: 2024, month: 5 },
    );
    expect(s.activeDays).toBe(1);
  });

  it("does not let streaks span into excluded months", () => {
    const s = computeSuperlatives(
      [
        mockAnalysis([
          new Date(2024, 3, 29, 10),
          new Date(2024, 3, 30, 10),
          new Date(2024, 4, 1, 10),
          new Date(2024, 4, 2, 10),
        ]),
      ],
      { year: 2024, month: 5 },
    );
    expect(s.activeDays).toBe(2);
    expect(s.longestStreak).toBe(2);
  });

  it("never reports a biggest day outside the monthly window", () => {
    const s = computeSuperlatives(
      [
        mockAnalysis(
          [
            new Date(2024, 2, 12, 10),
            new Date(2024, 2, 12, 11),
            new Date(2024, 2, 12, 12),
            new Date(2024, 4, 6, 10),
          ],
          400,
        ),
      ],
      { year: 2024, month: 5 },
    );
    expect(s.biggestDay).toEqual({ date: "2024-05-06", minutesSaved: 100 });
  });

  it("excludes prior-year days from an annual window", () => {
    const s = computeSuperlatives(
      [
        mockAnalysis([
          new Date(2023, 11, 30, 10),
          new Date(2023, 11, 31, 10),
          new Date(2024, 0, 1, 10),
          new Date(2024, 0, 2, 10),
        ]),
      ],
      { year: 2024 },
    );
    expect(s.activeDays).toBe(2);
    expect(s.longestStreak).toBe(2);
    expect(s.biggestDay?.date).toBe("2024-01-01");
  });

  it("computes after-hours and chronotype over only in-window messages", () => {
    const s = computeSuperlatives(
      [
        mockAnalysis([
          new Date(2024, 2, 1, 23),
          new Date(2024, 2, 2, 2),
          new Date(2024, 2, 2, 3),
          new Date(2024, 4, 1, 10),
          new Date(2024, 4, 1, 12),
        ]),
      ],
      { year: 2024, month: 5 },
    );
    expect(s.afterHoursPct).toBe(0);
    expect(s.chronotype).toBe("Daytime");
  });

  it("returns empty stats when every message falls outside the window", () => {
    const s = computeSuperlatives(
      [mockAnalysis([new Date(2024, 2, 12, 10)])],
      { year: 2024, month: 5 },
    );
    expect(s.activeDays).toBe(0);
    expect(s.longestStreak).toBe(0);
    expect(s.biggestDay).toBeNull();
    expect(s.afterHoursPct).toBe(0);
    expect(s.chronotype).toBe("Daytime");
  });
});
