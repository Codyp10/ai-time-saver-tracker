import { formatMonthLabel, monthKey } from "@/utils/month";

interface MonthPickerHintProps {
  year: number;
  month: number;
  onTryCurrentMonth: () => void;
  onTryPreviousMonth: () => void;
}

export function MonthPickerHint({
  year,
  month,
  onTryCurrentMonth,
  onTryPreviousMonth,
}: MonthPickerHintProps) {
  const label = formatMonthLabel(monthKey(year, month));

  return (
    <div className="mt-4 rounded-2xl border border-wrap-500/30 bg-wrap-500/5 p-6 space-y-4">
      <p className="text-center text-slate-300 leading-relaxed">
        No chats found for <strong className="text-white">{label}</strong>. Many exports only
        include recent activity — try the current month or the month you were most active.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          type="button"
          onClick={onTryCurrentMonth}
          className="min-h-11 px-6 py-2.5 rounded-xl bg-wrap-500 hover:bg-wrap-600 text-black font-semibold transition-colors"
        >
          Try current month
        </button>
        <button
          type="button"
          onClick={onTryPreviousMonth}
          className="min-h-11 px-6 py-2.5 rounded-xl border border-wrap-500/40 text-wrap-500 hover:border-wrap-500 hover:bg-wrap-500/10 font-semibold transition-colors"
        >
          Try previous month
        </button>
      </div>
    </div>
  );
}
