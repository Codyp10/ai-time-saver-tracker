import type { SkillLevel, TaskCategory } from "@/types/conversation";

export interface TaskConfig {
  baselineMinPer100w?: number;
  baselineMinPerMeeting?: number;
  baselineMinPerImage?: number;
  savingsPct: number;
  study: string;
}

export const TASK_TABLE: Record<TaskCategory, TaskConfig> = {
  writing: {
    baselineMinPer100w: 4.0,
    savingsPct: 0.4,
    study: "Noy & Zhang, Science 2023",
  },
  email: {
    baselineMinPer100w: 2.5,
    savingsPct: 0.31,
    study: "Jaffe et al., Microsoft 2024",
  },
  coding: {
    baselineMinPer100w: 5.0,
    savingsPct: 0.26,
    study: "Cui et al., Management Science 2026",
  },
  support: {
    baselineMinPer100w: 3.0,
    savingsPct: 0.15,
    study: "Brynjolfsson/Li/Raymond, QJE 2025",
  },
  analysis: {
    baselineMinPer100w: 5.5,
    savingsPct: 0.25,
    study: "Dell'Acqua et al., HBS/BCG 2023",
  },
  translation: {
    baselineMinPer100w: 4.0,
    savingsPct: 0.3,
    study: "Macken et al., EC DGT 2020",
  },
  research: {
    baselineMinPer100w: 4.5,
    savingsPct: 0.4,
    study: "Noy & Zhang 2023 (writing proxy)",
  },
  meeting_notes: {
    baselineMinPerMeeting: 15,
    savingsPct: 0.67,
    study: "Cisco Webex AI 2024",
  },
  brainstorm: {
    baselineMinPer100w: 3.5,
    savingsPct: 0.3,
    study: "Dell'Acqua et al. 2023 (centaur)",
  },
  image_gen: {
    baselineMinPerImage: 45,
    savingsPct: 0.8,
    study: "Industry estimate — flagged",
  },
  learning: {
    baselineMinPer100w: 4.0,
    savingsPct: 0.25,
    study: "Weighted average",
  },
  other: {
    baselineMinPer100w: 3.0,
    savingsPct: 0.15,
    study: "Conservative default",
  },
};

export const SKILL_MULT: Record<SkillLevel, number> = {
  novice: 1.5,
  intermediate: 1.0,
  expert: 0.6,
  expert_mature_code: 0.4,
};

export const CONFIDENCE_BAND_REGEX = 0.45;
export const CONFIDENCE_BAND_DEFAULT = 0.35;
export const MAX_SAVED_PER_CONVERSATION = 240;
