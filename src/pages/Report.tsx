import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { WrappedReport } from "@/components/WrappedReport";
import { ConversationTable } from "@/components/ConversationTable";
import type { MonthlyReport } from "@/types/conversation";
import { getReport, getSettings } from "@/storage/db";
import { formatMonthLabel } from "@/utils/month";

export function Report() {
  const { monthKey: key } = useParams<{ monthKey: string }>();
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [hourlyRate, setHourlyRate] = useState<number | undefined>();
  const [occupationId, setOccupationId] = useState<string | undefined>();

  useEffect(() => {
    if (!key) return;
    getReport(key).then((r) => setReport(r ?? null));
    getSettings().then((s) => {
      setHourlyRate(s.hourlyRate);
      setOccupationId(s.occupation);
    });
  }, [key]);

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
      <WrappedReport
        report={report}
        hourlyRate={hourlyRate}
        occupationId={occupationId}
      />
      <ConversationTable analyses={report.analyses} />
      <p className="text-center">
        <Link to="/methodology" className="text-brand-400 text-sm hover:underline">
          How we calculate these numbers →
        </Link>
      </p>
    </div>
  );
}
