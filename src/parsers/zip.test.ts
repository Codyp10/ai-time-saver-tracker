import { describe, expect, it, vi } from "vitest";
import { MAX_ZIP_ENTRIES, MAX_ZIP_ENTRY_BYTES } from "@/config/securityLimits";
import { parseClaudeCodeJsonl } from "./claude-code";
import { ParseError } from "./errors";
import { decodeText, extractZip } from "./zip";

function sessionJsonl(sessionId: string, prompt: string, answer: string): Uint8Array {
  const lines = [
    JSON.stringify({
      type: "user",
      sessionId,
      uuid: `${sessionId}-u1`,
      timestamp: "2024-01-05T10:00:00.000Z",
      message: { role: "user", content: prompt },
    }),
    JSON.stringify({
      type: "assistant",
      sessionId,
      uuid: `${sessionId}-a1`,
      timestamp: "2024-01-05T10:00:30.000Z",
      message: { role: "assistant", content: answer, model: "claude-sonnet-4-5" },
    }),
  ];
  return new TextEncoder().encode(lines.join("\n"));
}

describe("extractZip limits", () => {
  it("rejects empty ZIP", async () => {
    // Minimal invalid/empty zip-like buffer
    await expect(extractZip(new ArrayBuffer(0))).rejects.toThrow(ParseError);
  });

  it("rejects too many entries", async () => {
    const entries: Record<string, Uint8Array> = {};
    for (let i = 0; i < MAX_ZIP_ENTRIES + 1; i++) {
      entries[`file${i}.txt`] = new Uint8Array([65]);
    }
    // Simulate post-unzip validation by calling internal logic via extractZip mock path
    // We test validateZipEntries indirectly by constructing a zip with fflate is complex;
    // instead import validation through a minimal zip created manually.
    // For unit test, directly test the error path by mocking unzip output is not exposed.
    // Use a helper: create zip with many small files using fflate zip sync.
    const { zipSync } = await import("fflate");
    const zipData = zipSync(entries);
    await expect(extractZip(zipData.buffer)).rejects.toMatchObject({
      code: "ZIP_TOO_LARGE",
    });
  });

  it("rejects oversized single entry", async () => {
    const { zipSync } = await import("fflate");
    const big = new Uint8Array(MAX_ZIP_ENTRY_BYTES + 1);
    const zipData = zipSync({ "big.json": big });
    await expect(extractZip(zipData.buffer)).rejects.toMatchObject({
      code: "ZIP_TOO_LARGE",
    });
  }, 15_000);
});

describe("extractZip Claude Code multi-session JSONL", () => {
  it("keeps every session when a ZIP contains multiple .jsonl files", async () => {
    const { zipSync } = await import("fflate");
    const zipData = zipSync({
      "projects/proj-a/s1.jsonl": sessionJsonl("s1", "Fix the login bug", "Patched the auth guard."),
      "projects/proj-b/s2.jsonl": sessionJsonl("s2", "Write a migration", "Added the migration file."),
    });

    const entries = await extractZip(zipData.buffer);
    const jsonlEntries = entries.filter((e) => e.path.toLowerCase().endsWith(".jsonl"));
    expect(jsonlEntries).toHaveLength(1);

    // Mirrors how the upload flow consumes ZIP entries: first .jsonl wins.
    const entry = entries.find((e) => e.path.toLowerCase().endsWith(".jsonl"))!;
    const convs = parseClaudeCodeJsonl(decodeText(entry.data), entry.path);
    expect(convs.map((c) => c.id).sort()).toEqual(["s1", "s2"]);
    const byId = new Map(convs.map((c) => [c.id, c]));
    expect(byId.get("s1")!.messages).toHaveLength(2);
    expect(byId.get("s2")!.messages).toHaveLength(2);
    expect(byId.get("s2")!.messages[1]!.model).toBe("claude-sonnet-4-5");
  });

  it("de-dupes the same session zipped under two paths", async () => {
    const { zipSync } = await import("fflate");
    const session = sessionJsonl("s1", "Refactor parser", "Done.");
    const zipData = zipSync({
      "projects/proj-a/s1.jsonl": session,
      "backup/proj-a/s1.jsonl": session,
    });

    const entries = await extractZip(zipData.buffer);
    const entry = entries.find((e) => e.path.toLowerCase().endsWith(".jsonl"))!;
    const convs = parseClaudeCodeJsonl(decodeText(entry.data), entry.path);
    expect(convs).toHaveLength(1);
    expect(convs[0]!.messages).toHaveLength(2);
  });

  it("skips invalid session files but keeps the rest", async () => {
    const { zipSync } = await import("fflate");
    const zipData = zipSync({
      "projects/proj-a/s1.jsonl": sessionJsonl("s1", "Add tests", "Added."),
      "projects/proj-b/broken.jsonl": new TextEncoder().encode("not json at all"),
    });

    const entries = await extractZip(zipData.buffer);
    const entry = entries.find((e) => e.path.toLowerCase().endsWith(".jsonl"))!;
    const convs = parseClaudeCodeJsonl(decodeText(entry.data), entry.path);
    expect(convs.map((c) => c.id)).toEqual(["s1"]);
  });

  it("surfaces skipped session files as warnings", async () => {
    const { zipSync } = await import("fflate");
    const zipData = zipSync({
      "projects/proj-a/s1.jsonl": sessionJsonl("s1", "Add tests", "Added."),
      "projects/proj-b/broken.jsonl": new TextEncoder().encode("not json at all"),
    });

    const warnings: string[] = [];
    await extractZip(zipData.buffer, warnings);
    expect(warnings).toEqual([
      expect.stringContaining('Skipped "projects/proj-b/broken.jsonl":'),
    ]);
  });

  it("surfaces skipped session warnings through parseUploadFile", async () => {
    const { zipSync } = await import("fflate");
    const { parseUploadFile } = await import("./index");
    const zipData = zipSync({
      "projects/proj-a/s1.jsonl": sessionJsonl("s1", "Add tests", "Added."),
      "projects/proj-b/broken.jsonl": new TextEncoder().encode("not json at all"),
    });
    const file = new File([zipData], "claude-projects.zip", { type: "application/zip" });

    const result = await parseUploadFile(file);
    expect(result.platform).toBe("claude_code");
    expect(result.conversations.map((c) => c.id)).toEqual(["s1"]);
    expect(result.warnings).toContainEqual(
      expect.stringContaining('Skipped "projects/proj-b/broken.jsonl":'),
    );
  });

  it("rejects when combined sessions exceed the per-entry cap", async () => {
    vi.resetModules();
    vi.doMock("@/config/securityLimits", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/config/securityLimits")>();
      return { ...actual, MAX_ZIP_ENTRY_BYTES: 600 };
    });
    try {
      // Each entry stays under the (mocked) per-entry cap, but the coalesced
      // output exceeds it — the combined entry must hit the same limit.
      const { extractZip: extractZipCapped } = await import("./zip");
      const { zipSync } = await import("fflate");
      const zipData = zipSync({
        "projects/proj-a/s1.jsonl": sessionJsonl("s1", "p".repeat(100), "a".repeat(100)),
        "projects/proj-b/s2.jsonl": sessionJsonl("s2", "q".repeat(100), "b".repeat(100)),
      });
      await expect(extractZipCapped(zipData.buffer)).rejects.toMatchObject({
        code: "ZIP_TOO_LARGE",
      });
    } finally {
      vi.doUnmock("@/config/securityLimits");
      vi.resetModules();
    }
  });

  it("leaves single-.jsonl and non-jsonl ZIPs untouched", async () => {
    const { zipSync } = await import("fflate");
    const zipData = zipSync({
      "projects/proj-a/s1.jsonl": sessionJsonl("s1", "Hello", "Hi."),
      "readme.txt": new TextEncoder().encode("notes"),
    });

    const entries = await extractZip(zipData.buffer);
    expect(entries.map((e) => e.path).sort()).toEqual([
      "projects/proj-a/s1.jsonl",
      "readme.txt",
    ]);
  });
});
