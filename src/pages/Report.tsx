import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { WrappedReport } from "@/components/WrappedReport";
import { ConversationTable } from "@/components/ConversationTable";
import type { MonthlyReport } from "@/types/conversation";
import {
  getReport,
  getSettings,
  serializeReportForExport,
} from "@/storage/db";
import { formatMonthLabel } from "@/utils/month";
import { buildShareSummary, downloadReportJson } from "@/utils/shareSummary";

export function Report() {
  const { monthKey: key } = useParams<{ monthKey: string }>();
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [hourlyRate, setHourlyRate] = useState<number | undefined>();
  const [occupationId, setOccupationId] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!key) return;
    getReport(key).then((r) => setReport(r ?? null));
    getSettings().then((s) => {
      setHourlyRate(s.hourlyRate);
      setOccupationId(s.occupation);
    });
  }, [key]);

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

  if (!key) {
    return <p className="text-slate-400">Missing month.</p>;
  }

  if (!report) {
    return (
      <div className="text-center space-y-4">
        <p className="text-slate-400">No report found for {formatMonthLabel(key)}.</p>
        <Link to="/" className="text-brand-400 hover:underline">
          Upload exports
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap gap-2 justify-center no-print">
        <button
          type="button"
          onClick={handleCopySummary}
          className="px-4 py-2 rounded-full border border-white/20 text-sm text-slate-300 hover:bg-white/10"
        >
          {copied ? "Copied!" : "Copy summary"}
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className="px-4 py-2 rounded-full border border-white/20 text-sm text-slate-300 hover:bg-white/10"
        >
          Print / Save PDF
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="px-4 py-2 rounded-full border border-white/20 text-sm text-slate-300 hover:bg-white/10"
        >
          Export JSON
        </button>
      </div>

      <WrappedReport
        report={report}
        hourlyRate={hourlyRate}
        occupationId={occupationId}
      />
      <div className="conversation-table-section">
        <ConversationTable analyses={report.analyses} />
      </div>
      <p className="text-center no-print">
        <Link to="/methodology" className="text-brand-400 text-sm hover:underline">
          How we calculate these numbers →
        </Link>
      </p>
    </div>
  );
}
