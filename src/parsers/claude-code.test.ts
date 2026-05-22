import { describe, expect, it } from "vitest";
import { parseClaudeCodeJsonl, parseClaudeCodeExport } from "./claude-code";
import { parseCursorJsonExport } from "./cursor";

describe("parseClaudeCodeJsonl", () => {
  it("groups messages by sessionId", () => {
    const jsonl = [
      '{"type":"user","sessionId":"sess-1","timestamp":"2025-04-10T10:00:00.000Z","message":{"role":"user","content":[{"type":"text","text":"Fix the login bug"}]}}',
      '{"type":"assistant","sessionId":"sess-1","timestamp":"2025-04-10T10:01:00.000Z","message":{"role":"assistant","content":[{"type":"text","text":"Here is a fix..."}]}}',
    ].join("\n");

    const convos = parseClaudeCodeJsonl(jsonl);
    expect(convos).toHaveLength(1);
    expect(convos[0]!.platform).toBe("claude_code");
    expect(convos[0]!.messages).toHaveLength(2);
    expect(convos[0]!.title).toContain("login");
  });
});

describe("parseClaudeCodeExport", () => {
  it("parses JSON session array", () => {
    const convos = parseClaudeCodeExport([
      {
        id: "s1",
        title: "Refactor API",
        model: "claude-sonnet-4",
        messages: [
          { role: "user", text: "Refactor the API", timestamp: "2025-04-15T12:00:00.000Z" },
          { role: "assistant", text: "Sure, here is a plan", timestamp: "2025-04-15T12:01:00.000Z" },
        ],
      },
    ]);
    expect(convos).toHaveLength(1);
    expect(convos[0]!.messages[1]!.model).toBe("claude-sonnet-4");
  });
});

describe("parseCursorJsonExport", () => {
  it("parses Cursor JSON sessions", () => {
    const convos = parseCursorJsonExport([
      {
        id: "composer-1",
        title: "Add dark mode",
        lastUsedModel: "claude-4.5-sonnet",
        messages: [
          { role: "user", text: "Add dark mode toggle", timestamp: "2025-04-20T09:00:00.000Z" },
          { role: "assistant", text: "I will update the theme file", timestamp: "2025-04-20T09:02:00.000Z" },
        ],
      },
    ]);
    expect(convos).toHaveLength(1);
    expect(convos[0]!.platform).toBe("cursor");
    expect(convos[0]!.messages[0]!.model).toBe("claude-4.5-sonnet");
  });
});
