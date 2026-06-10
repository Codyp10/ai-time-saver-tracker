import { describe, expect, it } from "vitest";
import { filterConversationsByMonth, listMonthsInConversations } from "@/parsers";
import type { NormalizedConversation } from "@/types/conversation";

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

describe("listMonthsInConversations", () => {
  it("returns an empty list for no conversations", () => {
    expect(listMonthsInConversations([])).toEqual([]);
  });

  it("deduplicates months and sorts ascending across years", () => {
    const chats = [
      conversation(new Date(2025, 11, 20)),
      conversation(new Date(2026, 0, 5)),
      conversation(new Date(2025, 11, 2)),
      conversation(new Date(2025, 3, 14)),
    ];

    expect(listMonthsInConversations(chats)).toEqual([
      { year: 2025, month: 4 },
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
    ]);
  });

  it("enumerates months that round-trip through the month filter", () => {
    const chats = [
      conversation(new Date(2025, 2, 1)),
      conversation(new Date(2025, 2, 28)),
      conversation(new Date(2025, 5, 10)),
    ];

    const months = listMonthsInConversations(chats);
    const total = months.reduce(
      (sum, m) => sum + filterConversationsByMonth(chats, m.year, m.month).length,
      0,
    );

    expect(months).toHaveLength(2);
    expect(total).toBe(chats.length);
  });
});
