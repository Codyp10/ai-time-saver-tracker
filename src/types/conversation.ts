export type Platform = "chatgpt" | "claude" | "grok" | "gemini" | "cursor" | "claude_code";

export type MessageRole = "user" | "assistant" | "system" | "tool";

export type TaskCategory =
  | "writing"
  | "email"
  | "coding"
  | "support"
  | "analysis"
  | "translation"
  | "research"
  | "meeting_notes"
  | "brainstorm"
  | "image_gen"
  | "learning"
  | "other";

export type SkillLevel =
  | "novice"
  | "intermediate"
  | "expert"
  | "expert_mature_code";

export type PrimaryUse = "writing" | "coding" | "research" | "mixed";
export type MatureCodebase = "yes" | "sometimes" | "rarely" | "na";
export type ReplacementRatio = "most" | "half" | "new";
export type VerificationHabit = "always" | "sometimes" | "rarely";
export type WorkContext = "work" | "both" | "personal";
export type OutputUsage = "as-is" | "edit" | "draft";

export interface QuizProfile {
  skillLevel: SkillLevel;
  primaryUse: PrimaryUse;
  matureCodebase: MatureCodebase;
  replacementRatio: ReplacementRatio;
  verification: VerificationHabit;
  workContext: WorkContext;
  outputUsage: OutputUsage;
}

export interface NormalizedMessage {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: Date;
  model?: string;
}

export interface NormalizedConversation {
  id: string;
  platform: Platform;
  title: string;
  messages: NormalizedMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationAnalysis {
  conversation: NormalizedConversation;
  category: TaskCategory;
  classificationConfidence: "high" | "low";
  study: string;
  minutesSpent: number;
  minutesSaved: number;
  assistantWords: number;
}

export interface MonthlyReport {
  id: string;
  monthKey: string;
  createdAt: string;
  skillLevel: SkillLevel;
  quizProfile?: QuizProfile;
  conversations: NormalizedConversation[];
  analyses: ConversationAnalysis[];
  totals: {
    minutesSpent: number;
    minutesSaved: number;
    minutesSavedLow: number;
    minutesSavedHigh: number;
    conversationCount: number;
    byPlatform: Record<Platform, number>;
    byCategory: Record<TaskCategory, number>;
    byModel: Record<string, number>;
    busiestHour: number;
    busiestDay: string;
  };
  usedLlmClassifier: boolean;
}

export interface UserSettings {
  openaiApiKey?: string;
  occupation?: string;
  hourlyRate?: number;
  skillLevel?: SkillLevel;
  defaultQuizProfile?: QuizProfile;
}
