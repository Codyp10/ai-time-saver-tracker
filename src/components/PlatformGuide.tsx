import { useState } from "react";

const guides = [
  {
    platform: "ChatGPT",
    steps: [
      "Open ChatGPT → Settings → Data Controls",
      'Click "Export data" → Confirm export',
      "Download the ZIP from the email link when it arrives",
    ],
    url: "https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data",
  },
  {
    platform: "Claude",
    steps: [
      "Open Claude → Settings → Privacy",
      'Click "Export data"',
      "Download the ZIP from the email (expires in 24 hours)",
    ],
    url: "https://support.claude.com/en/articles/9450526-how-do-i-export-my-claude-data",
  },
  {
    platform: "Grok",
    steps: [
      "Go to accounts.x.ai/data",
      'Click "Download account data"',
      "Download the ZIP when the email link arrives",
    ],
    url: "https://accounts.x.ai/data",
  },
  {
    platform: "Gemini (Google Takeout)",
    highlight: true,
    steps: [
      "Go to takeout.google.com → Deselect all",
      'Expand "My Activity" → "All activity data included" → Deselect all',
      'Check only "Gemini Apps" (NOT top-level Gemini — that exports Gems config only)',
      "Choose JSON format → Create export",
    ],
    url: "https://takeout.google.com",
  },
  {
    platform: "Claude Code (local JSONL)",
    steps: [
      "Locate session files at ~/.claude/projects/<project>/<sessionId>.jsonl",
      "Or use the global ~/.claude/history.jsonl log",
      "Upload one or more .jsonl files directly — parsed locally in your browser",
    ],
    url: "https://docs.anthropic.com/en/docs/claude-code",
  },
  {
    platform: "Cursor (local database)",
    steps: [
      "Locate chat data at ~/.cursor/chats/<hash>/store.db (newer builds)",
      "Or ~/Library/Application Support/Cursor/User/globalStorage/state.vscdb (macOS)",
      "Upload the .db or .vscdb file — parsed locally; may include project file paths",
    ],
    url: "https://cursor.com",
  },
];

export function PlatformGuide() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-white">How to export your data</h2>
      {guides.map((g) => (
        <div
          key={g.platform}
          className={`rounded-xl border overflow-hidden ${
            g.highlight ? "border-amber-500/40" : "border-white/10"
          }`}
        >
          <button
            type="button"
            onClick={() => setOpen(open === g.platform ? null : g.platform)}
            className="w-full px-4 py-3 flex justify-between items-center text-left bg-white/5 hover:bg-white/10"
          >
            <span className="font-medium text-white">{g.platform}</span>
            <span className="text-slate-400">{open === g.platform ? "−" : "+"}</span>
          </button>
          {open === g.platform && (
            <div className="px-4 pb-4 pt-1 bg-black/20">
              {g.highlight && (
                <p className="text-amber-200/90 text-sm mb-2">
                  Important: Chat history is under My Activity → Gemini Apps, not
                  the top-level Gemini checkbox.
                </p>
              )}
              <ol className="list-decimal list-inside text-slate-300 text-sm space-y-1">
                {g.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <a
                href={g.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-3 text-brand-400 text-sm hover:underline"
              >
                Official instructions →
              </a>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
