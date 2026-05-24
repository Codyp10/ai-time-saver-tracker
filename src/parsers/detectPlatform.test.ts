import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/claude-minimal.json";
import chatgptFixture from "@/fixtures/chatgpt-minimal.json";
import {
  detectPlatformFromJsonSample,
  exportJsonHasChatMessages,
  exportJsonHasMapping,
  resolveConversationsExportPlatform,
} from "./detectPlatform";

describe("export format detection", () => {
  it("detects Claude chat_messages without stringifying the full export", () => {
    expect(exportJsonHasChatMessages(fixture)).toBe(true);
    expect(exportJsonHasMapping(fixture)).toBe(false);
    expect(detectPlatformFromJsonSample(fixture)).toBe("claude");
  });

  it("detects ChatGPT mapping without stringifying the full export", () => {
    expect(exportJsonHasMapping(chatgptFixture)).toBe(true);
    expect(exportJsonHasChatMessages(chatgptFixture)).toBe(false);
    expect(detectPlatformFromJsonSample(chatgptFixture)).toBe("chatgpt");
  });

  it("reclassifies mis-detected Claude ZIP exports that are actually ChatGPT", () => {
    expect(resolveConversationsExportPlatform(chatgptFixture, "claude")).toBe("chatgpt");
    expect(resolveConversationsExportPlatform(fixture, "claude")).toBe("claude");
  });
});
