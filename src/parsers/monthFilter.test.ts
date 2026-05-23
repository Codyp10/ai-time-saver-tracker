import { describe, expect, it } from "vitest";
import { classifyMonthFilter, filterConversationsByMonth } from "@/parsers";
import type { NormalizedConversation } from "@/types/conversation";
import { getCurrentMonth, getPreviousMonth, monthKey } from "@/utils/month";

function conversation(updatedAt: Date): NormalizedConversation {
  return {
    id: updatedAt.toISOString(),
    title: "Test chat",
    platform: "chatgpt",
    createdAt: updatedAt,
    updatedAt,
    messages: [],
  };
}

describe("classifyMonthFilter", () => {
  it("returns empty_export when no conversations were parsed", () => {
    expect(classifyMonthFilter([], 2025, 4)).toBe("empty_export");
  });

  it("returns month_mismatch when conversations exist but none match the month", () => {
    const chats = [conversation(new Date(2025, 2, 15))];
    expect(classifyMonthFilter(chats, 2025, 4)).toBe("month_mismatch");
  });

  it("returns matched when at least one conversation matches the month", () => {
    const chats = [
      conversation(new Date(2025, 3, 1)),
      conversation(new Date(2025, 2, 28)),
    ];
    expect(classifyMonthFilter(chats, 2025, 4)).toBe("matched");
  });
});

describe("filterConversationsByMonth", () => {
  it("filters by calendar month using updatedAt", () => {
    const chats = [
      conversation(new Date(2025, 3, 10)),
      conversation(new Date(2025, 4, 1)),
    ];
    expect(filterConversationsByMonth(chats, 2025, 4)).toHaveLength(1);
  });

  it("supports re-filtering in memory after a month picker change", () => {
    const chats = [
      conversation(new Date(2025, 2, 20)),
      conversation(new Date(2025, 3, 5)),
    ];

    expect(filterConversationsByMonth(chats, 2025, 3)).toHaveLength(1);
    expect(filterConversationsByMonth(chats, 2025, 4)).toHaveLength(1);
  });
});

describe("month helpers", () => {
  it("returns 1-based month numbers", () => {
    const current = getCurrentMonth();
    const previous = getPreviousMonth();

    expect(current.month).toBeGreaterThanOrEqual(1);
    expect(current.month).toBeLessThanOrEqual(12);
    expect(previous.month).toBeGreaterThanOrEqual(1);
    expect(previous.month).toBeLessThanOrEqual(12);
    expect(monthKey(current.year, current.month)).toMatch(/^\d{4}-\d{2}$/);
  });
});
