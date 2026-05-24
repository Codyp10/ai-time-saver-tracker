import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/claude-minimal.json";
import { zipSync } from "fflate";
import { parseMultipleUploadFiles } from "./index";

describe("parseMultipleUploadFiles progress", () => {
  it("parses files sequentially and emits per-file progress callbacks", async () => {
    const makeZipFile = (name: string) => {
      const zipBytes = zipSync({
        "conversations.json": new TextEncoder().encode(JSON.stringify(fixture)),
      });
      return new File([zipBytes], name, { type: "application/zip" });
    };

    const progress: string[] = [];
    const result = await parseMultipleUploadFiles(
      [makeZipFile("one.zip"), makeZipFile("two.zip")],
      (update) => {
        progress.push(`${update.fileIndex}/${update.fileCount}:${update.fileName}:${update.stage}`);
      },
    );

    expect(result.filesParsed).toBe(2);
    expect(progress.some((entry) => entry.startsWith("1/2:one.zip"))).toBe(true);
    expect(progress.some((entry) => entry.startsWith("2/2:two.zip"))).toBe(true);
  });
});
