import { useState } from "react";
import type { SkillLevel } from "@/types/conversation";

interface SkillQuizProps {
  onComplete: (level: SkillLevel) => void;
  onSkip: () => void;
}

export function SkillQuiz({ onComplete, onSkip }: SkillQuizProps) {
  const [experience, setExperience] = useState("");
  const [familiarity, setFamiliarity] = useState("");
  const [acceptance, setAcceptance] = useState("");

  function deriveLevel(): SkillLevel {
    const expertExp = experience === "5+";
    const expertFam = familiarity === "expert";
    const matureCode =
      expertExp && expertFam && acceptance === "as-is" && experience === "5+";

    if (matureCode) return "expert_mature_code";
    if (expertExp || expertFam) return "expert";
    if (experience === "<2" || familiarity === "novice") return "novice";
    return "intermediate";
  }

  return (
    <div className="rounded-2xl gradient-card p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Quick skill check</h2>
        <p className="text-slate-300 text-sm mt-1">
          Research shows novices save ~2× more time with AI than experts. This
          calibrates your estimate.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-200">
          How long have you done this work professionally?
        </legend>
        {[
          ["<2", "Less than 2 years"],
          ["2-5", "2–5 years"],
          ["5+", "5+ years"],
        ].map(([v, label]) => (
          <label key={v} className="flex items-center gap-2 text-slate-300 text-sm">
            <input
              type="radio"
              name="exp"
              value={v}
              checked={experience === v}
              onChange={() => setExperience(v)}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-200">
          How familiar are you with most prompt topics?
        </legend>
        {[
          ["novice", "Novice"],
          ["intermediate", "Intermediate"],
          ["expert", "Expert"],
        ].map(([v, label]) => (
          <label key={v} className="flex items-center gap-2 text-slate-300 text-sm">
            <input
              type="radio"
              name="fam"
              value={v}
              checked={familiarity === v}
              onChange={() => setFamiliarity(v)}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-200">
          How do you typically use AI output?
        </legend>
        {[
          ["as-is", "Mostly as-is"],
          ["edit", "Edit substantially"],
          ["draft", "Draft to rewrite"],
        ].map(([v, label]) => (
          <label key={v} className="flex items-center gap-2 text-slate-300 text-sm">
            <input
              type="radio"
              name="acc"
              value={v}
              checked={acceptance === v}
              onChange={() => setAcceptance(v)}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <div className="flex gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => onComplete(deriveLevel())}
          disabled={!experience || !familiarity || !acceptance}
          className="px-6 py-2.5 rounded-full bg-brand-600 hover:bg-brand-500 text-white font-medium disabled:opacity-40"
        >
          See my wrap
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="px-6 py-2.5 rounded-full border border-white/20 text-slate-300 hover:bg-white/10"
        >
          Skip (use intermediate)
        </button>
      </div>
    </div>
  );
}
