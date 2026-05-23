import { describe, expect, it } from "vitest";
import type { NormalizedConversation } from "@/types/conversation";
import {
  countByPlatform,
  formatPlatformBreakdown,
  formatUploadSummary,
  mergeConversations,
} from "./merge";

function conv(
  overrides: Partial<NormalizedConversation> & Pick<NormalizedConversation, "id" | "platform">,
): NormalizedConversation {
  const now = new Date("2025-04-15T12:00:00.000Z");
  return {
    title: "Test chat",
    messages: [{ id: "m1", role: "user", text: "hi", timestamp: now }],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("mergeConversations", () => {
  it("returns all conversations when there are no duplicates", () => {
    const a = conv({ id: "a", platform: "claude", title: "One" });
    const b = conv({ id: "b", platform: "chatgpt", title: "Two" });
    const { merged, duplicatesRemoved } = mergeConversations([a, b]);
    expect(merged).toHaveLength(2);
    expect(duplicatesRemoved).toBe(0);
  });

  it("de-dupes by platform and id, keeping the version with more messages", () => {
    const sparse = conv({
      id: "same-id",
      platform: "claude",
      title: "Draft",
      messages: [{ id: "m1", role: "user", text: "hi", timestamp: new Date() }],
    });
    const rich = conv({
      id: "same-id",
      platform: "claude",
      title: "Draft",
      messages: [
        { id: "m1", role: "user", text: "hi", timestamp: new Date() },
        { id: "m2", role: "assistant", text: "hello", timestamp: new Date() },
        { id: "m3", role: "user", text: "thanks", timestamp: new Date() },
      ],
    });

    const { merged, duplicatesRemoved } = mergeConversations([sparse, rich]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.messages).toHaveLength(3);
    expect(duplicatesRemoved).toBe(1);
  });

  it("de-dupes by title and timestamp when ids differ", () => {
    const ts = new Date("2025-04-15T14:30:00.000Z");
    const fromExportA = conv({
      id: "uuid-a",
      platform: "chatgpt",
      title: "  Budget Review  ",
      updatedAt: ts,
      createdAt: ts,
    });
    const fromExportB = conv({
      id: "uuid-b",
      platform: "chatgpt",
      title: "budget review",
      updatedAt: ts,
      createdAt: ts,
      messages: [
        { id: "m1", role: "user", text: "q", timestamp: ts },
        { id: "m2", role: "assistant", text: "a", timestamp: ts },
      ],
    });

    const { merged, duplicatesRemoved } = mergeConversations([fromExportA, fromExportB]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.messages).toHaveLength(2);
    expect(duplicatesRemoved).toBe(1);
  });

  it("does not de-dupe same title with different timestamps", () => {
    const a = conv({
      id: "a",
      platform: "claude",
      title: "Weekly sync",
      updatedAt: new Date("2025-04-01T10:00:00.000Z"),
    });
    const b = conv({
      id: "b",
      platform: "claude",
      title: "Weekly sync",
      updatedAt: new Date("2025-04-08T10:00:00.000Z"),
    });

    const { merged, duplicatesRemoved } = mergeConversations([a, b]);
    expect(merged).toHaveLength(2);
    expect(duplicatesRemoved).toBe(0);
  });

  it("does not cross-de-dupe different platforms", () => {
    const ts = new Date("2025-04-15T12:00:00.000Z");
    const claude = conv({ id: "1", platform: "claude", title: "Help", updatedAt: ts });
    const chatgpt = conv({ id: "2", platform: "chatgpt", title: "Help", updatedAt: ts });

    const { merged, duplicatesRemoved } = mergeConversations([claude, chatgpt]);
    expect(merged).toHaveLength(2);
    expect(duplicatesRemoved).toBe(0);
  });
});

describe("formatUploadSummary", () => {
  it("formats file and platform breakdown", () => {
    expect(
      formatUploadSummary(3, 142, { claude: 80, chatgpt: 45, cursor: 17 }),
    ).toBe("3 files parsed → 142 conversations (Claude: 80, ChatGPT: 45, Cursor: 17)");
  });

  it("uses singular labels for one file and one conversation", () => {
    expect(formatUploadSummary(1, 1, { grok: 1 })).toBe(
      "1 file parsed → 1 conversation (Grok: 1)",
    );
  });
});

describe("countByPlatform", () => {
  it("counts conversations per platform", () => {
    const counts = countByPlatform([
      conv({ id: "1", platform: "claude" }),
      conv({ id: "2", platform: "claude" }),
      conv({ id: "3", platform: "cursor" }),
    ]);
    expect(counts).toEqual({ claude: 2, cursor: 1 });
    expect(formatPlatformBreakdown(counts)).toBe("Claude: 2, Cursor: 1");
  });
});
