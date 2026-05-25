import { useState } from "react";
import type { ConversationAnalysis } from "@/types/conversation";

interface ConversationTableProps {
  analyses: ConversationAnalysis[];
}

type SortKey = "saved" | "spent" | "title";

export function ConversationTable({ analyses }: ConversationTableProps) {
  const [sort, setSort] = useState<SortKey>("saved");

  const sorted = [...analyses].sort((a, b) => {
    if (sort === "title")
      return a.conversation.title.localeCompare(b.conversation.title);
    if (sort === "spent") return b.minutesSpent - a.minutesSpent;
    return b.minutesSaved - a.minutesSaved;
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">Conversation breakdown</h2>
        <label className="no-print text-sm text-slate-400 flex items-center gap-2">
          Sort by
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="bg-surface-800 border border-white/10 rounded-lg px-2 py-1 text-white"
          >
            <option value="saved">Time saved</option>
            <option value="spent">Time spent</option>
            <option value="title">Title</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm text-left">
          <thead className="bg-white/5 text-slate-400">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Spent</th>
              <th className="px-4 py-3 text-right">Saved</th>
              <th className="px-4 py-3">Study</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sorted.map((a) => (
              <tr key={a.conversation.id} className="hover:bg-white/5">
                <td className="px-4 py-3 text-white max-w-[200px] truncate">
                  {a.conversation.title}
                </td>
                <td className="px-4 py-3 text-slate-300 capitalize">
                  {a.conversation.platform}
                </td>
                <td className="px-4 py-3 text-slate-300">
                  {a.category.replace("_", " ")}
                  {a.classificationConfidence === "low" && (
                    <span className="text-amber-400/80 text-xs ml-1">~</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-slate-300">
                  {a.minutesSpent.toFixed(1)}m
                </td>
                <td className="px-4 py-3 text-right text-brand-400 font-medium">
                  {a.minutesSaved.toFixed(1)}m
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs max-w-[140px]">
                  {a.study}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
