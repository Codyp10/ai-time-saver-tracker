import { useEffect, useRef, useState } from "react";
import type { MonthlyReport } from "@/types/conversation";
import {
  deleteReport,
  deserializeReport,
  listReports,
  saveReport,
  serializeReportForExport,
} from "@/storage/db";
import { formatHours } from "@/engine/aggregate";
import { formatMonthLabel } from "@/utils/month";
import { downloadReportJson } from "@/utils/shareSummary";

const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  grok: "Grok",
  gemini: "Gemini",
  cursor: "Cursor",
  claude_code: "Claude Code",
};

function TrendsChart({ reports }: { reports: MonthlyReport[] }) {
  if (reports.length < 2) return null;

  const chronological = [...reports].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  const maxSaved = Math.max(...chronological.map((r) => r.totals.minutesSaved), 1);
  const best = chronological.reduce((a, b) =>
    a.totals.minutesSaved >= b.totals.minutesSaved ? a : b,
  );

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-white">Trends</h2>
        <p className="text-sm text-slate-400">
          Best month:{" "}
          <span className="text-wrap-500">
            {formatMonthLabel(best.monthKey)} ({formatHours(best.totals.minutesSaved)})
          </span>
        </p>
      </div>

      <div className="flex items-end gap-2 h-40">
        {chronological.map((r) => {
          const pct = (r.totals.minutesSaved / maxSaved) * 100;
          const label = formatMonthLabel(r.monthKey).split(" ")[0]!.slice(0, 3);
          return (
            <div key={r.monthKey} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <span className="text-[10px] text-slate-500 truncate w-full text-center">
                {formatHours(r.totals.minutesSaved)}
              </span>
              <div className="w-full flex items-end justify-center h-24">
                <div
                  className="w-full max-w-10 rounded-t-md bg-wrap-600"
                  style={{ height: `${Math.max(pct, 4)}%` }}
                  title={`${formatMonthLabel(r.monthKey)}: ${formatHours(r.totals.minutesSaved)} saved`}
                />
              </div>
              <span className="text-[10px] text-slate-400">{label}</span>
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Platform mix (saved time)</p>
        {chronological.map((r) => {
          const platforms = Object.entries(r.totals.byPlatform).filter(([, v]) => v > 0);
          const total = platforms.reduce((s, [, v]) => s + v, 0) || 1;
          return (
            <div key={r.monthKey} className="space-y-1">
              <p className="text-xs text-slate-400">{formatMonthLabel(r.monthKey)}</p>
              <div className="flex h-2 rounded-full overflow-hidden bg-white/5">
                {platforms.map(([p, mins]) => (
                  <div
                    key={p}
                    className="h-full bg-wrap-500/80 first:rounded-l-full last:rounded-r-full"
                    style={{ width: `${(mins / total) * 100}%` }}
                    title={`${PLATFORM_LABELS[p] ?? p}: ${formatHours(mins)}`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function HistoryView() {
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listReports().then(setReports);
  }, []);

  async function handleDelete(monthKey: string) {
    if (!confirm(`Delete report for ${formatMonthLabel(monthKey)}?`)) return;
    await deleteReport(monthKey);
    setReports((r) => r.filter((x) => x.monthKey !== monthKey));
  }

  function handleExport(report: MonthlyReport) {
    downloadReportJson(report, serializeReportForExport(report));
  }

  async function handleImportFile(file: File) {
    setImportError(null);
    setImportSuccess(null);
    try {
      const text = await file.text();
      const report = deserializeReport(text);
      if (!report.monthKey || !report.totals) {
        throw new Error("Invalid report format.");
      }
      const existing = reports.find((r) => r.monthKey === report.monthKey);
      if (existing) {
        const ok = confirm(
          `A report for ${formatMonthLabel(report.monthKey)} already exists. Replace it?`,
        );
        if (!ok) return;
      }
      await saveReport(report);
      const updated = await listReports();
      setReports(updated);
      setImportSuccess(`Imported ${formatMonthLabel(report.monthKey)}.`);
      setTimeout(() => setImportSuccess(null), 3000);
    } catch {
      setImportError("Could not import file. Make sure it is a valid report JSON export.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-white">History</h1>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-full border border-white/20 text-sm text-slate-300 hover:bg-white/10"
          >
            Import report
          </button>
        </div>
      </div>

      {importError && (
        <p className="text-red-400 text-sm bg-red-950/30 rounded-lg p-3">{importError}</p>
      )}
      {importSuccess && (
        <p className="text-green-400 text-sm bg-green-950/30 rounded-lg p-3">{importSuccess}</p>
      )}

      {reports.length >= 2 && <TrendsChart reports={reports} />}

      {reports.length === 0 ? (
        <p className="text-slate-400">
          No saved reports yet.{" "}
          <a href="/" className="text-wrap-500 hover:underline">
            Upload your first wrap
          </a>
        </p>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li
              key={r.monthKey}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-4"
            >
              <div>
                <a
                  href={`/report/${r.monthKey}`}
                  className="text-lg font-semibold text-white hover:text-wrap-500"
                >
                  {formatMonthLabel(r.monthKey)}
                </a>
                <p className="text-slate-400 text-sm mt-1">
                  {formatHours(r.totals.minutesSaved)} saved · {r.totals.conversationCount}{" "}
                  conversations
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleExport(r)}
                  className="text-sm text-wrap-500 hover:text-wrap-400"
                >
                  Export
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(r.monthKey)}
                  className="text-sm text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
