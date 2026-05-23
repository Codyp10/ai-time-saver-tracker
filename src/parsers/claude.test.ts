import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/claude-minimal.json";
import { parseClaudeExport, unwrapClaudeExport } from "./claude";
import { detectPlatformFromEntries } from "./detectPlatform";
import { decodeText, extractZip } from "./zip";
import { unzipSync, zipSync } from "fflate";

describe("parseClaudeExport", () => {
  it("parses chat_messages with text and content blocks", () => {
    const convos = parseClaudeExport(fixture);
    expect(convos).toHaveLength(1);
    expect(convos[0]!.platform).toBe("claude");
    expect(convos[0]!.messages).toHaveLength(2);
    expect(convos[0]!.messages[0]!.role).toBe("user");
    expect(convos[0]!.messages[1]!.text).toContain("draft");
  });

  it("accepts sender user as well as human", () => {
    const convos = parseClaudeExport([
      {
        uuid: "conv-2",
        name: "Test",
        created_at: "2025-04-11T12:00:00.000Z",
        updated_at: "2025-04-11T12:01:00.000Z",
        chat_messages: [
          {
            uuid: "msg-u",
            sender: "user",
            created_at: "2025-04-11T12:00:00.000Z",
            text: "Hello",
          },
          {
            uuid: "msg-a",
            sender: "assistant",
            created_at: "2025-04-11T12:01:00.000Z",
            text: "Hi there",
          },
        ],
      },
    ]);
    expect(convos[0]!.messages[0]!.role).toBe("user");
  });

  it("unwraps nested conversation arrays", () => {
    const wrapped = { conversations: fixture };
    expect(unwrapClaudeExport(wrapped)).toHaveLength(1);
  });
});

describe("Claude ZIP detection", () => {
  it("detects Claude from conversations.json in a zip", async () => {
    const zipBytes = zipSync({
      "conversations.json": new TextEncoder().encode(JSON.stringify(fixture)),
      "users.json": new TextEncoder().encode("{}"),
    });
    const file = new File([zipBytes], "claude-export.zip", { type: "application/zip" });
    const entries = await extractZip(file);
    expect(detectPlatformFromEntries(entries)).toBe("claude");
    const conversationsJson = entries.find((e) => e.path.endsWith("conversations.json"));
    expect(parseClaudeExport(JSON.parse(decodeText(conversationsJson!.data)))).toHaveLength(1);
  });

  it("finds conversations.json in nested folders", () => {
    const zipBytes = zipSync({
      "export/conversations.json": new TextEncoder().encode(JSON.stringify(fixture)),
    });
    const entries = Object.entries(unzipSync(zipBytes))
      .filter(([path]) => !path.endsWith("/"))
      .map(([path, data]) => ({ path, data }));
    expect(detectPlatformFromEntries(entries)).toBe("claude");
  });
});
