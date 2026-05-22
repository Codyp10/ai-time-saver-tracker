import { describe, expect, it } from "vitest";
import {
  confidenceBandForProfile,
  defaultQuizProfile,
  deriveQuizProfile,
  deriveSkillLevel,
  estimateQuizMultiplier,
  isQuizComplete,
  type QuizAnswers,
} from "./quizProfile";

const fullAnswers: QuizAnswers = {
  experience: "5+",
  familiarity: "expert",
  outputUsage: "as-is",
  primaryUse: "coding",
  matureCodebase: "yes",
  replacementRatio: "most",
  verification: "always",
  workContext: "work",
};

describe("deriveSkillLevel", () => {
  it("detects expert_mature_code for coding on mature repos", () => {
    expect(deriveSkillLevel(fullAnswers)).toBe("expert_mature_code");
  });

  it("detects novice", () => {
    expect(
      deriveSkillLevel({ ...fullAnswers, experience: "<2", familiarity: "novice" }),
    ).toBe("novice");
  });
});

describe("estimateQuizMultiplier", () => {
  it("lowers savings for augmentation-heavy use", () => {
    const profile = deriveQuizProfile({
      ...fullAnswers,
      outputUsage: "edit",
      matureCodebase: "rarely",
      replacementRatio: "new",
    });
    const mult = estimateQuizMultiplier(profile, "writing");
    expect(mult).toBeLessThan(1);
  });

  it("applies METR penalty for expert coding on mature codebase", () => {
    const profile = deriveQuizProfile(fullAnswers);
    const codingMult = estimateQuizMultiplier(profile, "coding");
    const writingMult = estimateQuizMultiplier(profile, "writing");
    expect(codingMult).toBeLessThan(writingMult);
  });
});

describe("confidenceBandForProfile", () => {
  it("widens band for uncertain profiles", () => {
    const profile = deriveQuizProfile({
      ...fullAnswers,
      replacementRatio: "new",
      verification: "rarely",
      primaryUse: "mixed",
    });
    expect(confidenceBandForProfile(profile, 0.35)).toBeGreaterThan(0.35);
  });
});

describe("isQuizComplete", () => {
  it("requires mature codebase answer for coding primary use", () => {
    expect(isQuizComplete({ ...fullAnswers, matureCodebase: "" })).toBe(false);
    expect(isQuizComplete(fullAnswers)).toBe(true);
  });

  it("skips mature codebase for writing primary use", () => {
    const writing: QuizAnswers = {
      ...fullAnswers,
      primaryUse: "writing",
      matureCodebase: "na",
    };
    expect(isQuizComplete(writing)).toBe(true);
  });
});

describe("defaultQuizProfile", () => {
  it("returns intermediate defaults", () => {
    const p = defaultQuizProfile("intermediate");
    expect(p.replacementRatio).toBe("half");
    expect(p.skillLevel).toBe("intermediate");
  });
});
