import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/chatgpt-minimal.json";
import { parseChatGPTExport } from "./chatgpt";

describe("parseChatGPTExport", () => {
  it("flattens mapping DAG and sorts by create_time", () => {
    const convs = parseChatGPTExport(fixture);
    expect(convs).toHaveLength(1);
    const msgs = convs[0]!.messages;
    expect(msgs).toHaveLength(2);
    expect(msgs[0]!.role).toBe("user");
    expect(msgs[1]!.role).toBe("assistant");
    expect(msgs[1]!.model).toBe("gpt-4o");
  });

  it("skips epoch-0 timestamps", () => {
    const convs = parseChatGPTExport(fixture);
    expect(convs[0]!.messages.every((m) => m.timestamp.getFullYear() >= 2020)).toBe(
      true,
    );
  });
});
