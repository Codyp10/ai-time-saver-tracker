import { SKILL_MULT, TASK_TABLE } from "@/engine/taskTable";

export function MethodologyContent() {
  return (
    <article className="prose prose-invert max-w-none space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-white">Methodology</h1>
        <p className="text-slate-400 mt-2">
          Every number links to a published study. We show ranges because these are
          estimates — not stopwatch measurements.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">How time spent is estimated</h2>
        <p className="text-slate-300 text-sm leading-relaxed">
          We sum gaps between your messages when gaps are under 30 minutes, cap each
          session at 2 hours, and assign a 1-minute minimum per conversation. This
          reflects estimated active time — not official session logs from AI providers.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">How time saved is estimated</h2>
        <p className="text-slate-300 text-sm leading-relaxed">
          Each conversation is classified into a task type (writing, coding, email,
          etc.). We apply a minutes-saved multiplier from peer-reviewed research,
          scaled by assistant output length and your skill level from the quiz.
        </p>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Savings</th>
                <th className="px-3 py-2 text-left">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {Object.entries(TASK_TABLE).map(([cat, cfg]) => (
                <tr key={cat}>
                  <td className="px-3 py-2 capitalize">{cat.replace("_", " ")}</td>
                  <td className="px-3 py-2">{Math.round(cfg.savingsPct * 100)}%</td>
                  <td className="px-3 py-2 text-xs">{cfg.study}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Calibration quiz</h2>
        <p className="text-slate-300 text-sm leading-relaxed">
          Before your wrap, eight questions calibrate estimates to your profile.
          They adjust a base skill multiplier with modifiers for primary use,
          replacement vs augmentation, verification habits, work context, and
          coding-on-mature-codebase (METR 2025).
        </p>
        <ul className="text-slate-300 text-sm space-y-2 list-disc list-inside">
          <li>
            <strong className="text-white">Replacement ratio:</strong> mostly
            replacing existing work (×1.0) vs mostly new tasks you wouldn&apos;t
            attempt (×0.55).
          </li>
          <li>
            <strong className="text-white">Verification:</strong> careful review
            adds time back (×0.9 always) vs rarely checking (×1.03, wider
            confidence band).
          </li>
          <li>
            <strong className="text-white">Primary use alignment:</strong> savings
            boost when conversation category matches your stated primary use.
          </li>
          <li>
            <strong className="text-white">Mature codebase:</strong> extra
            downward adjustment on coding conversations when you work on familiar
            repos as an expert.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Skill multipliers</h2>
        <ul className="text-slate-300 text-sm space-y-1">
          {Object.entries(SKILL_MULT).map(([level, mult]) => (
            <li key={level}>
              <span className="capitalize text-white">{level.replace("_", " ")}</span>: ×
              {mult}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4 rounded-xl border border-amber-500/30 bg-amber-950/20 p-4">
        <h2 className="text-xl font-semibold text-amber-200">Counter-evidence we disclose</h2>
        <ul className="text-slate-300 text-sm space-y-3 list-disc list-inside">
          <li>
            <strong className="text-white">METR 2025:</strong> Experienced open-source
            developers were ~19% slower on their own mature repos with AI, while
            believing they were faster. Expert + mature-code personas use a 0.4×
            multiplier.
          </li>
          <li>
            <strong className="text-white">Dell&apos;Acqua jagged frontier:</strong> Tasks
            outside AI capability saw 19% lower accuracy — harm invisible in exports.
          </li>
          <li>
            <strong className="text-white">Perceived vs measured:</strong> Self-reported
            time savings often exceed measured savings (Jaffe et al., Microsoft 2024).
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Platform data gaps</h2>
        <ul className="text-slate-300 text-sm space-y-2">
          <li>
            <strong className="text-white">Claude:</strong> No per-message model in exports.
          </li>
          <li>
            <strong className="text-white">Gemini:</strong> Flat activity log; threads are
            reconstructed heuristically.
          </li>
          <li>
            <strong className="text-white">Grok:</strong> No model variant per message.
          </li>
          <li>
            <strong className="text-white">ChatGPT:</strong> No token counts; o-series
            reasoning time not visible.
          </li>
        </ul>
      </section>
    </article>
  );
}
