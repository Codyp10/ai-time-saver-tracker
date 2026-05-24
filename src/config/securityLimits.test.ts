import { describe, expect, it } from "vitest";
import {
  PARSE_TIMEOUT_MAX_MS,
  PARSE_TIMEOUT_MIN_MS,
  computeParseTimeoutMs,
  withTimeout,
} from "./securityLimits";

describe("computeParseTimeoutMs", () => {
  it("uses the minimum budget for small files", () => {
    expect(computeParseTimeoutMs(512 * 1024)).toBe(PARSE_TIMEOUT_MIN_MS);
  });

  it("scales with file size up to the maximum cap", () => {
    const tenMb = computeParseTimeoutMs(10 * 1024 * 1024);
    expect(tenMb).toBeGreaterThan(PARSE_TIMEOUT_MIN_MS);
    expect(tenMb).toBeLessThanOrEqual(PARSE_TIMEOUT_MAX_MS);

    expect(computeParseTimeoutMs(200 * 1024 * 1024)).toBe(PARSE_TIMEOUT_MAX_MS);
  });
});

describe("withTimeout", () => {
  it("includes the label in timeout errors", async () => {
    await expect(
      withTimeout(
        new Promise((resolve) => setTimeout(resolve, 50)),
        1,
        'Parsing "claude-export.zip" (42 MB)',
      ),
    ).rejects.toThrow('Parsing "claude-export.zip" (42 MB) timed out after 0 seconds');
  });
});
