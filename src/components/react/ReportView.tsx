import { useEffect, useState } from "react";
import { WrappedReport } from "@/components/WrappedReport";
import { ConversationTable } from "@/components/ConversationTable";
import type { MonthlyReport } from "@/types/conversation";
import { InsightsPanel } from "@/components/InsightsPanel";
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

export default function ReportView({ monthKey: monthKeyProp }: ReportViewProps) {
  const [monthKey, setMonthKey] = useState<string | null>(monthKeyProp ?? null);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [hourlyRate, setHourlyRate] = useState<number | undefined>();
  const [occupationId, setOccupationId] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [history, setHistory] = useState<MonthlyReport[]>([]);

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
    if (!monthKey) return;
    setLoaded(false);
    getReport(monthKey).then((r) => {
      setReport(r ?? null);
      setLoaded(true);
    });
    getSettings().then((s) => {
      setHourlyRate(s.hourlyRate);
      setOccupationId(s.occupation);
    });
    listReports().then(setHistory);
  }, [monthKey]);

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
    return (
      <div className="text-center space-y-4">
        <p className="text-slate-400">No month selected.</p>
        <a href="/" className="text-wrap-500 hover:underline">
          Upload exports
        </a>
      </div>
    );
  }

  if (!report) {
    if (!loaded) {
      return <p className="text-center text-slate-400">Loading your wrap…</p>;
    }
    return (
      <div className="text-center space-y-4">
        <p className="text-slate-400">No report found for {formatMonthLabel(monthKey)}.</p>
        <a href="/" className="text-wrap-500 hover:underline">
          Upload exports
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap gap-2 justify-center no-print">
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

      <WrappedReport report={report} hourlyRate={hourlyRate} occupationId={occupationId} />
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
