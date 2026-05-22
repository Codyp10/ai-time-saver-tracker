import { useEffect, useState } from "react";
import { UploadZone } from "@/components/UploadZone";
import { SkillQuiz } from "@/components/SkillQuiz";
import { OccupationPrompt } from "@/components/OccupationPrompt";
import { parseUploadFile, filterConversationsByMonth, userFacingError } from "@/parsers";
import type { NormalizedConversation, QuizProfile, SkillLevel } from "@/types/conversation";
import { formatMonthLabel, getPreviousMonth, monthKey } from "@/utils/month";
import { buildMonthlyReport } from "@/engine/aggregate";
import { defaultQuizProfile } from "@/engine/quizProfile";
import { getReport, getSettings, saveReport, saveSettings } from "@/storage/db";
import { brand } from "@/config/brand";

type Step = "upload" | "occupation" | "quiz" | "processing";

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
  const [platforms, setPlatforms] = useState<string[]>([]);
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

  async function handleFiles(files: File[]) {
    setError(null);
    setWarnings([]);
    setLoading(true);
    const all: NormalizedConversation[] = [];
    const detected: string[] = [];

    try {
      for (const file of files) {
        const result = await parseUploadFile(file);
        detected.push(result.platform);
        setWarnings((w) => [...w, ...result.warnings]);
        const filtered = filterConversationsByMonth(result.conversations, year, month);
        all.push(...filtered);
      }

      if (all.length === 0) {
        setError(
          `No conversations found for ${month}/${year}. Try a different month or check your export.`,
        );
        setLoading(false);
        return;
      }

      setParsed(all);
      setPlatforms([...new Set(detected)]);

      const settings = await getSettings();
      setStep(needsOccupationSetup(settings.occupation) ? "occupation" : "quiz");
    } catch (err) {
      setError(userFacingError(err));
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
      window.location.href = `/report/${report.monthKey}`;
    } catch (err) {
      setError(userFacingError(err));
      const settings = await getSettings();
      setStep(needsOccupationSetup(settings.occupation) ? "occupation" : "quiz");
    } finally {
      setLoading(false);
    }
  }

  if (step !== "upload") {
    return (
      <div className="max-w-3xl mx-auto py-12 space-y-10">
        {step === "occupation" && (
          <>
            <p className="text-center text-slate-300">
              Found <strong className="text-white">{parsed.length}</strong> conversations from{" "}
              {platforms.join(", ")} for {month}/{year}.
            </p>
            <OccupationPrompt onSelect={handleOccupationSelect} />
          </>
        )}

        {step === "quiz" && (
          <>
            <p className="text-center text-slate-300">
              Found <strong className="text-white">{parsed.length}</strong> conversations from{" "}
              {platforms.join(", ")} for {month}/{year}.
            </p>
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
            {error && <p className="text-center text-red-400">{error}</p>}
          </>
        )}

        {step === "processing" && (
          <p className="text-center text-wrap-500 text-lg animate-pulse">
            {brand.processingMessage}
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-6">
        <div>
          <h2 className="text-2xl font-bold">Get your wrap</h2>
          <p className="text-text-muted mt-1">Pick the month, then drop your export files.</p>
        </div>
        <div className="flex gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold px-1">
              Month
            </span>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="bg-surface-800 border border-white/10 rounded-lg text-white px-4 py-2 focus:ring-wrap-500 focus:border-wrap-500"
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
              className="bg-surface-800 border border-white/10 rounded-lg text-white px-4 py-2 focus:ring-wrap-500 focus:border-wrap-500"
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
      {warnings.length > 0 && (
        <ul className="text-amber-200/80 text-sm space-y-1 bg-amber-950/20 rounded-lg p-3 mt-4">
          {warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      )}
    </>
  );
}
