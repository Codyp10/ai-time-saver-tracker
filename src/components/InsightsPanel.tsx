import type { ReactNode } from "react";
import type { MonthlyReport } from "@/types/conversation";
import { formatHours } from "@/engine/aggregate";
import {
  computePlatformBreakdown,
  computeTopicMix,
  computeTrendForecast,
  computeUsageHeatmap,
  type PlatformInsight,
} from "@/engine/insights";
import { formatMonthLabel } from "@/utils/month";

const HEATMAP_INTENSITY: Record<number, string> = {
  0: "heatmap-intensity-0 bg-white/5",
  1: "heatmap-intensity-1 bg-wrap-500/20",
  2: "heatmap-intensity-2 bg-wrap-500/40",
  3: "heatmap-intensity-3 bg-wrap-500/65",
  4: "heatmap-intensity-4 bg-wrap-500",
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function InsightCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`insight-panel-card rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4 neon-glow-hover${className ? ` ${className}` : ""}`}
    >
      <div>
        <h3 className="font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {children}
    </article>
  );
}

function PlatformRow({ row }: { row: PlatformInsight }) {
  return (
    <li className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-white font-medium">{row.platform}</span>
        <span className="text-slate-400">
          {row.conversations} convos · {formatHours(row.minutesSaved)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wide text-slate-500">
        <div>
          <span>Convos {row.conversationPct}%</span>
          <div className="h-1.5 mt-1 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-wrap-500/70"
              style={{ width: `${row.conversationPct}%` }}
            />
          </div>
        </div>
        <div>
          <span>Time saved {row.timeSavedPct}%</span>
          <div className="h-1.5 mt-1 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-wrap-600"
              style={{ width: `${row.timeSavedPct}%` }}
            />
          </div>
        </div>
      </div>
    </li>
  );
}

function UsageHeatmap({ report }: { report: MonthlyReport }) {
  const heatmap = computeUsageHeatmap(report);
  const cells: (typeof heatmap.days[0] | null)[] = [
    ...Array.from({ length: heatmap.startOffset }, () => null),
    ...heatmap.days,
  ];

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  const legend = (
    <div className="usage-heatmap-legend flex items-center justify-between text-[10px] text-slate-500">
      <span>Less</span>
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((level) => (
          <div
            key={level}
            data-intensity={level}
            className={`usage-heatmap-legend-swatch w-3 h-3 rounded-sm ${HEATMAP_INTENSITY[level]}`}
          />
        ))}
      </div>
      <span>More</span>
    </div>
  );

  return (
    <div className="usage-heatmap space-y-3">
      <div className="usage-heatmap-screen space-y-1">
        <div className="usage-heatmap-weekdays grid grid-cols-7 gap-1 text-[10px] text-slate-500 text-center">
          {WEEKDAY_LABELS.map((d) => (
            <span key={d} className="usage-heatmap-weekday">
              {d}
            </span>
          ))}
        </div>
        <div className="usage-heatmap-grid grid grid-cols-7 gap-1">
          {cells.map((cell, i) =>
            cell ? (
              <div
                key={cell.date}
                data-intensity={cell.intensity}
                title={`${cell.date}: ${cell.activity} message${cell.activity === 1 ? "" : "s"}`}
                className={`usage-heatmap-cell rounded-sm ${HEATMAP_INTENSITY[cell.intensity]} border border-white/5`}
              >
                <span className="usage-heatmap-day">{cell.dayOfMonth}</span>
              </div>
            ) : (
              <div
                key={`empty-${i}`}
                className="usage-heatmap-cell usage-heatmap-cell-empty"
                aria-hidden
              />
            ),
          )}
        </div>
      </div>

      <table className="usage-heatmap-print" role="presentation">
        <thead>
          <tr>
            {WEEKDAY_LABELS.map((d) => (
              <th key={d} className="usage-heatmap-weekday">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, weekIndex) => (
            <tr key={weekIndex}>
              {week.map((cell, dayIndex) =>
                cell ? (
                  <td
                    key={cell.date}
                    data-intensity={cell.intensity}
                    className={`usage-heatmap-cell rounded-sm ${HEATMAP_INTENSITY[cell.intensity]} border border-white/5`}
                  >
                    <span className="usage-heatmap-day">{cell.dayOfMonth}</span>
                  </td>
                ) : (
                  <td
                    key={`empty-${weekIndex}-${dayIndex}`}
                    className="usage-heatmap-cell usage-heatmap-cell-empty"
                    aria-hidden
                  />
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {legend}
    </div>
  );
}

function TopicMixSection({ report }: { report: MonthlyReport }) {
  const topicMix = computeTopicMix(report);

  if (!topicMix.hasData) {
    return (
      <p className="text-sm text-slate-400">
        Topic breakdown needs classified conversations. Add your OpenAI API key in settings for
        sharper labels, or upload exports with clearer task titles.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {topicMix.usedLlm && (
        <p className="text-[10px] uppercase tracking-wide text-wrap-500/80">
          Enhanced with BYOK classification
        </p>
      )}
      <ul className="space-y-3">
        {topicMix.buckets.map((bucket) => (
          <li key={bucket.key}>
            <div className="flex justify-between text-sm text-slate-300 mb-1">
              <span>{bucket.label}</span>
              <span>
                {bucket.conversations} convos · {bucket.pct}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-wrap-500/80"
                style={{ width: `${bucket.pct}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TrendForecastSection({
  report,
  history,
}: {
  report: MonthlyReport;
  history: MonthlyReport[];
}) {
  const forecast = computeTrendForecast(report, history);

  if (!forecast.hasForecast) {
    return (
      <p className="text-sm text-slate-400">
        Save reports for multiple months to see a projected annual savings forecast.
      </p>
    );
  }

  const trendLabel =
    forecast.trendDirection === "up"
      ? "Trending up"
      : forecast.trendDirection === "down"
        ? "Trending down"
        : "Holding steady";

  return (
    <div className="space-y-4">
      <div className="rounded-xl surface-card-alt p-4 text-center">
        <p className="text-xs text-slate-400 uppercase tracking-wide">Projected annual savings</p>
        <p className="text-3xl font-bold text-wrap-500 text-glow mt-1">
          {forecast.projectedAnnualHours.toFixed(0)} hrs
        </p>
        <p className="text-xs text-slate-400 mt-2">
          Based on {forecast.monthsUsed} recent month{forecast.monthsUsed === 1 ? "" : "s"} (
          ~{forecast.monthlyAverageHours.toFixed(1)} hrs/mo avg)
        </p>
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">
          {trendLabel}
        </span>
        {forecast.recentChangePct !== null && (
          <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">
            {forecast.recentChangePct >= 0 ? "+" : ""}
            {forecast.recentChangePct}% vs prior month
          </span>
        )}
      </div>
    </div>
  );
}

interface InsightsPanelProps {
  report: MonthlyReport;
  history?: MonthlyReport[];
}

export function InsightsPanel({ report, history = [] }: InsightsPanelProps) {
  const platforms = computePlatformBreakdown(report);

  return (
    <section className="print-insights print-report space-y-6">
      <header className="text-center space-y-1">
        <p className="text-wrap-500 text-xs uppercase tracking-widest font-medium">
          Smarter Insights
        </p>
        <h2 className="text-2xl font-bold text-white">
          Deeper look at {formatMonthLabel(report.monthKey)}
        </h2>
      </header>

      <div className="grid lg:grid-cols-2 gap-4">
        <InsightCard
          title="Cross-platform breakdown"
          subtitle="Share of conversations and estimated time saved"
        >
          {platforms.length === 0 ? (
            <p className="text-sm text-slate-400">No platform data for this month.</p>
          ) : (
            <ul className="space-y-4">
              {platforms.map((row) => (
                <PlatformRow key={row.platform} row={row} />
              ))}
            </ul>
          )}
        </InsightCard>

        <InsightCard
          title="Usage heatmap"
          subtitle="Active days from message timestamps"
          className="usage-heatmap-card"
        >
          <UsageHeatmap report={report} />
        </InsightCard>

        <InsightCard title="Topic mix" subtitle="Coding, writing, research, and other">
          <TopicMixSection report={report} />
        </InsightCard>

        <InsightCard title="Trend forecast" subtitle="Projected annual hours saved from history">
          <TrendForecastSection report={report} history={history} />
        </InsightCard>
      </div>
    </section>
  );
}
