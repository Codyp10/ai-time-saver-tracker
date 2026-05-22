import { useEffect, useMemo, useState } from "react";
import type { QuizProfile, SkillLevel } from "@/types/conversation";
import {
  deriveQuizProfile,
  isQuizComplete,
  type QuizAnswers,
} from "@/engine/quizProfile";

const SKILL_LABELS: Record<SkillLevel, string> = {
  novice: "novice",
  intermediate: "intermediate",
  expert: "expert",
  expert_mature_code: "expert (mature codebase)",
};

type QuestionKey = keyof Omit<QuizAnswers, never>;

interface QuestionDef {
  key: QuestionKey;
  title: string;
  hint?: string;
  options: { value: string; label: string }[];
  show?: (answers: QuizAnswers) => boolean;
}

const QUESTIONS: QuestionDef[] = [
  {
    key: "experience",
    title: "How long have you done this work professionally?",
    options: [
      { value: "<2", label: "Less than 2 years" },
      { value: "2-5", label: "2–5 years" },
      { value: "5+", label: "5+ years" },
    ],
  },
  {
    key: "familiarity",
    title: "How familiar are you with most prompt topics?",
    hint: "Novices tend to save ~2× more time with AI than experts.",
    options: [
      { value: "novice", label: "Novice — often new territory" },
      { value: "intermediate", label: "Intermediate — usually know the basics" },
      { value: "expert", label: "Expert — deep domain knowledge" },
    ],
  },
  {
    key: "outputUsage",
    title: "How do you typically use AI output?",
    options: [
      { value: "as-is", label: "Mostly as-is" },
      { value: "edit", label: "Edit substantially" },
      { value: "draft", label: "Draft to rewrite from scratch" },
    ],
  },
  {
    key: "primaryUse",
    title: "What do you mostly use AI for?",
    options: [
      { value: "writing", label: "Writing, email, docs" },
      { value: "coding", label: "Coding and debugging" },
      { value: "research", label: "Research, analysis, learning" },
      { value: "mixed", label: "Mix of everything" },
    ],
  },
  {
    key: "matureCodebase",
    title: "When coding, is it usually your own existing codebase?",
    hint: "METR 2025 found experienced devs were ~19% slower on familiar repos with AI.",
    show: (a) => a.primaryUse === "coding" || a.primaryUse === "mixed",
    options: [
      { value: "yes", label: "Yes — mostly my own mature projects" },
      { value: "sometimes", label: "Sometimes — mix of new and existing" },
      { value: "rarely", label: "Rarely — mostly greenfield or small scripts" },
    ],
  },
  {
    key: "replacementRatio",
    title: "How much of your AI use replaces work you'd otherwise do?",
    hint: "Roughly half of AI use is augmentation — work you wouldn't have done otherwise.",
    options: [
      { value: "most", label: "Most — I'd definitely do it without AI" },
      { value: "half", label: "About half — some is new or optional" },
      { value: "new", label: "Mostly new things I wouldn't attempt otherwise" },
    ],
  },
  {
    key: "verification",
    title: "How often do you verify or fact-check AI output?",
    hint: "Self-reported savings often exceed measured savings when verification is low.",
    options: [
      { value: "always", label: "Always — I review carefully" },
      { value: "sometimes", label: "Sometimes — depends on the task" },
      { value: "rarely", label: "Rarely — I trust and move on" },
    ],
  },
  {
    key: "workContext",
    title: "Is your AI use mainly for work or personal?",
    hint: "Most published productivity studies focus on workplace tasks.",
    options: [
      { value: "work", label: "Mostly work" },
      { value: "both", label: "Mix of work and personal" },
      { value: "personal", label: "Mostly personal" },
    ],
  },
];

interface SkillQuizProps {
  defaultSkillLevel?: SkillLevel;
  onComplete: (profile: QuizProfile) => void;
  onSkip: () => void;
}

export function SkillQuiz({ defaultSkillLevel = "intermediate", onComplete, onSkip }: SkillQuizProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({
    experience: "",
    familiarity: "",
    outputUsage: "",
    primaryUse: "",
    matureCodebase: "",
    replacementRatio: "",
    verification: "",
    workContext: "",
  });

  const activeQuestions = useMemo(
    () => QUESTIONS.filter((q) => !q.show || q.show(answers)),
    [answers.primaryUse],
  );

  useEffect(() => {
    if (step >= activeQuestions.length) {
      setStep(Math.max(0, activeQuestions.length - 1));
    }
  }, [activeQuestions.length, step]);

  const current = activeQuestions[step];
  const isLast = step === activeQuestions.length - 1;
  const progress = ((step + 1) / activeQuestions.length) * 100;

  function pick(key: QuestionKey, value: string) {
    setAnswers((prev) => {
      const next = { ...prev, [key]: value } as QuizAnswers;
      if (key === "primaryUse" && value !== "coding" && value !== "mixed") {
        next.matureCodebase = "na";
      }
      if (key === "primaryUse" && (value === "coding" || value === "mixed") && prev.matureCodebase === "na") {
        next.matureCodebase = "";
      }
      return next;
    });

    if (!isLast) {
      setTimeout(() => setStep((s) => s + 1), 200);
    }
  }

  function goBack() {
    if (step > 0) setStep((s) => s - 1);
  }

  if (!current) return null;

  const currentValue = answers[current.key];
  const complete = isQuizComplete(answers);

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Question {step + 1} of {activeQuestions.length}</span>
          <button
            type="button"
            onClick={onSkip}
            className="text-slate-400 hover:text-white transition-colors"
          >
            Skip · use default ({SKILL_LABELS[defaultSkillLevel]})
          </button>
        </div>
        <div className="h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-brand-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div
        key={current.key}
        className="rounded-2xl surface-card p-8 space-y-6"
      >
        <div>
          <h2 className="text-xl font-semibold text-white leading-snug">
            {current.title}
          </h2>
          {current.hint && (
            <p className="text-slate-500 text-sm mt-2">{current.hint}</p>
          )}
        </div>

        <ul className="space-y-2">
          {current.options.map((opt) => {
            const selected = currentValue === opt.value;
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => pick(current.key, opt.value)}
                  className={`w-full text-left px-4 py-3.5 rounded-xl border text-sm transition-colors ${
                    selected
                      ? "border-brand-500 bg-brand-600/20 text-white"
                      : "border-white/10 bg-surface-900 text-slate-300 hover:border-white/20 hover:bg-white/5"
                  }`}
                >
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex justify-between items-center pt-2">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 0}
            className="text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none"
          >
            ← Back
          </button>

          {isLast && (
            <button
              type="button"
              onClick={() => onComplete(deriveQuizProfile(answers))}
              disabled={!complete}
              className="px-6 py-2.5 rounded-full bg-brand-600 hover:bg-brand-500 text-white font-medium disabled:opacity-40"
            >
              See my wrap
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
