import type { MonthlyReport } from "@/types/conversation";
import { formatHours, HOURS_PER_BOOK, topCategory } from "@/engine/aggregate";
import { TASK_TABLE } from "@/engine/taskTable";
import { formatHourLabel, formatMonthLabel } from "@/utils/month";
import { minutesToDollars, resolveHourlyRate } from "@/engine/value";

const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  grok: "Grok",
  gemini: "Gemini",
  cursor: "Cursor",
  claude_code: "Claude Code",
};

function BreakdownBars({
  title,
  entries,
  total,
  formatValue,
}: {
  title: string;
  entries: [string, number][];
  total: number;
  formatValue: (value: number) => string;
}) {
  const filtered = entries.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (filtered.length === 0) return null;

  const max = filtered[0]![1] || 1;

  return (
    <div className="insight-panel-card rounded-xl border border-white/10 p-4 bg-white/5">
      <h3 className="font-semibold text-white mb-3">{title}</h3>
      <ul className="space-y-3">
        {filtered.map(([key, value]) => {
          const pct = total > 0 ? Math.round((value / total) * 100) : 0;
          return (
            <li key={key}>
              <div className="flex justify-between text-sm text-slate-300 mb-1">
                <span className="capitalize">{key.replace(/_/g, " ")}</span>
                <span>
                  {formatValue(value)}
                  {total > 0 && ` · ${pct}%`}
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-wrap-500/80"
                  style={{ width: `${(value / max) * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface WrappedReportProps {
  report: MonthlyReport;
  hourlyRate?: number;
  occupationId?: string;
}

export function WrappedReport({ report, hourlyRate, occupationId }: WrappedReportProps) {
  const { totals } = report;
  const top = topCategory(totals.byCategory);
  const topStudy = TASK_TABLE[top].study;
  const rate = resolveHourlyRate(occupationId, hourlyRate);
  const dollars = minutesToDollars(totals.minutesSaved, rate);
  const books = Math.round(totals.minutesSaved / 60 / HOURS_PER_BOOK);

  const modelEntries = Object.entries(totals.byModel).sort((a, b) => b[1] - a[1]);

  const platformEntries = Object.entries(totals.byPlatform).map(([p, mins]) => [
    PLATFORM_LABELS[p] ?? p,
    mins,
  ]) as [string, number][];

  const categoryEntries = Object.entries(totals.byCategory) as [string, number][];

  const convosByPlatform = report.analyses.reduce<Record<string, number>>((acc, a) => {
    const label = PLATFORM_LABELS[a.conversation.platform] ?? a.conversation.platform;
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});

  const cards = [
    {
      title: "Estimated active time with AI",
      value: formatHours(totals.minutesSpent),
      sub: "From message timestamps, not provider logs",
      className: "surface-card",
    },
    {
      title: "Estimated time saved",
      value: formatHours(totals.minutesSaved),
      sub: `Range: ${formatHours(totals.minutesSavedLow)} – ${formatHours(totals.minutesSavedHigh)}`,
      className: "surface-card-alt",
    },
    {
      title: "Top task type",
      value: top.replace("_", " "),
      sub: topStudy,
      className: "surface-card",
    },
    {
      title: "Busiest hour",
      value: formatHourLabel(totals.busiestHour),
      sub: `Most active day: ${totals.busiestDay}`,
      className: "surface-card-alt",
    },
    {
      title: "Conversations analyzed",
      value: String(totals.conversationCount),
      sub: `Across ${Object.values(totals.byPlatform).filter((v) => v > 0).length} platform(s)`,
      className: "surface-card",
    },
    {
      title: "That's like reading",
      value: `${books} books`,
      sub: `At ~${HOURS_PER_BOOK} hrs per book (optional delight metric)`,
      className: "surface-card-alt",
    },
  ];

  return (
    <section className="space-y-8 print-report">
      <header className="text-center space-y-2">
        <p className="text-wrap-400 text-sm uppercase tracking-widest font-medium">
          {formatMonthLabel(report.monthKey)} Wrapped
        </p>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white">
          {formatHours(totals.minutesSaved)} saved
        </h1>
        <p className="text-slate-400">
          ≈ ${dollars.toLocaleString()} at ${rate}/hr · Skill: {report.skillLevel.replace("_", " ")}
          {report.quizProfile && (
            <> · {report.quizProfile.primaryUse} focus</>
          )}
        </p>
      </header>

      <div className="grid sm:grid-cols-2 gap-4">
        {cards.map((card) => (
          <article
            key={card.title}
            className={`rounded-2xl p-6 ${card.className}`}
          >
            <p className="text-slate-300 text-sm">{card.title}</p>
            <p className="text-3xl font-bold text-white mt-2">{card.value}</p>
            <p className="text-slate-400 text-xs mt-2">{card.sub}</p>
          </article>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <BreakdownBars
          title="By platform (time saved)"
          entries={platformEntries}
          total={totals.minutesSaved}
          formatValue={(v) => formatHours(v)}
        />
        <BreakdownBars
          title="By task category (time saved)"
          entries={categoryEntries}
          total={totals.minutesSaved}
          formatValue={(v) => formatHours(v)}
        />
      </div>

      {Object.keys(convosByPlatform).length > 0 && (
        <div className="insight-panel-card rounded-xl border border-white/10 p-4 bg-white/5">
          <h3 className="font-semibold text-white mb-3">Conversations by platform</h3>
          <ul className="space-y-2">
            {Object.entries(convosByPlatform)
              .sort((a, b) => b[1] - a[1])
              .map(([platform, count]) => (
                <li key={platform} className="flex justify-between text-sm text-slate-300">
                  <span>{platform}</span>
                  <span>{count} conversations</span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {modelEntries.length > 0 && (
        <div className="insight-panel-card rounded-xl border border-white/10 p-4 bg-white/5">
          <h3 className="font-semibold text-white mb-3">Model mix (ChatGPT)</h3>
          <ul className="space-y-2">
            {modelEntries.slice(0, 8).map(([model, count]) => (
              <li key={model} className="flex justify-between text-sm text-slate-300">
                <span>{model}</span>
                <span>{count} messages</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.usedLlmClassifier && (
        <p className="text-center text-xs text-slate-500">
          Some conversations were classified with your OpenAI API key (gpt-4o-mini).
        </p>
      )}
    </section>
  );
}
