import { describe, expect, it } from "vitest";
import { MAX_ZIP_ENTRIES, MAX_ZIP_ENTRY_BYTES } from "@/config/securityLimits";
import { ParseError } from "./errors";
import { extractZip } from "./zip";

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
