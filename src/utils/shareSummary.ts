import { formatHours, topCategory } from "@/engine/aggregate";
import type { AnnualReport } from "@/engine/annual";
import type { MonthlyReport } from "@/types/conversation";
import { formatMonthLabel } from "@/utils/month";
import { brand } from "@/config/brand";

const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  grok: "Grok",
  gemini: "Gemini",
  cursor: "Cursor",
  claude_code: "Claude Code",
};

export function buildShareSummary(report: MonthlyReport): string {
  const { totals } = report;
  const month = formatMonthLabel(report.monthKey);
  const saved = formatHours(totals.minutesSaved);
  const top = topCategory(totals.byCategory).replace(/_/g, " ");
  const platforms = Object.entries(totals.byPlatform)
    .filter(([, mins]) => mins > 0)
    .map(([p]) => PLATFORM_LABELS[p] ?? p)
    .join(" + ");

  return `${brand.sharePrefix} ${month}: ~${saved} saved across ${totals.conversationCount} conversations${platforms ? ` (${platforms})` : ""}. Top task: ${top}. ${brand.shareHashtag}`;
}

export function buildAnnualShareSummary(annual: AnnualReport): string {
  const saved = formatHours(annual.totals.minutesSaved);
  const top = topCategory(annual.totals.byCategory).replace(/_/g, " ");
  const months =
    annual.monthsIncluded === 12
      ? "12 months"
      : `${annual.monthsIncluded} of 12 months`;

  return `${brand.sharePrefix} ${annual.year} Wrapped: ~${saved} saved across ${annual.totals.conversationCount} conversations (${months}). Personality: ${annual.personality.label}. Top platform: ${annual.platformLeader}. Top task: ${top}. ${brand.shareHashtag}`;
}

export function downloadReportJson(report: MonthlyReport, json: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `report-${report.monthKey}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
