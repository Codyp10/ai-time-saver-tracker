import { describe, expect, it, vi } from "vitest";
import initSqlJs from "sql.js";
import { parseCursorJsonExport, parseCursorSqlite } from "./cursor";
import { ParseError } from "./errors";

vi.mock("sql.js/dist/sql-wasm.wasm?url", async () => {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  return { default: require.resolve("sql.js/dist/sql-wasm.wasm") };
});

async function buildCursorDb(rows: [string, string][]): Promise<Uint8Array> {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const SQL = await initSqlJs({
    locateFile: () => require.resolve("sql.js/dist/sql-wasm.wasm"),
  });
  const db = new SQL.Database();
  db.run("CREATE TABLE cursorDiskKV (key TEXT PRIMARY KEY, value BLOB)");
  for (const [key, value] of rows) {
    db.run("INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)", [key, value]);
  }
  const data = db.export();
  db.close();
  return data;
}

describe("parseCursorJsonExport", () => {
  it("parses sessions with messages into normalized conversations", () => {
    const conversations = parseCursorJsonExport([
      {
        id: "session-1",
        title: "Refactor parser",
        model: "gpt-4",
        messages: [
          { role: "user", text: "Refactor this", createdAt: 1717200000000 },
          { role: "assistant", text: "Done", createdAt: 1717200060000 },
        ],
      },
    ]);

    expect(conversations).toHaveLength(1);
    expect(conversations[0]!.platform).toBe("cursor");
    expect(conversations[0]!.title).toBe("Refactor parser");
    expect(conversations[0]!.messages).toHaveLength(2);
    expect(conversations[0]!.messages[0]!.role).toBe("user");
    expect(conversations[0]!.messages[1]!.model).toBe("gpt-4");
  });

  it("throws for non-array input", () => {
    expect(() => parseCursorJsonExport({ sessions: [] })).toThrow(ParseError);
  });

  it("throws when no sessions contain messages", () => {
    expect(() => parseCursorJsonExport([{ id: "empty", messages: [] }])).toThrow(ParseError);
  });
});

describe("parseCursorSqlite", () => {
  it("parses composer metadata and bubbles using the bundled wasm", async () => {
    const data = await buildCursorDb([
      ["composerData:abc", JSON.stringify({ name: "Fix bug", lastUsedModel: "claude-3.5" })],
      [
        "bubbleId:abc:1",
        JSON.stringify({ type: 1, text: "Fix this bug", createdAt: 1717200000000 }),
      ],
      [
        "bubbleId:abc:2",
        JSON.stringify({ type: 2, text: "Fixed it", createdAt: 1717200060000 }),
      ],
    ]);

    const conversations = await parseCursorSqlite(data);

    expect(conversations).toHaveLength(1);
    expect(conversations[0]!.id).toBe("abc");
    expect(conversations[0]!.title).toBe("Fix bug");
    expect(conversations[0]!.messages).toHaveLength(2);
    expect(conversations[0]!.messages[0]!.role).toBe("user");
    expect(conversations[0]!.messages[1]!.role).toBe("assistant");
    expect(conversations[0]!.messages[0]!.model).toBe("claude-3.5");
  });

  it("throws for databases without recognized tables", async () => {
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    const SQL = await initSqlJs({
      locateFile: () => require.resolve("sql.js/dist/sql-wasm.wasm"),
    });
    const db = new SQL.Database();
    db.run("CREATE TABLE unrelated (id INTEGER)");
    const data = db.export();
    db.close();

    await expect(parseCursorSqlite(data)).rejects.toThrow(ParseError);
  });

  it("throws when no chat messages are found", async () => {
    const data = await buildCursorDb([["composerData:abc", JSON.stringify({ name: "Empty" })]]);
    await expect(parseCursorSqlite(data)).rejects.toThrow(ParseError);
  });
});
