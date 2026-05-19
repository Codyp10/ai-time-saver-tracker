import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { MonthlyReport } from "@/types/conversation";
import { listReports, deleteReport } from "@/storage/db";
import { formatHours } from "@/engine/aggregate";
import { formatMonthLabel } from "@/utils/month";

export function History() {
  const [reports, setReports] = useState<MonthlyReport[]>([]);

  useEffect(() => {
    listReports().then(setReports);
  }, []);

  async function handleDelete(monthKey: string) {
    if (!confirm(`Delete report for ${formatMonthLabel(monthKey)}?`)) return;
    await deleteReport(monthKey);
    setReports((r) => r.filter((x) => x.monthKey !== monthKey));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">History</h1>
      {reports.length === 0 ? (
        <p className="text-slate-400">
          No saved reports yet.{" "}
          <Link to="/" className="text-brand-400 hover:underline">
            Upload your first wrap
          </Link>
        </p>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li
              key={r.monthKey}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-4"
            >
              <div>
                <Link
                  to={`/report/${r.monthKey}`}
                  className="text-lg font-semibold text-white hover:text-brand-400"
                >
                  {formatMonthLabel(r.monthKey)}
                </Link>
                <p className="text-slate-400 text-sm mt-1">
                  {formatHours(r.totals.minutesSaved)} saved ·{" "}
                  {r.totals.conversationCount} conversations
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(r.monthKey)}
                className="text-sm text-red-400 hover:text-red-300"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
