import { describe, expect, it } from "vitest";
import { computeRoi, minutesToDollars, resolveHourlyRate } from "./value";

describe("resolveHourlyRate", () => {
  it("prefers a positive override over occupation", () => {
    expect(resolveHourlyRate("software", 100)).toBe(100);
  });

  it("falls back to occupation wage then default", () => {
    expect(resolveHourlyRate("software")).toBe(58);
    expect(resolveHourlyRate("unknown-occupation")).toBe(35);
    expect(resolveHourlyRate()).toBe(35);
  });
});

describe("minutesToDollars", () => {
  it("converts minutes at an hourly rate", () => {
    expect(minutesToDollars(120, 50)).toBe(100);
    expect(minutesToDollars(0, 50)).toBe(0);
  });
});

describe("computeRoi", () => {
  it("computes net minutes, ratio, and dollar value", () => {
    const roi = computeRoi(
      { minutesSaved: 600, minutesSpent: 120, minutesSavedLow: 390, minutesSavedHigh: 810 },
      "software",
    );
    expect(roi.netMinutesSaved).toBe(480);
    expect(roi.roiRatio).toBe(5);
    expect(roi.hourlyRate).toBe(58);
    expect(roi.dollarsSaved).toBe(580);
    expect(roi.dollarsSavedLow).toBe(377);
    expect(roi.dollarsSavedHigh).toBe(783);
  });

  it("returns null ratio when no time was spent", () => {
    const roi = computeRoi({ minutesSaved: 90, minutesSpent: 0 });
    expect(roi.roiRatio).toBeNull();
    expect(roi.netMinutesSaved).toBe(90);
    expect(roi.dollarsSaved).toBe(53);
  });

  it("handles zero minutes saved", () => {
    const roi = computeRoi({ minutesSaved: 0, minutesSpent: 30 });
    expect(roi.roiRatio).toBe(0);
    expect(roi.netMinutesSaved).toBe(-30);
    expect(roi.dollarsSaved).toBe(0);
    expect(roi.dollarsSavedLow).toBe(0);
    expect(roi.dollarsSavedHigh).toBe(0);
  });

  it("falls back to minutesSaved for the dollar band when bounds are missing", () => {
    const roi = computeRoi({ minutesSaved: 60, minutesSpent: 10 }, undefined, 40);
    expect(roi.hourlyRate).toBe(40);
    expect(roi.dollarsSavedLow).toBe(40);
    expect(roi.dollarsSavedHigh).toBe(40);
  });
});
