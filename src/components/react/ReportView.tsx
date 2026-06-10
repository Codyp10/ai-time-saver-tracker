import { useEffect, useState } from "react";
import { WrappedReport } from "@/components/WrappedReport";
import { ConversationTable } from "@/components/ConversationTable";
import type { MonthlyReport } from "@/types/conversation";
import { InsightsPanel } from "@/components/InsightsPanel";
import { formatHours } from "@/engine/aggregate";
import { PLATFORM_LABELS } from "@/engine/insights";
import { computeMonthDelta, findPreviousReport } from "@/engine/monthDelta";
import {
  getReport,
  getSettings,
  listReports,
  serializeReportForExport,
} from "@/storage/db";
import { formatMonthLabel } from "@/utils/month";
import { buildShareSummary, downloadReportJson } from "@/utils/shareSummary";

interface ReportViewProps {
  monthKey?: string;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function buildDeltaBullets(report: MonthlyReport, history: MonthlyReport[]): {
  previousMonthKey: string;
  bullets: string[];
} | null {
  const previous = findPreviousReport(report, history);
  if (!previous) return null;
  const delta = computeMonthDelta(report, previous);
  const prevShort = formatMonthLabel(previous.monthKey).split(" ")[0]!;

  const bullets: string[] = [];

  const savedSign = delta.minutesSavedDelta < 0 ? "−" : "+";
  const savedText = `${savedSign}${formatHours(Math.abs(delta.minutesSavedDelta))} vs ${prevShort}`;
  bullets.push(
    delta.minutesSavedPctChange !== null
      ? `${savedText} (${delta.minutesSavedPctChange >= 0 ? "+" : ""}${delta.minutesSavedPctChange}%)`
      : savedText,
  );

  for (const p of delta.newPlatforms.slice(0, 2)) {
    bullets.push(`First month using ${PLATFORM_LABELS[p] ?? p}`);
  }

  if (delta.topGainer) {
    const label = capitalize(delta.topGainer.category.replace(/_/g, " "));
    bullets.push(
      delta.topGainer.pctChange !== null
        ? `${label} up ${delta.topGainer.pctChange}%`
        : `${label} up from zero`,
    );
  }

  if (delta.topDecliner && delta.topDecliner.pctChange !== null) {
    const label = capitalize(delta.topDecliner.category.replace(/_/g, " "));
    bullets.push(`${label} down ${Math.abs(delta.topDecliner.pctChange)}%`);
  }

  if (bullets.length < 4 && delta.conversationsDelta !== 0) {
    bullets.push(
      `${delta.conversationsDelta > 0 ? "+" : "−"}${Math.abs(delta.conversationsDelta)} conversations`,
    );
  }

  return { previousMonthKey: previous.monthKey, bullets: bullets.slice(0, 4) };
}

function MonthDeltaCard({
  report,
  history,
}: {
  report: MonthlyReport;
  history: MonthlyReport[];
}) {
  const deltaSummary = buildDeltaBullets(report, history);
  if (!deltaSummary) return null;

  return (
    <section className="insight-panel-card rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4 neon-glow-hover">
      <div>
        <h3 className="font-semibold text-white">
          What changed vs {formatMonthLabel(deltaSummary.previousMonthKey)}
        </h3>
        <p className="text-xs text-slate-400 mt-1">Compared with your previous saved report</p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {deltaSummary.bullets.map((bullet) => (
          <li
            key={bullet}
            className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-slate-300"
          >
            {bullet}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ReportView({ monthKey: monthKeyProp }: ReportViewProps) {
  const [monthKey, setMonthKey] = useState<string | null>(monthKeyProp ?? null);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [hourlyRate, setHourlyRate] = useState<number | undefined>();
  const [occupationId, setOccupationId] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [history, setHistory] = useState<MonthlyReport[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    listReports().then((r) => {
      setHistory(r);
      setHistoryLoaded(true);
    });
    getSettings().then((s) => {
      setHourlyRate(s.hourlyRate);
      setOccupationId(s.occupation);
    });
  }, []);

  useEffect(() => {
    if (monthKeyProp) {
      setMonthKey(monthKeyProp);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("m");
    if (fromQuery && /^\d{4}-\d{2}$/.test(fromQuery)) {
      setMonthKey(fromQuery);
    }
  }, [monthKeyProp]);

  useEffect(() => {
    if (monthKey || monthKeyProp || !historyLoaded || history.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("m");
    if (fromQuery && /^\d{4}-\d{2}$/.test(fromQuery)) return;
    setMonthKey(history[0]!.monthKey);
  }, [monthKey, monthKeyProp, historyLoaded, history]);

  useEffect(() => {
    if (!monthKey) return;
    let ignore = false;
    setLoaded(false);
    getReport(monthKey).then((r) => {
      if (ignore) return;
      setReport(r ?? null);
      setLoaded(true);
    });
    return () => {
      ignore = true;
    };
  }, [monthKey]);

  function navigateToMonth(key: string) {
    setMonthKey(key);
    window.history.replaceState(null, "", `?m=${key}`);
  }

  async function handleCopySummary() {
    if (!report) return;
    await navigator.clipboard.writeText(buildShareSummary(report));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handlePrint() {
    window.print();
  }

  function handleExport() {
    if (!report) return;
    downloadReportJson(report, serializeReportForExport(report));
  }

  if (!monthKey) {
    if (!historyLoaded || history.length > 0) {
      return <p className="text-center text-slate-400">Loading your wrap…</p>;
    }
    return (
      <div className="text-center space-y-4">
        <p className="text-slate-400">No saved reports yet.</p>
        <a href="/" className="text-wrap-500 hover:underline">
          Upload exports
        </a>
      </div>
    );
  }

  const newerKeys = history.map((r) => r.monthKey).filter((k) => k > monthKey);
  const olderKeys = history.map((r) => r.monthKey).filter((k) => k < monthKey);
  const nextMonthKey = newerKeys.length > 0 ? newerKeys[newerKeys.length - 1]! : null;
  const prevMonthKey = olderKeys.length > 0 ? olderKeys[0]! : null;

  const monthNav = (
    <div className="no-print flex items-center justify-center gap-3">
      <button
        type="button"
        onClick={() => prevMonthKey && navigateToMonth(prevMonthKey)}
        disabled={!prevMonthKey}
        aria-label="Previous month"
        title={prevMonthKey ? formatMonthLabel(prevMonthKey) : "No earlier report"}
        className="min-h-11 min-w-11 rounded-full border border-white/20 text-slate-300 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        ←
      </button>
      <span className="text-sm font-medium text-white min-w-36 text-center">
        {formatMonthLabel(monthKey)}
      </span>
      <button
        type="button"
        onClick={() => nextMonthKey && navigateToMonth(nextMonthKey)}
        disabled={!nextMonthKey}
        aria-label="Next month"
        title={nextMonthKey ? formatMonthLabel(nextMonthKey) : "No later report"}
        className="min-h-11 min-w-11 rounded-full border border-white/20 text-slate-300 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        →
      </button>
    </div>
  );

  if (!report) {
    if (!loaded) {
      return <p className="text-center text-slate-400">Loading your wrap…</p>;
    }
    return (
      <div className="text-center space-y-4">
        {(prevMonthKey || nextMonthKey) && monthNav}
        <p className="text-slate-400">No report found for {formatMonthLabel(monthKey)}.</p>
        <a href="/" className="text-wrap-500 hover:underline">
          Upload exports
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div className="no-print space-y-3">
        {(prevMonthKey || nextMonthKey) && monthNav}
        <div className="flex flex-wrap gap-2 justify-center">
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
          <button
            type="button"
            onClick={handleExport}
            className="min-h-11 px-4 py-2.5 rounded-full border border-white/20 text-sm text-slate-300 hover:bg-white/10"
          >
            Export JSON
          </button>
        </div>
        <p className="text-center text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
          For the best PDF: in the print dialog turn off{" "}
          <strong className="text-slate-400">Headers and footers</strong> (removes the browser
          date/time). Page numbers are added via print styles when your browser supports them.
        </p>
      </div>

      <WrappedReport report={report} hourlyRate={hourlyRate} occupationId={occupationId} />
      <MonthDeltaCard report={report} history={history} />
      <InsightsPanel report={report} history={history} />
      <div className="conversation-table-section">
        <ConversationTable analyses={report.analyses} />
      </div>
      <p className="text-center no-print">
        <a href="/methodology" className="text-wrap-500 text-sm hover:underline">
          How we calculate these numbers →
        </a>
      </p>
    </div>
  );
}
