import { describe, expect, it } from "vitest";
import type { NormalizedConversation } from "@/types/conversation";
import { classifyConversation, normalizeLlmCategory } from "./classify";
import { TASK_TABLE } from "./taskTable";

function conv(title: string, userText: string): NormalizedConversation {
  const ts = new Date("2024-01-05T10:00:00Z");
  return {
    id: "conv-1",
    platform: "chatgpt",
    title,
    messages: [{ id: "m1", role: "user", text: userText, timestamp: ts }],
    createdAt: ts,
    updatedAt: ts,
  };
}

describe("normalizeLlmCategory", () => {
  it("accepts every category in TASK_TABLE", () => {
    for (const category of Object.keys(TASK_TABLE)) {
      expect(normalizeLlmCategory(category)).toBe(category);
    }
  });

  it("rejects strings outside the task table", () => {
    expect(normalizeLlmCategory("poetry")).toBeNull();
    expect(normalizeLlmCategory("")).toBeNull();
    expect(normalizeLlmCategory("coding-assistant")).toBeNull();
  });

  it("rejects array indices (regression: validated against placeholder array keys)", () => {
    expect(normalizeLlmCategory("0")).toBeNull();
    expect(normalizeLlmCategory("11")).toBeNull();
  });

  it("normalizes surrounding whitespace and case", () => {
    expect(normalizeLlmCategory(" coding ")).toBe("coding");
    expect(normalizeLlmCategory("WRITING")).toBe("writing");
    expect(normalizeLlmCategory("Meeting_Notes\n")).toBe("meeting_notes");
  });
});

describe("classifyConversation", () => {
  it("matches a rule with high confidence", () => {
    const result = classifyConversation(conv("Help", "Can you debug this function?"));
    expect(result).toEqual({ category: "coding", confidence: "high" });
  });

  it("falls back to other with low confidence", () => {
    const result = classifyConversation(conv("Chat", "Tell me something nice"));
    expect(result).toEqual({ category: "other", confidence: "low" });
  });
});
