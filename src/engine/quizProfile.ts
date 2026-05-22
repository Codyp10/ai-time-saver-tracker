import type { QuizProfile, SkillLevel, TaskCategory } from "@/types/conversation";
import { SKILL_MULT } from "./taskTable";

export interface QuizAnswers {
  experience: "" | "<2" | "2-5" | "5+";
  familiarity: "" | "novice" | "intermediate" | "expert";
  outputUsage: "" | "as-is" | "edit" | "draft";
  primaryUse: "" | "writing" | "coding" | "research" | "mixed";
  matureCodebase: "" | "yes" | "sometimes" | "rarely" | "na";
  replacementRatio: "" | "most" | "half" | "new";
  verification: "" | "always" | "sometimes" | "rarely";
  workContext: "" | "work" | "both" | "personal";
}

const REPLACEMENT_MULT = { most: 1.0, half: 0.78, new: 0.55 } as const;
const VERIFICATION_MULT = { always: 0.9, sometimes: 1.0, rarely: 1.03 } as const;
const WORK_CONTEXT_MULT = { work: 1.0, both: 0.96, personal: 0.9 } as const;
const OUTPUT_USAGE_MULT = { "as-is": 1.05, edit: 1.0, draft: 0.92 } as const;

const PRIMARY_CATEGORY_GROUPS: Record<
  QuizProfile["primaryUse"],
  TaskCategory[]
> = {
  writing: ["writing", "email", "translation", "meeting_notes"],
  coding: ["coding"],
  research: ["research", "analysis", "learning", "brainstorm"],
  mixed: [],
};

export function isQuizComplete(answers: QuizAnswers): boolean {
  const base =
    answers.experience &&
    answers.familiarity &&
    answers.outputUsage &&
    answers.primaryUse &&
    answers.replacementRatio &&
    answers.verification &&
    answers.workContext;

  if (!base) return false;

  if (answers.primaryUse === "coding" || answers.primaryUse === "mixed") {
    return Boolean(answers.matureCodebase && answers.matureCodebase !== "na");
  }

  return true;
}

export function deriveSkillLevel(answers: QuizAnswers): SkillLevel {
  const expertExp = answers.experience === "5+";
  const expertFam = answers.familiarity === "expert";
  const novice = answers.experience === "<2" || answers.familiarity === "novice";

  const codingContext =
    answers.primaryUse === "coding" || answers.primaryUse === "mixed";
  const matureCode =
    codingContext &&
    answers.matureCodebase === "yes" &&
    (expertExp || expertFam) &&
    answers.outputUsage === "as-is";

  if (matureCode) return "expert_mature_code";
  if (expertExp || expertFam) return "expert";
  if (novice) return "novice";
  return "intermediate";
}

export function deriveQuizProfile(answers: QuizAnswers): QuizProfile {
  const primaryUse = answers.primaryUse as QuizProfile["primaryUse"];
  const matureCodebase =
    primaryUse === "writing" || primaryUse === "research"
      ? "na"
      : (answers.matureCodebase as QuizProfile["matureCodebase"]) || "sometimes";

  return {
    skillLevel: deriveSkillLevel(answers),
    primaryUse,
    matureCodebase,
    replacementRatio: answers.replacementRatio as QuizProfile["replacementRatio"],
    verification: answers.verification as QuizProfile["verification"],
    workContext: answers.workContext as QuizProfile["workContext"],
    outputUsage: answers.outputUsage as QuizProfile["outputUsage"],
  };
}

export function defaultQuizProfile(skillLevel: SkillLevel = "intermediate"): QuizProfile {
  return {
    skillLevel,
    primaryUse: "mixed",
    matureCodebase: "sometimes",
    replacementRatio: "half",
    verification: "sometimes",
    workContext: "both",
    outputUsage: "edit",
  };
}

function primaryUseCategoryMult(
  primaryUse: QuizProfile["primaryUse"],
  category: TaskCategory,
): number {
  if (primaryUse === "mixed") return 1.0;

  const aligned = PRIMARY_CATEGORY_GROUPS[primaryUse].includes(category);
  if (aligned) return 1.06;

  const adjacent: Record<QuizProfile["primaryUse"], TaskCategory[]> = {
    writing: ["brainstorm", "research"],
    coding: ["analysis", "other"],
    research: ["writing", "support"],
    mixed: [],
  };

  if (adjacent[primaryUse].includes(category)) return 0.96;
  return 0.9;
}

export function estimateQuizMultiplier(
  profile: QuizProfile,
  category: TaskCategory,
): number {
  let mult = SKILL_MULT[profile.skillLevel];

  mult *= REPLACEMENT_MULT[profile.replacementRatio];
  mult *= VERIFICATION_MULT[profile.verification];
  mult *= WORK_CONTEXT_MULT[profile.workContext];
  mult *= OUTPUT_USAGE_MULT[profile.outputUsage];
  mult *= primaryUseCategoryMult(profile.primaryUse, category);

  if (
    category === "coding" &&
    profile.matureCodebase === "yes" &&
    (profile.skillLevel === "expert" || profile.skillLevel === "expert_mature_code")
  ) {
    mult *= 0.82;
  }

  if (
    category === "coding" &&
    profile.matureCodebase === "sometimes" &&
    profile.skillLevel === "expert"
  ) {
    mult *= 0.92;
  }

  return mult;
}

export function confidenceBandForProfile(
  profile: QuizProfile,
  baseBand: number,
): number {
  let band = baseBand;

  if (profile.replacementRatio === "new") band += 0.08;
  if (profile.verification === "rarely") band += 0.05;
  if (profile.primaryUse === "mixed") band += 0.03;
  if (profile.skillLevel === "expert_mature_code") band += 0.05;

  return Math.min(band, 0.55);
}

export function profileFromSkillLevel(skillLevel: SkillLevel): QuizProfile {
  return defaultQuizProfile(skillLevel);
}
