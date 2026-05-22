import { OCCUPATIONS } from "@/engine/value";

interface OccupationPromptProps {
  onSelect: (occupationId: string) => void;
}

export function OccupationPrompt({ onSelect }: OccupationPromptProps) {
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="rounded-2xl surface-card p-8 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-white leading-snug">
            What do you do for work?
          </h2>
          <p className="text-slate-500 text-sm mt-2">
            Used to estimate the dollar value of time saved on your wrap. Saved
            to your settings — you won't be asked again.
          </p>
        </div>

        <ul className="space-y-2">
          {OCCUPATIONS.map((occ) => (
            <li key={occ.id}>
              <button
                type="button"
                onClick={() => onSelect(occ.id)}
                className="w-full text-left px-4 py-3.5 rounded-xl border border-white/10 bg-surface-900 text-slate-300 text-sm hover:border-white/20 hover:bg-white/5 transition-colors"
              >
                <span className="text-white">{occ.label}</span>
                <span className="text-slate-500 ml-2">· ~${occ.hourlyUsd}/hr</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
