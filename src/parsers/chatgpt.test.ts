import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/chatgpt-minimal.json";
import { parseChatGPTExport } from "./chatgpt";

const T0 = 1704067200;

function regeneratedConversation(currentNode: string | undefined) {
  return [
    {
      id: "conv-regen",
      title: "Regenerated answer",
      create_time: T0,
      update_time: T0 + 600,
      current_node: currentNode,
      mapping: {
        root: { id: "root", message: null, parent: null, children: ["u1"] },
        u1: {
          id: "u1",
          parent: "root",
          children: ["a1", "a2"],
          message: {
            id: "msg-u1",
            author: { role: "user" },
            create_time: T0,
            content: { parts: ["Write me a haiku"] },
          },
        },
        a1: {
          id: "a1",
          parent: "u1",
          children: [],
          message: {
            id: "msg-a1",
            author: { role: "assistant" },
            create_time: T0 + 60,
            content: { parts: ["First draft that was regenerated away"] },
          },
        },
        a2: {
          id: "a2",
          parent: "u1",
          children: [],
          message: {
            id: "msg-a2",
            author: { role: "assistant" },
            create_time: T0 + 120,
            content: { parts: ["Second draft the user kept"] },
          },
        },
      },
    },
  ];
}

describe("parseChatGPTExport", () => {
  it("walks the active branch of the mapping tree", () => {
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

  it("does not double-count regenerated sibling branches", () => {
    const convs = parseChatGPTExport(regeneratedConversation("a2"));
    expect(convs).toHaveLength(1);
    const msgs = convs[0]!.messages;
    expect(msgs).toHaveLength(2);
    expect(msgs.map((m) => m.id)).toEqual(["msg-u1", "msg-a2"]);
    expect(msgs.some((m) => m.text.includes("regenerated away"))).toBe(false);
  });

  it("keeps the branch pointed at by current_node even if a sibling is newer", () => {
    const convs = parseChatGPTExport(regeneratedConversation("a1"));
    expect(convs[0]!.messages.map((m) => m.id)).toEqual(["msg-u1", "msg-a1"]);
  });

  it("falls back to the most recent leaf when current_node is missing or dangling", () => {
    for (const currentNode of [undefined, "no-such-node"]) {
      const convs = parseChatGPTExport(regeneratedConversation(currentNode));
      expect(convs[0]!.messages.map((m) => m.id)).toEqual(["msg-u1", "msg-a2"]);
    }
  });

  it("excludes edited sibling user branches", () => {
    const convs = parseChatGPTExport([
      {
        id: "conv-edited",
        title: "Edited question",
        current_node: "a2",
        mapping: {
          root: { id: "root", message: null, parent: null, children: ["u1", "u2"] },
          u1: {
            id: "u1",
            parent: "root",
            children: ["a1"],
            message: {
              id: "msg-u1",
              author: { role: "user" },
              create_time: T0,
              content: { parts: ["Original question"] },
            },
          },
          a1: {
            id: "a1",
            parent: "u1",
            children: [],
            message: {
              id: "msg-a1",
              author: { role: "assistant" },
              create_time: T0 + 30,
              content: { parts: ["Answer to the original"] },
            },
          },
          u2: {
            id: "u2",
            parent: "root",
            children: ["a2"],
            message: {
              id: "msg-u2",
              author: { role: "user" },
              create_time: T0 + 60,
              content: { parts: ["Edited question"] },
            },
          },
          a2: {
            id: "a2",
            parent: "u2",
            children: [],
            message: {
              id: "msg-a2",
              author: { role: "assistant" },
              create_time: T0 + 90,
              content: { parts: ["Answer to the edit"] },
            },
          },
        },
      },
    ]);
    expect(convs[0]!.messages.map((m) => m.id)).toEqual(["msg-u2", "msg-a2"]);
  });

  it("guards against cycles in parent pointers", () => {
    const convs = parseChatGPTExport([
      {
        id: "conv-cycle",
        title: "Cycle",
        current_node: "b",
        mapping: {
          a: {
            id: "a",
            parent: "b",
            children: ["b"],
            message: {
              id: "msg-a",
              author: { role: "user" },
              create_time: T0,
              content: { parts: ["Hello"] },
            },
          },
          b: {
            id: "b",
            parent: "a",
            children: ["a"],
            message: {
              id: "msg-b",
              author: { role: "assistant" },
              create_time: T0 + 10,
              content: { parts: ["Hi there"] },
            },
          },
        },
      },
    ]);
    expect(convs).toHaveLength(1);
    expect(convs[0]!.messages).toHaveLength(2);
  });

  it("falls back to flattening when mapping has no parent links", () => {
    const convs = parseChatGPTExport([
      {
        id: "conv-flat",
        title: "Flat",
        mapping: {
          u1: {
            id: "u1",
            message: {
              id: "msg-u1",
              author: { role: "user" },
              create_time: T0,
              content: { parts: ["Question"] },
            },
          },
          a1: {
            id: "a1",
            message: {
              id: "msg-a1",
              author: { role: "assistant" },
              create_time: T0 + 5,
              content: { parts: ["Answer"] },
            },
          },
        },
      },
    ]);
    expect(convs[0]!.messages.map((m) => m.id)).toEqual(["msg-u1", "msg-a1"]);
  });
});
