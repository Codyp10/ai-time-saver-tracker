import type { MonthlyReport } from "@/types/conversation";
import { formatHours, HOURS_PER_BOOK, topCategory } from "@/engine/aggregate";
import { TASK_TABLE } from "@/engine/taskTable";
import { formatHourLabel } from "@/utils/month";
import { minutesToDollars, resolveHourlyRate } from "@/engine/value";

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

  const cards = [
    {
      title: "Estimated active time with AI",
      value: formatHours(totals.minutesSpent),
      sub: "From message timestamps, not provider logs",
      className: "gradient-card",
    },
    {
      title: "Estimated time saved",
      value: formatHours(totals.minutesSaved),
      sub: `Range: ${formatHours(totals.minutesSavedLow)} – ${formatHours(totals.minutesSavedHigh)}`,
      className: "gradient-card-alt",
    },
    {
      title: "Top task type",
      value: top.replace("_", " "),
      sub: topStudy,
      className: "gradient-card",
    },
    {
      title: "Busiest hour",
      value: formatHourLabel(totals.busiestHour),
      sub: `Most active day: ${totals.busiestDay}`,
      className: "gradient-card-alt",
    },
    {
      title: "Conversations analyzed",
      value: String(totals.conversationCount),
      sub: `Across ${Object.values(totals.byPlatform).filter((v) => v > 0).length} platform(s)`,
      className: "gradient-card",
    },
    {
      title: "That's like reading",
      value: `${books} books`,
      sub: `At ~${HOURS_PER_BOOK} hrs per book (optional delight metric)`,
      className: "gradient-card-alt",
    },
  ];

  return (
    <section className="space-y-8">
      <header className="text-center space-y-2">
        <p className="text-brand-400 text-sm uppercase tracking-widest font-medium">
          Your monthly wrap
        </p>
        <h1 className="text-4xl sm:text-5xl font-black text-white">
          {formatHours(totals.minutesSaved)} saved
        </h1>
        <p className="text-slate-400">
          ≈ ${dollars.toLocaleString()} at ${rate}/hr · Skill: {report.skillLevel.replace("_", " ")}
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

      {modelEntries.length > 0 && (
        <div className="rounded-xl border border-white/10 p-4 bg-white/5">
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
