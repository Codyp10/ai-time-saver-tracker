import { useEffect, useRef, useState } from "react";
import { UploadZone } from "@/components/UploadZone";
import { MonthPickerHint } from "@/components/MonthPickerHint";
import { SkillQuiz } from "@/components/SkillQuiz";
import { OccupationPrompt } from "@/components/OccupationPrompt";
import {
  filterConversationsByMonth,
  classifyMonthFilter,
  formatUploadSummary,
  listMonthsInConversations,
  userFacingError,
  type MultiParseResult,
  type ParseProgress,
} from "@/parsers";
import { parseMultipleUploadFilesInWorker } from "@/parsers/workerClient";
import { formatBytes } from "@/config/securityLimits";
import type { NormalizedConversation, Platform, QuizProfile, SkillLevel } from "@/types/conversation";
import { formatMonthLabel, getCurrentMonth, getPreviousMonth, monthKey } from "@/utils/month";
import { buildMonthlyReport } from "@/engine/aggregate";
import { defaultQuizProfile } from "@/engine/quizProfile";
import { getReport, getSettings, saveReport, saveSettings } from "@/storage/db";
import { brand } from "@/config/brand";

type Step = "upload" | "occupation" | "quiz" | "processing";

interface UploadSummary {
  text: string;
  filesParsed: number;
  filesFailed: number;
  failedFiles: { name: string; error: string }[];
  duplicatesRemoved: number;
  byPlatform: Partial<Record<Platform, number>>;
}

function needsOccupationSetup(occupation: string | undefined): boolean {
  return occupation === undefined;
}

export default function HomeUpload() {
  const defaultMonth = getPreviousMonth();
  const [year, setYear] = useState(defaultMonth.year);
  const [month, setMonth] = useState(defaultMonth.month);
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [parseProgress, setParseProgress] = useState<ParseProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [failedFileWarnings, setFailedFileWarnings] = useState<string[]>([]);
  const [parsed, setParsed] = useState<NormalizedConversation[]>([]);
  const [uploadSummary, setUploadSummary] = useState<UploadSummary | null>(null);
  const [pendingParse, setPendingParse] = useState<MultiParseResult | null>(null);
  const [resolvedMonth, setResolvedMonth] = useState<{ year: number; month: number } | null>(null);
  const [allMonths, setAllMonths] = useState(false);
  const [backfillMonths, setBackfillMonths] = useState<{ year: number; month: number }[]>([]);
  const [backfillProgress, setBackfillProgress] = useState<{ index: number; total: number; label: string } | null>(null);
  const [defaultSkillLevel, setDefaultSkillLevel] = useState<SkillLevel>("intermediate");
  /** Month key we already auto-advanced for, so backing out doesn't immediately re-advance. */
  const autoAdvancedKeyRef = useRef<string | null>(null);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 4 }, (_, i) => currentYear - 2 + i);

  useEffect(() => {
    getSettings().then((s) => {
      if (s.skillLevel) setDefaultSkillLevel(s.skillLevel);
    });
  }, []);

  useEffect(() => {
    document.body.classList.toggle("flow-active", step !== "upload");
    return () => document.body.classList.remove("flow-active");
  }, [step]);

  useEffect(() => {
    if (step === "upload") return;
    document.getElementById("upload-flow")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  useEffect(() => {
    if (!pendingParse || loading || step !== "upload") return;
    if (classifyMonthFilter(pendingParse.conversations, year, month) !== "matched") {
      autoAdvancedKeyRef.current = null;
      return;
    }
    const key = monthKey(year, month);
    if (autoAdvancedKeyRef.current === key) return;
    autoAdvancedKeyRef.current = key;
    void tryMonthFromHint({ year, month });
  }, [year, month, pendingParse, loading, step]);

  function countByPlatform(conversations: NormalizedConversation[]): Partial<Record<Platform, number>> {
    return Object.fromEntries(
      Object.entries(
        conversations.reduce<Partial<Record<Platform, number>>>((acc, c) => {
          acc[c.platform] = (acc[c.platform] ?? 0) + 1;
          return acc;
        }, {}),
      ).filter(([, n]) => (n ?? 0) > 0),
    ) as Partial<Record<Platform, number>>;
  }

  async function advanceWithParseResult(
    result: MultiParseResult,
    targetYear: number,
    targetMonth: number,
  ): Promise<boolean> {
    const failedFiles = result.outcomes
      .filter((o) => !o.success)
      .map((o) => ({ name: o.fileName, error: o.error ?? "Unknown error" }));

    const filterOutcome = classifyMonthFilter(result.conversations, targetYear, targetMonth);
    if (filterOutcome !== "matched") {
      setYear(targetYear);
      setMonth(targetMonth);
      setPendingParse(result);
      setError(
        filterOutcome === "empty_export"
          ? "No conversations were found in the parsed exports."
          : `No conversations found for ${formatMonthLabel(monthKey(targetYear, targetMonth))}.`,
      );
      setFailedFileWarnings(failedFiles.map((f) => `Could not parse "${f.name}": ${f.error}`));
      return false;
    }

    const filtered = filterConversationsByMonth(result.conversations, targetYear, targetMonth);
    const byPlatform = countByPlatform(filtered);

    setParsed(filtered);
    setResolvedMonth({ year: targetYear, month: targetMonth });
    setYear(targetYear);
    setMonth(targetMonth);
    setUploadSummary({
      text: formatUploadSummary(result.filesParsed, filtered.length, byPlatform),
      filesParsed: result.filesParsed,
      filesFailed: result.filesFailed,
      failedFiles,
      duplicatesRemoved: result.merge.duplicatesRemoved,
      byPlatform,
    });

    setFailedFileWarnings(failedFiles.map((f) => `Skipped "${f.name}": ${f.error}`));

    const settings = await getSettings();
    setStep(needsOccupationSetup(settings.occupation) ? "occupation" : "quiz");
    return true;
  }

  async function advanceWithAllMonths(result: MultiParseResult): Promise<boolean> {
    const failedFiles = result.outcomes
      .filter((o) => !o.success)
      .map((o) => ({ name: o.fileName, error: o.error ?? "Unknown error" }));

    if (result.conversations.length === 0) {
      setPendingParse(result);
      setError("No conversations were found in the parsed exports.");
      setFailedFileWarnings(failedFiles.map((f) => `Could not parse "${f.name}": ${f.error}`));
      return false;
    }

    const months = listMonthsInConversations(result.conversations);
    const byPlatform = countByPlatform(result.conversations);

    setParsed(result.conversations);
    setBackfillMonths(months);
    setResolvedMonth(null);
    setUploadSummary({
      text: formatUploadSummary(result.filesParsed, result.conversations.length, byPlatform),
      filesParsed: result.filesParsed,
      filesFailed: result.filesFailed,
      failedFiles,
      duplicatesRemoved: result.merge.duplicatesRemoved,
      byPlatform,
    });

    setFailedFileWarnings(failedFiles.map((f) => `Skipped "${f.name}": ${f.error}`));

    const settings = await getSettings();
    setStep(needsOccupationSetup(settings.occupation) ? "occupation" : "quiz");
    return true;
  }

  async function handleFiles(files: File[]) {
    setError(null);
    setWarnings([]);
    setFailedFileWarnings([]);
    setUploadSummary(null);
    setPendingParse(null);
    setResolvedMonth(null);
    setBackfillMonths([]);
    autoAdvancedKeyRef.current = null;
    setLoading(true);
    setParseProgress(null);

    try {
      const result = await parseMultipleUploadFilesInWorker(files, (progress) => {
        setParseProgress(progress);
      });
      setWarnings(result.warnings);

      if (result.filesParsed === 0) {
        const failedFiles = result.outcomes
          .filter((o) => !o.success)
          .map((o) => ({ name: o.fileName, error: o.error ?? "Unknown error" }));
        const firstError = failedFiles[0]?.error ?? "Could not parse any of the selected files.";
        setError(
          failedFiles.length > 1
            ? `All ${failedFiles.length} files failed to parse. ${firstError}`
            : firstError,
        );
        setLoading(false);
        return;
      }

      if (allMonths) {
        await advanceWithAllMonths(result);
      } else {
        await advanceWithParseResult(result, year, month);
      }
    } catch (err) {
      setError(userFacingError(err));
    } finally {
      setLoading(false);
      setParseProgress(null);
    }
  }

  async function tryMonthFromHint(next: { year: number; month: number }) {
    if (!pendingParse) return;
    setError(null);
    setLoading(true);
    try {
      await advanceWithParseResult(pendingParse, next.year, next.month);
    } finally {
      setLoading(false);
    }
  }

  async function importAllMonthsFromPending(parse?: MultiParseResult) {
    const result = parse ?? pendingParse;
    if (!result) return;
    setError(null);
    setLoading(true);
    try {
      await advanceWithAllMonths(result);
    } finally {
      setLoading(false);
    }
  }

  async function handleOccupationSelect(occupationId: string) {
    const settings = await getSettings();
    await saveSettings({ ...settings, occupation: occupationId });
    setStep("quiz");
  }

  async function finishBackfillReports(quizProfile: QuizProfile): Promise<void> {
    const keys = backfillMonths.map((m) => monthKey(m.year, m.month));
    let existingCount = 0;
    for (const key of keys) {
      if (await getReport(key)) existingCount++;
    }
    if (existingCount > 0) {
      const ok = confirm(
        `This will save ${keys.length} monthly report${keys.length === 1 ? "" : "s"}, replacing ${existingCount} existing. Continue?`,
      );
      if (!ok) {
        setStep("quiz");
        return;
      }
    }

    const settings = await getSettings();
    let latestKey = keys[0]!;
    for (let i = 0; i < backfillMonths.length; i++) {
      const m = backfillMonths[i]!;
      const key = monthKey(m.year, m.month);
      setBackfillProgress({
        index: i + 1,
        total: backfillMonths.length,
        label: formatMonthLabel(key),
      });
      const filtered = filterConversationsByMonth(parsed, m.year, m.month);
      const report = await buildMonthlyReport(filtered, key, quizProfile, settings.openaiApiKey);
      await saveReport(report);
      if (key > latestKey) latestKey = key;
    }
    window.location.href = `/report?m=${latestKey}`;
  }

  async function finishReport(quizProfile: QuizProfile) {
    setStep("processing");
    setLoading(true);
    setError(null);
    try {
      if (backfillMonths.length > 0) {
        await finishBackfillReports(quizProfile);
        return;
      }

      const target = resolvedMonth ?? { year, month };
      const key = monthKey(target.year, target.month);
      const existing = await getReport(key);
      if (existing) {
        const label = formatMonthLabel(key);
        const ok = confirm(
          `A report for ${label} already exists. Replace it with this new wrap?`,
        );
        if (!ok) {
          setStep("quiz");
          setLoading(false);
          return;
        }
      }

      const settings = await getSettings();
      const report = await buildMonthlyReport(
        parsed,
        key,
        quizProfile,
        settings.openaiApiKey,
      );
      await saveReport(report);
      window.location.href = `/report?m=${report.monthKey}`;
    } catch (err) {
      setError(userFacingError(err));
      const settings = await getSettings();
      setStep(needsOccupationSetup(settings.occupation) ? "occupation" : "quiz");
    } finally {
      setLoading(false);
      setBackfillProgress(null);
    }
  }

  function renderSummaryBanner() {
    if (!uploadSummary) return null;
    const reportMonth = resolvedMonth ?? { year, month };

    return (
      <div className="text-center space-y-2">
        <p className="text-slate-300">
          <strong className="text-white">{uploadSummary.text}</strong>{" "}
          {backfillMonths.length > 0
            ? `across ${backfillMonths.length} month${backfillMonths.length === 1 ? "" : "s"} — a report will be saved for each.`
            : `for ${reportMonth.month}/${reportMonth.year}.`}
        </p>
        {uploadSummary.duplicatesRemoved > 0 && (
          <p className="text-sm text-text-muted">
            Removed {uploadSummary.duplicatesRemoved} duplicate conversation
            {uploadSummary.duplicatesRemoved === 1 ? "" : "s"} across files.
          </p>
        )}
      </div>
    );
  }

  const visibleWarnings = [...warnings, ...failedFileWarnings];

  if (step !== "upload") {
    return (
      <div className="max-w-3xl mx-auto py-12 space-y-10 min-h-[50vh]">
        {step === "occupation" && (
          <>
            {renderSummaryBanner()}
            <OccupationPrompt onSelect={handleOccupationSelect} />
          </>
        )}

        {step === "quiz" && (
          <>
            {renderSummaryBanner()}
            <SkillQuiz
              defaultSkillLevel={defaultSkillLevel}
              onComplete={finishReport}
              onSkip={async () => {
                const settings = await getSettings();
                finishReport(
                  settings.defaultQuizProfile ??
                    defaultQuizProfile(settings.skillLevel ?? defaultSkillLevel),
                );
              }}
            />
            {error && (
              <p className="text-center text-red-400 bg-red-950/30 rounded-lg p-3">{error}</p>
            )}
          </>
        )}

        {step === "processing" && (
          <>
            <div aria-live="polite" role="status">
              <p className="text-center text-wrap-500 text-lg animate-pulse">
                {brand.processingMessage}
              </p>
              {backfillProgress && (
                <p className="text-center text-text-muted text-sm mt-2">
                  Building report {backfillProgress.index} of {backfillProgress.total} —{" "}
                  {backfillProgress.label}…
                </p>
              )}
            </div>
            {error && (
              <p role="alert" className="text-center text-red-400 bg-red-950/30 rounded-lg p-3">
                {error}
              </p>
            )}
          </>
        )}

        {step !== "processing" && visibleWarnings.length > 0 && (
          <ul className="text-amber-200/80 text-sm space-y-1 bg-amber-950/20 rounded-lg p-3">
            {visibleWarnings.map((w, i) => (
              <li key={`${i}-${w}`}>⚠ {w}</li>
            ))}
          </ul>
        )}

        {step !== "processing" && (
          <p className="text-center">
            <button
              type="button"
              onClick={() => {
                // Keep pendingParse so the user can re-pick a month without
                // re-uploading; suppress auto-advance for the month they backed out of.
                autoAdvancedKeyRef.current = monthKey(year, month);
                setStep("upload");
                setError(null);
                setUploadSummary(null);
                setResolvedMonth(null);
                setBackfillMonths([]);
              }}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              ← Back to upload
            </button>
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col md:flex-row items-start md:items-end justify-end mb-8 gap-6">
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold px-1">
              Month
            </span>
            <select
              value={month}
              disabled={allMonths}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="min-h-11 bg-surface-800 border border-white/10 rounded-lg text-white px-4 py-2.5 focus:ring-wrap-500 focus:border-wrap-500 disabled:opacity-50"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1, 1).toLocaleString("en", { month: "long" })}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold px-1">
              Year
            </span>
            <select
              value={year}
              disabled={allMonths}
              onChange={(e) => setYear(Number(e.target.value))}
              className="min-h-11 bg-surface-800 border border-white/10 rounded-lg text-white px-4 py-2.5 focus:ring-wrap-500 focus:border-wrap-500 disabled:opacity-50"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 cursor-pointer">
            <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold px-1">
              Scope
            </span>
            <span className="min-h-11 flex items-center gap-2 px-1">
              <input
                type="checkbox"
                checked={allMonths}
                disabled={loading}
                onChange={(e) => {
                  setAllMonths(e.target.checked);
                  if (e.target.checked && pendingParse) {
                    void importAllMonthsFromPending();
                  }
                }}
                className="h-4 w-4 accent-wrap-500 disabled:opacity-50"
              />
              <span className="text-sm text-slate-300">All months in file</span>
            </span>
          </label>
        </div>
      </div>

      <UploadZone onFiles={handleFiles} disabled={loading} />

      <div aria-live="polite" role="status">
        {loading && (
          <p className="text-center text-wrap-500 animate-pulse mt-4">
            {parseProgress
              ? `Parsing file ${parseProgress.fileIndex} of ${parseProgress.fileCount}: ${parseProgress.fileName} (${formatBytes(parseProgress.fileSizeBytes)}) — ${parseProgress.stage}…`
              : "Parsing exports…"}
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="text-center text-red-400 bg-red-950/30 rounded-lg p-3 mt-4">
          {error}
        </p>
      )}
      {pendingParse && classifyMonthFilter(pendingParse.conversations, year, month) === "month_mismatch" && (
        <MonthPickerHint
          year={year}
          month={month}
          monthsFound={listMonthsInConversations(pendingParse.conversations).length}
          onTryCurrentMonth={() => void tryMonthFromHint(getCurrentMonth())}
          onTryPreviousMonth={() => void tryMonthFromHint(getPreviousMonth())}
          onImportAllMonths={() => void importAllMonthsFromPending()}
        />
      )}
      {visibleWarnings.length > 0 && (
        <ul className="text-amber-200/80 text-sm space-y-1 bg-amber-950/20 rounded-lg p-3 mt-4">
          {visibleWarnings.map((w, i) => (
            <li key={`${i}-${w}`}>⚠ {w}</li>
          ))}
        </ul>
      )}
    </>
  );
}
