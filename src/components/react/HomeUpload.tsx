import { useEffect, useState } from "react";
import { UploadZone } from "@/components/UploadZone";
import { MonthPickerHint } from "@/components/MonthPickerHint";
import { SkillQuiz } from "@/components/SkillQuiz";
import { OccupationPrompt } from "@/components/OccupationPrompt";
import {
  parseMultipleUploadFiles,
  filterConversationsByMonth,
  classifyMonthFilter,
  formatUploadSummary,
  userFacingError,
  type MultiParseResult,
} from "@/parsers";
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
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [parsed, setParsed] = useState<NormalizedConversation[]>([]);
  const [uploadSummary, setUploadSummary] = useState<UploadSummary | null>(null);
  const [pendingParse, setPendingParse] = useState<MultiParseResult | null>(null);
  const [defaultSkillLevel, setDefaultSkillLevel] = useState<SkillLevel>("intermediate");

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
      if (failedFiles.length > 0) {
        setWarnings((w) => [
          ...w,
          ...failedFiles.map((f) => `Could not parse "${f.name}": ${f.error}`),
        ]);
      }
      return false;
    }

    const filtered = filterConversationsByMonth(result.conversations, targetYear, targetMonth);
    const byPlatform = countByPlatform(filtered);

    setParsed(filtered);
    setPendingParse(null);
    setUploadSummary({
      text: formatUploadSummary(result.filesParsed, filtered.length, byPlatform),
      filesParsed: result.filesParsed,
      filesFailed: result.filesFailed,
      failedFiles,
      duplicatesRemoved: result.merge.duplicatesRemoved,
      byPlatform,
    });

    if (failedFiles.length > 0) {
      setWarnings((w) => [
        ...w,
        ...failedFiles.map((f) => `Skipped "${f.name}": ${f.error}`),
      ]);
    }

    const settings = await getSettings();
    setStep(needsOccupationSetup(settings.occupation) ? "occupation" : "quiz");
    return true;
  }

  async function handleFiles(files: File[]) {
    setError(null);
    setWarnings([]);
    setUploadSummary(null);
    setPendingParse(null);
    setLoading(true);

    try {
      const result = await parseMultipleUploadFiles(files);
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

      await advanceWithParseResult(result, year, month);
    } catch (err) {
      setError(userFacingError(err));
    } finally {
      setLoading(false);
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

  async function handleOccupationSelect(occupationId: string) {
    const settings = await getSettings();
    await saveSettings({ ...settings, occupation: occupationId });
    setStep("quiz");
  }

  async function finishReport(quizProfile: QuizProfile) {
    setStep("processing");
    setLoading(true);
    setError(null);
    try {
      const key = monthKey(year, month);
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
    }
  }

  function renderSummaryBanner() {
    if (!uploadSummary) return null;

    return (
      <div className="text-center space-y-2">
        <p className="text-slate-300">
          <strong className="text-white">{uploadSummary.text}</strong> for {month}/{year}.
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
            <p className="text-center text-wrap-500 text-lg animate-pulse">
              {brand.processingMessage}
            </p>
            {error && (
              <p className="text-center text-red-400 bg-red-950/30 rounded-lg p-3">{error}</p>
            )}
          </>
        )}

        {step !== "processing" && warnings.length > 0 && (
          <ul className="text-amber-200/80 text-sm space-y-1 bg-amber-950/20 rounded-lg p-3">
            {warnings.map((w, i) => (
              <li key={`${i}-${w}`}>⚠ {w}</li>
            ))}
          </ul>
        )}

        {step !== "processing" && (
          <p className="text-center">
            <button
              type="button"
              onClick={() => {
                setStep("upload");
                setError(null);
                setUploadSummary(null);
                setPendingParse(null);
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
        <div className="flex gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold px-1">
              Month
            </span>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="min-h-11 bg-surface-800 border border-white/10 rounded-lg text-white px-4 py-2.5 focus:ring-wrap-500 focus:border-wrap-500"
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
              onChange={(e) => setYear(Number(e.target.value))}
              className="min-h-11 bg-surface-800 border border-white/10 rounded-lg text-white px-4 py-2.5 focus:ring-wrap-500 focus:border-wrap-500"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <UploadZone onFiles={handleFiles} disabled={loading} />

      {loading && (
        <p className="text-center text-wrap-500 animate-pulse mt-4">Parsing exports…</p>
      )}
      {error && (
        <p className="text-center text-red-400 bg-red-950/30 rounded-lg p-3 mt-4">{error}</p>
      )}
      {pendingParse && classifyMonthFilter(pendingParse.conversations, year, month) === "month_mismatch" && (
        <MonthPickerHint
          year={year}
          month={month}
          onTryCurrentMonth={() => void tryMonthFromHint(getCurrentMonth())}
          onTryPreviousMonth={() => void tryMonthFromHint(getPreviousMonth())}
        />
      )}
      {warnings.length > 0 && (
        <ul className="text-amber-200/80 text-sm space-y-1 bg-amber-950/20 rounded-lg p-3 mt-4">
          {warnings.map((w, i) => (
            <li key={`${i}-${w}`}>⚠ {w}</li>
          ))}
        </ul>
      )}
    </>
  );
}
