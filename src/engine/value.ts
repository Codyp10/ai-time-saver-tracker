export interface OccupationWage {
  id: string;
  label: string;
  hourlyUsd: number;
}

export const OCCUPATIONS: OccupationWage[] = [
  { id: "software", label: "Software developer", hourlyUsd: 58 },
  { id: "manager", label: "General manager", hourlyUsd: 55 },
  { id: "marketing", label: "Marketing specialist", hourlyUsd: 35 },
  { id: "writer", label: "Writer / editor", hourlyUsd: 32 },
  { id: "support", label: "Customer support", hourlyUsd: 22 },
  { id: "teacher", label: "Teacher", hourlyUsd: 28 },
  { id: "analyst", label: "Business analyst", hourlyUsd: 42 },
  { id: "other", label: "Other (US average)", hourlyUsd: 35 },
];

export function minutesToDollars(minutes: number, hourlyRate: number): number {
  return Math.round((minutes / 60) * hourlyRate);
}

export function resolveHourlyRate(
  occupationId?: string,
  override?: number,
): number {
  if (override && override > 0) return override;
  const occ = OCCUPATIONS.find((o) => o.id === occupationId);
  return occ?.hourlyUsd ?? 35;
}

export interface RoiTotals {
  minutesSaved: number;
  minutesSpent: number;
  minutesSavedLow?: number;
  minutesSavedHigh?: number;
}

export interface RoiStats {
  netMinutesSaved: number;
  roiRatio: number | null;
  hourlyRate: number;
  dollarsSaved: number;
  dollarsSavedLow: number;
  dollarsSavedHigh: number;
}

export function computeRoi(
  totals: RoiTotals,
  occupationId?: string,
  hourlyRateOverride?: number,
): RoiStats {
  const hourlyRate = resolveHourlyRate(occupationId, hourlyRateOverride);
  const roiRatio =
    totals.minutesSpent > 0
      ? Math.round((totals.minutesSaved / totals.minutesSpent) * 10) / 10
      : null;
  return {
    netMinutesSaved: Math.round(totals.minutesSaved - totals.minutesSpent),
    roiRatio,
    hourlyRate,
    dollarsSaved: minutesToDollars(totals.minutesSaved, hourlyRate),
    dollarsSavedLow: minutesToDollars(totals.minutesSavedLow ?? totals.minutesSaved, hourlyRate),
    dollarsSavedHigh: minutesToDollars(totals.minutesSavedHigh ?? totals.minutesSaved, hourlyRate),
  };
}
