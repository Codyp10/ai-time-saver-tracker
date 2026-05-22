export const exportGuides = [
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
] as const;
