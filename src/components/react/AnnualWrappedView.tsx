import { useEffect, useMemo, useState } from "react";
import { formatHours, HOURS_PER_BOOK, topCategory } from "@/engine/aggregate";
import {
  buildAnnualReport,
  yearsWithReports,
  type AnnualReport,
} from "@/engine/annual";
import { computeSuperlatives } from "@/engine/superlatives";
import { computeRoi } from "@/engine/value";
import type { MonthlyReport } from "@/types/conversation";
import { getSettings, listReports } from "@/storage/db";
import { formatHourLabel, formatMonthLabel, parseMonthKey } from "@/utils/month";
import { buildAnnualShareSummary } from "@/utils/shareSummary";

const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  grok: "Grok",
  gemini: "Gemini",
  cursor: "Cursor",
  claude_code: "Claude Code",
};

const BUCKET_LABELS = {
  coding: "Coding",
  writing: "Writing",
  research: "Research",
  other: "Other",
};

function formatDayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

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

function YearBarChart({ annual }: { annual: AnnualReport }) {
  const withData = annual.byMonth.filter((m) => m.hasData);
  const maxSaved = Math.max(...withData.map((m) => m.minutesSaved), 1);

  return (
    <div className="insight-panel-card rounded-xl border border-white/10 p-4 bg-white/5">
      <h3 className="font-semibold text-white mb-3">Saved time by month</h3>
      <div className="flex items-end gap-1.5 h-40">
        {annual.byMonth.map((m) => {
          const label = parseMonthKey(m.monthKey).month;
          const monthShort = new Date(2000, label - 1, 1).toLocaleDateString("en-US", {
            month: "short",
          });
          const pct = m.hasData ? (m.minutesSaved / maxSaved) * 100 : 0;
          return (
            <div key={m.monthKey} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              {m.hasData && (
                <span className="text-[9px] text-slate-500 truncate w-full text-center">
                  {formatHours(m.minutesSaved)}
                </span>
              )}
              <div className="w-full flex items-end justify-center h-24">
                <div
                  className={`w-full max-w-8 rounded-t-md ${
                    m.hasData ? "bg-wrap-600" : "bg-white/10"
                  }`}
                  style={{ height: m.hasData ? `${Math.max(pct, 4)}%` : "8%" }}
                  title={
                    m.hasData
                      ? `${formatMonthLabel(m.monthKey)}: ${formatHours(m.minutesSaved)} saved`
                      : `${formatMonthLabel(m.monthKey)}: no report`
                  }
                />
              </div>
              <span className="text-[9px] text-slate-400">{monthShort}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface AnnualWrappedViewProps {
  year: number;
}

export default function AnnualWrappedView({ year: initialYear }: AnnualWrappedViewProps) {
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [hourlyRate, setHourlyRate] = useState<number | undefined>();
  const [occupationId, setOccupationId] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    listReports().then((r) => {
      setReports(r);
      setLoaded(true);
    });
    getSettings().then((s) => {
      setHourlyRate(s.hourlyRate);
      setOccupationId(s.occupation);
    });
  }, []);

  const availableYears = useMemo(() => yearsWithReports(reports), [reports]);

  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]!);
    }
  }, [availableYears, selectedYear]);

  const annual = useMemo(
    () => buildAnnualReport(reports, selectedYear),
    [reports, selectedYear],
  );

  const monthReports = useMemo(
    () =>
      reports
        .filter((r) => parseMonthKey(r.monthKey).year === selectedYear)
        .sort((a, b) => a.monthKey.localeCompare(b.monthKey)),
    [reports, selectedYear],
  );

  const superlatives = useMemo(
    () =>
      computeSuperlatives(
        monthReports.flatMap((r) => r.analyses),
        { year: selectedYear },
      ),
    [monthReports, selectedYear],
  );

  async function handleCopySummary() {
    if (!annual) return;
    await navigator.clipboard.writeText(buildAnnualShareSummary(annual));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handlePrint() {
    window.print();
  }

  if (!loaded) {
    return <p className="text-center text-slate-400">Loading your annual wrap…</p>;
  }

  if (availableYears.length === 0) {
    return (
      <div className="text-center space-y-4">
        <p className="text-slate-400">No saved reports yet for an annual wrap.</p>
        <a href="/" className="text-wrap-500 hover:underline">
          Upload your first wrap
        </a>
      </div>
    );
  }

  if (!annual) {
    return (
      <div className="text-center space-y-4">
        <p className="text-slate-400">No reports found for {selectedYear}.</p>
        <a href="/history" className="text-wrap-500 hover:underline">
          View history
        </a>
      </div>
    );
  }

  const { totals, personality } = annual;
  const roi = computeRoi(totals, occupationId, hourlyRate);
  const books = Math.round(totals.minutesSaved / 60 / HOURS_PER_BOOK);
  const top = topCategory(totals.byCategory);
  const platformEntries = Object.entries(totals.byPlatform).map(([p, mins]) => [
    PLATFORM_LABELS[p] ?? p,
    mins,
  ]) as [string, number][];
  const categoryEntries = Object.entries(totals.byCategory) as [string, number][];
  const bucketTotal = Object.values(personality.bucketMinutesSaved).reduce((s, v) => s + v, 0);

  const cards = [
    {
      title: "Estimated active time with AI",
      value: formatHours(totals.minutesSpent),
      sub: `Based on ${annual.monthsIncluded} month${annual.monthsIncluded === 1 ? "" : "s"} of reports`,
      className: "surface-card",
    },
    {
      title: "Estimated time saved",
      value: formatHours(totals.minutesSaved),
      sub: `Range: ${formatHours(totals.minutesSavedLow)} – ${formatHours(totals.minutesSavedHigh)}`,
      className: "surface-card-alt",
    },
    {
      title: "Best month",
      value: annual.bestMonthKey ? formatMonthLabel(annual.bestMonthKey).split(" ")[0]! : "—",
      sub: annual.bestMonthKey
        ? formatMonthLabel(annual.bestMonthKey)
        : "Save more monthly reports",
      className: "surface-card",
    },
    {
      title: "Top platform",
      value: annual.platformLeader,
      sub: "By estimated time saved",
      className: "surface-card-alt",
    },
    {
      title: "Busiest hour",
      value: formatHourLabel(totals.busiestHour),
      sub: `Most active day: ${totals.busiestDay}`,
      className: "surface-card",
    },
    {
      title: "Conversations analyzed",
      value: String(totals.conversationCount),
      sub: `That's like reading ${books} books (~${HOURS_PER_BOOK} hrs each)`,
      className: "surface-card-alt",
    },
  ];

  return (
    <div className="space-y-12">
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        {availableYears.length > 1 ? (
          <label className="flex items-center gap-2 text-sm text-slate-400">
            Year
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="rounded-lg border border-white/20 bg-surface-800 px-3 py-2 text-white"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopySummary}
            className="min-h-11 px-4 py-2.5 rounded-full border border-white/20 text-sm text-slate-300 hover:bg-white/10"
          >
            {copied ? "Copied!" : "Copy summary"}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="min-h-11 px-4 py-2.5 rounded-full border border-white/20 text-sm text-slate-300 hover:bg-white/10"
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      <section className="space-y-8 print-report">
        <header className="text-center space-y-2">
          <p className="text-wrap-400 text-sm uppercase tracking-widest font-medium">
            {selectedYear} Wrapped
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white">
            {formatHours(totals.minutesSaved)} saved
          </h1>
          <p className="text-slate-400">
            ≈ ${roi.dollarsSaved.toLocaleString()} at ${roi.hourlyRate}/hr
            {roi.roiRatio !== null && <> · {roi.roiRatio.toFixed(1)}x return on time spent</>} ·
            Based on {annual.monthsIncluded} of 12 months
          </p>
          {annual.monthsMissing > 0 && (
            <p className="text-sm text-slate-500">
              Partial year — {annual.monthsMissing} month
              {annual.monthsMissing === 1 ? "" : "s"} without saved reports
            </p>
          )}
        </header>

        <div className="grid sm:grid-cols-2 gap-4">
          {cards.map((card) => (
            <article key={card.title} className={`rounded-2xl p-6 ${card.className}`}>
              <p className="text-slate-300 text-sm">{card.title}</p>
              <p className="text-3xl font-bold text-white mt-2">{card.value}</p>
              <p className="text-slate-400 text-xs mt-2">{card.sub}</p>
            </article>
          ))}
        </div>

        {superlatives.activeDays > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                label: "Active days",
                value: String(superlatives.activeDays),
                sub: `with AI activity in ${selectedYear}`,
              },
              {
                label: "Longest streak",
                value: `${superlatives.longestStreak} day${superlatives.longestStreak === 1 ? "" : "s"}`,
                sub: "in a row",
              },
              ...(superlatives.biggestDay
                ? [
                    {
                      label: "Biggest day",
                      value: formatHours(superlatives.biggestDay.minutesSaved),
                      sub: formatDayLabel(superlatives.biggestDay.date),
                    },
                  ]
                : []),
            ].map((chip) => (
              <article
                key={chip.label}
                className="insight-panel-card rounded-xl border border-white/10 bg-white/5 p-4 text-center"
              >
                <p className="text-[10px] uppercase tracking-wide text-slate-500">{chip.label}</p>
                <p className="text-lg font-bold text-wrap-500 mt-1">{chip.value}</p>
                <p className="text-[10px] text-slate-500 mt-1">{chip.sub}</p>
              </article>
            ))}
          </div>
        )}

        <YearBarChart annual={annual} />

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

        <div className="insight-panel-card rounded-xl border border-white/10 p-6 bg-white/5 text-center space-y-3">
          <p className="text-xs text-wrap-500 uppercase tracking-widest">Your AI personality</p>
          <h2 className="text-3xl font-bold text-white">{personality.label}</h2>
          <p className="text-slate-400 max-w-md mx-auto">{personality.tagline}</p>
          {bucketTotal > 0 && (
            <ul className="mt-4 space-y-2 text-left max-w-sm mx-auto">
              {(["coding", "writing", "research", "other"] as const).map((key) => {
                const mins = personality.bucketMinutesSaved[key];
                if (mins <= 0) return null;
                const pct = Math.round((mins / bucketTotal) * 100);
                return (
                  <li key={key}>
                    <div className="flex justify-between text-sm text-slate-300 mb-1">
                      <span>{BUCKET_LABELS[key]}</span>
                      <span>
                        {formatHours(mins)} · {pct}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-wrap-500/80"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-xs text-slate-500 pt-2">
            Top task category: {top.replace(/_/g, " ")}
          </p>
        </div>

        {annual.topConversations.length > 0 && (
          <div className="insight-panel-card rounded-xl border border-white/10 p-4 bg-white/5 overflow-x-auto">
            <h3 className="font-semibold text-white mb-3">Top conversations of {selectedYear}</h3>
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-slate-500 border-b border-white/10">
                  <th className="py-2 pr-4 font-medium">Title</th>
                  <th className="py-2 pr-4 font-medium">Platform</th>
                  <th className="py-2 pr-4 font-medium">Category</th>
                  <th className="py-2 text-right font-medium">Saved</th>
                </tr>
              </thead>
              <tbody>
                {annual.topConversations.slice(0, 10).map((a) => (
                  <tr key={a.conversation.id} className="border-b border-white/5 text-slate-300">
                    <td className="py-2 pr-4 max-w-[12rem] truncate" title={a.conversation.title}>
                      {a.conversation.title || "Untitled"}
                    </td>
                    <td className="py-2 pr-4">
                      {PLATFORM_LABELS[a.conversation.platform] ?? a.conversation.platform}
                    </td>
                    <td className="py-2 pr-4 capitalize">{a.category.replace(/_/g, " ")}</td>
                    <td className="py-2 text-right text-wrap-500">{formatHours(a.minutesSaved)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {monthReports.length > 0 && (
          <div className="insight-panel-card rounded-xl border border-white/10 p-4 bg-white/5 no-print">
            <h3 className="font-semibold text-white mb-3">Monthly reports</h3>
            <ul className="flex flex-wrap gap-2">
              {monthReports.map((r) => (
                <li key={r.monthKey}>
                  <a
                    href={`/report?m=${r.monthKey}`}
                    className="inline-block px-3 py-1.5 rounded-full text-sm border border-white/20 text-wrap-500 hover:bg-white/10"
                  >
                    {formatMonthLabel(r.monthKey)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <p className="text-center no-print">
        <a href="/methodology" className="text-wrap-500 text-sm hover:underline">
          How we calculate these numbers →
        </a>
      </p>
    </div>
  );
}
