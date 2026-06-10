import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/claude-minimal.json";
import { zipSync } from "fflate";
import {
  computeBatchParseTimeoutMs,
  parseMultipleUploadFilesInWorker,
  serializeParseWorkerError,
} from "./workerClient";
import { ParseError } from "./errors";
import { computeParseTimeoutMs } from "@/config/securityLimits";

function makeZipFile(name: string): File {
  const zipBytes = zipSync({
    "conversations.json": new TextEncoder().encode(JSON.stringify(fixture)),
  });
  return new File([zipBytes], name, { type: "application/zip" });
}

describe("parseMultipleUploadFilesInWorker", () => {
  it("falls back to main-thread parsing when Worker is unavailable", async () => {
    const progress: string[] = [];
    const result = await parseMultipleUploadFilesInWorker([makeZipFile("claude.zip")], (p) => {
      progress.push(`${p.fileIndex}/${p.fileCount}:${p.fileName}:${p.stage}`);
    });

    expect(result.filesParsed).toBe(1);
    expect(result.conversations.length).toBeGreaterThan(0);
    expect(progress.some((entry) => entry.startsWith("1/1:claude.zip"))).toBe(true);
  });

  it("propagates parse errors through the fallback path", async () => {
    const file = new File(["not json"], "broken.txt", { type: "text/plain" });
    const result = await parseMultipleUploadFilesInWorker([file]);
    expect(result.filesParsed).toBe(0);
    expect(result.filesFailed).toBe(1);
  });
});

describe("serializeParseWorkerError", () => {
  it("keeps ParseError codes and messages", () => {
    const serialized = serializeParseWorkerError(new ParseError("bad zip", "UNKNOWN_PLATFORM"));
    expect(serialized).toEqual({ code: "UNKNOWN_PLATFORM", message: "bad zip" });
  });

  it("wraps generic errors with a PARSE_FAILED code", () => {
    expect(serializeParseWorkerError(new Error("boom"))).toEqual({
      code: "PARSE_FAILED",
      message: "boom",
    });
  });

  it("handles non-Error values", () => {
    const serialized = serializeParseWorkerError("nope");
    expect(serialized.code).toBe("PARSE_FAILED");
    expect(serialized.message.length).toBeGreaterThan(0);
  });
});

describe("computeBatchParseTimeoutMs", () => {
  it("sums the size-scaled per-file budgets", () => {
    const sizes = [10 * 1024 * 1024, 150 * 1024 * 1024];
    const expected = sizes.reduce((total, size) => total + computeParseTimeoutMs(size), 0);
    expect(computeBatchParseTimeoutMs(sizes)).toBe(expected);
  });

  it("returns zero for an empty batch", () => {
    expect(computeBatchParseTimeoutMs([])).toBe(0);
  });
});
