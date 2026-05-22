import type {
  NormalizedConversation,
  QuizProfile,
  SkillLevel,
  TaskCategory,
} from "@/types/conversation";
import { countWords } from "@/parsers/utils";
import { estimateQuizMultiplier, profileFromSkillLevel } from "./quizProfile";
import {
  MAX_SAVED_PER_CONVERSATION,
  TASK_TABLE,
} from "./taskTable";

export function assistantWordCount(conv: NormalizedConversation): number {
  return conv.messages
    .filter((m) => m.role === "assistant")
    .reduce((sum, m) => sum + countWords(m.text), 0);
}

export function conversationAppearsSuccessful(conv: NormalizedConversation): boolean {
  const userMsgs = conv.messages.filter((m) => m.role === "user");
  const assistantMsgs = conv.messages.filter((m) => m.role === "assistant");
  if (assistantMsgs.length === 0) return false;

  const lastUser = userMsgs[userMsgs.length - 1]?.text.trim().toLowerCase() ?? "";
  const thanksOnly = /^(thanks|thank you|thx|ok|okay|got it)\.?$/i.test(lastUser);
  const shortAssistant = assistantMsgs.every((m) => countWords(m.text) < 20);

  if (thanksOnly && shortAssistant) return false;
  if (assistantWordCount(conv) < 15 && userMsgs.length <= 1) return false;
  return true;
}

export function sessionWeight(assistantWords: number): number {
  if (assistantWords <= 200) return 1;
  return Math.max(1, Math.log10(assistantWords / 200));
}

export function estimateMinutesSaved(
  conv: NormalizedConversation,
  category: TaskCategory,
  profileOrSkill: QuizProfile | SkillLevel,
): number {
  const profile =
    typeof profileOrSkill === "string"
      ? profileFromSkillLevel(profileOrSkill)
      : profileOrSkill;
  const config = TASK_TABLE[category];
  const words = assistantWordCount(conv);
  const weight = sessionWeight(words);
  const skillMult = estimateQuizMultiplier(profile, category);

  let baseline: number;
  if (category === "meeting_notes" && config.baselineMinPerMeeting) {
    baseline = config.baselineMinPerMeeting * weight;
  } else if (category === "image_gen" && config.baselineMinPerImage) {
    const images = Math.max(1, Math.ceil(words / 50));
    baseline = config.baselineMinPerImage * images;
  } else {
    baseline = (config.baselineMinPer100w ?? 3) * (words / 100) * weight;
  }

  let saved = baseline * config.savingsPct * skillMult;
  if (!conversationAppearsSuccessful(conv)) saved *= 0.4;

  return Math.min(Math.round(saved * 10) / 10, MAX_SAVED_PER_CONVERSATION);
}
