import { describe, expect, it } from "vitest";
import type { NormalizedConversation } from "@/types/conversation";
import { estimateMinutesSaved, assistantWordCount } from "./timeSaved";
import { classifyConversation } from "./classify";

const mockConv = (title: string, assistantText: string): NormalizedConversation => ({
  id: "1",
  platform: "chatgpt",
  title,
  messages: [
    {
      id: "u1",
      role: "user",
      text: title,
      timestamp: new Date("2024-06-01T10:00:00Z"),
    },
    {
      id: "a1",
      role: "assistant",
      text: assistantText,
      timestamp: new Date("2024-06-01T10:05:00Z"),
    },
  ],
  createdAt: new Date("2024-06-01T10:00:00Z"),
  updatedAt: new Date("2024-06-01T10:05:00Z"),
});

describe("classifyConversation", () => {
  it("classifies coding from title", () => {
    const r = classifyConversation(mockConv("Debug React hook", "fix useEffect"));
    expect(r.category).toBe("coding");
    expect(r.confidence).toBe("high");
  });
});

describe("estimateMinutesSaved", () => {
  it("returns positive savings for writing", () => {
    const conv = mockConv(
      "Draft blog post",
      "Here is a long draft with many words ".repeat(20),
    );
    const saved = estimateMinutesSaved(conv, "writing", "intermediate");
    expect(saved).toBeGreaterThan(0);
    expect(saved).toBeLessThanOrEqual(240);
  });

  it("counts assistant words", () => {
    const conv = mockConv("Hi", "one two three four five");
    expect(assistantWordCount(conv)).toBe(5);
  });
});
