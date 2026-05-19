# ZIP-Upload "AI Time Saved" SaaS: Export Schemas + Time-Saved Methodology

## Executive Summary

Given what's actually extractable from major AI platforms' user-initiated exports — and the published productivity research — the most credible v1 calculation model is a **hybrid LLM-classifier + per-task-type minutes-saved multiplier**, calibrated to a named study for each task category, adjusted by a user-elicited skill level (Brynjolfsson/Cui novice-vs-expert finding), and presented with explicit confidence bands. ChatGPT, Claude, Grok, and Gemini all ship usable ZIP/JSON exports with timestamps and (in ChatGPT's case) per-message model identifiers; Claude Code is locally readable JSONL; Cursor is a parseable local SQLite; Perplexity, Microsoft Copilot, Meta AI, GitHub Copilot, Poe, and Character.ai are partial or unviable for an upload flow and should be treated as v2 or excluded. For per-message time saved, use cheap LLM-as-judge classification (gpt-4o-mini / Claude Haiku) into a fixed taxonomy whose per-task minutes-saved values come from named studies (Noy & Zhang for writing, Peng et al. + Cui et al. for coding, Jaffe et al. for email, Brynjolfsson/Li/Raymond for support, Dell'Acqua et al. for analytic/consulting), with a global skill-level multiplier from the same studies (~2× novice vs. expert). Cap the headline number with an honest uncertainty band, surface the methodology, and include a counter-evidence disclosure citing METR's 19% slowdown for experienced devs and the Kosmyna/MIT-Media-Lab cognitive-debt preprint — that honesty is what differentiates this product from "AI math" marketing.

---

## AREA 1 — Export File Structures

### 1. ChatGPT (OpenAI) — **viable, highest priority**

**Export path:** Settings → Data Controls → Export Data → "Confirm export." OpenAI emails a download link (typically minutes for normal users; up to a few hours under queue). Link is in an email and expires.

**File format:** ZIP archive containing:
- `conversations.json` — full message history as a single JSON array
- `chat.html` — browser-readable rendering of the same data
- `user.json` — account metadata
- `message_feedback.json` — thumbs up/down feedback events
- `model_comparisons.json` — sometimes present (A/B feedback)
- `shared_conversations.json` — list of any shared chat links

**Schema:** Each item in `conversations.json` is a conversation object with `id`, `title`, `create_time` (Unix epoch, e.g., `1678015311.655875`), `update_time`, and a `mapping` field that is a **DAG of message nodes** keyed by message UUID. To linearize, **iterate every node in `mapping` and sort by `create_time`** — root-to-leaf traversal misses forked/edited branches. Each message node:

```json
{
  "id": "5c48fa3e-e4ee-4d00-aa66-8fbcb671a358",
  "message": {
    "id": "...",
    "author": { "role": "user|assistant|system|tool", "metadata": {} },
    "create_time": 1678015311.656259,
    "content": { "content_type": "text|multimodal_text|code|tether_quote", "parts": [...] },
    "metadata": {
      "model_slug": "gpt-4o", "default_model_slug": "...",
      "request_id": "...", "timestamp_": "absolute",
      "finish_details": {...}, "is_visually_hidden_from_conversation": false
    },
    "end_turn": true, "weight": 1, "recipient": "all"
  },
  "parent": "...", "children": ["..."]
}
```

**Extractable per message:** timestamp, role, model used (`metadata.model_slug` — e.g. `gpt-4o`, `o3`, `gpt-4-turbo-2024-04-09`), content parts (text + DALL·E image refs + tool/function call traces), recipient (for tool calls), conversation title. **Voice-mode** messages appear with `content_type: "multimodal_text"` or `audio_transcript`, distinguishable from text turns. **Custom GPTs** show as `gizmo_id` in conversation metadata.

**Missing:** No explicit token counts; no cost; no "thinking time" for o-series reasoning models (only message timestamps). Memory bank entries are not in the export. Tool outputs are included but image bytes are stored as DALL·E reference IDs, not embedded images.

**Volume:** A heavy daily user (1–2 yrs of use) typically generates a 5–200 MB `conversations.json`. One blogged case (Scott Logic, July 2025) was a 9.1 MB single-line file; multi-GB archives are reported for power users with image generation history.

**Freshness:** Each export is a full historical dump; OpenAI deduplicates by conversation UUID, so incremental ingestion is straightforward server-side (track last-seen `update_time` per conversation ID).

**Recent changes:** Timestamps occasionally come back as 0 / Unix epoch (1970-01-01) for older messages — handle defensively. The `mapping` DAG format has been stable since 2023 but `metadata.model_slug` only appears reliably for messages sent after ~mid-2023.

**Open-source parsers:** `pionxzh/chatgpt-exporter` (userscript), `abacaj/chatgpt-backup`, `ryanschiang/chatgpt-export`, `chatgpt-to-markdown` (npm). Reference these for parser implementation; the format is simple enough to roll your own.

### 2. Claude (Anthropic) — **viable**

**Export path:** Settings → Privacy → "Export data" (per Anthropic's own Help Center, support.claude.com/en/articles/9450526). Anthropic emails a download link within a few minutes for most users, up to a few hours under queue. Link expires after 24 hours. Available on web app and Claude Desktop; **not** available from iOS/Android. Available to Free, Pro, and Max users; Team/Enterprise users can only export via Primary Owner at the org level.

**File format:** ZIP containing primarily `conversations.json` (JSON array; some references describe a `.jsonl` variant on Claude Code; on consumer Claude it's `.json`). Also `users.json` and `projects.json` in current builds.

**Schema (top-level conversation):**

```json
{
  "uuid": "conv_abc123",
  "name": "Your conversation title",
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "...",
  "account": {"uuid": "..."},
  "chat_messages": [
    {
      "uuid": "...",
      "text": "user/assistant message body",
      "sender": "human|assistant",
      "created_at": "...",
      "updated_at": "...",
      "attachments": [...],
      "files": [...],
      "content": [{"type": "text|tool_use|tool_result", "text": "..."}]
    }
  ]
}
```

**Extractable:** ISO-8601 timestamps, sender role, message text, attachments (filenames + extracted text where applicable), conversation name, project association where embedded.

**Missing — critical for this product:**
- **No model per message** — Anthropic does not stamp the export with which Claude variant (Opus / Sonnet / Haiku, version 3/3.5/4/4.5) generated each turn. This is the single biggest gap vs. ChatGPT.
- **No token counts.**
- **Project metadata is embedded but project structure (knowledge files) may not be preserved** — per Amit Kothari's May 2026 analysis ("No 'Export Project' button. No API endpoint."), and Anthropic's own Help Center: "Messages, files, and projects deleted from your account … will not be included in data exports initiated after the deletion."
- **Artifacts** are inlined as content blocks but no separate "artifact" type field — they appear as code/text content.
- Branches (edited messages) are not preserved in the default ZIP — the unofficial endpoint `/api/organizations/{org}/chat_conversations/{id}?tree=True` returns the full tree but the consumer ZIP flattens it. A community bookmarklet (Emnolope/claude-conversation-export) can pull the tree XML.

**Volume:** Smaller than ChatGPT for equivalent usage because Claude tends not to embed images. A heavy user 6–60 MB.

**Freshness:** Full historical dump each time. Deleted conversations are silently absent.

**Open-source parsers:** community viewers like AI Chat Importer (commercial), iLoveAI (free, in-browser, supports both Claude and ChatGPT), `Emnolope/claude-conversation-export` for full-tree XML.

### 3. Gemini (Google) — **viable but awkward**

**Export path:** Google Takeout (`takeout.google.com`) → **Deselect all** → expand **"My Activity"** → "All activity data included" → Deselect all → check **"Gemini Apps"** → Next step. Choose JSON (HTML is also offered; JSON is the parseable option). Email delivery, same day to ~24 h for most users.

**Critical gotcha:** Selecting "Gemini" at the top level only exports **Gemini Gems** (your custom Gems' configuration) — not your chat history. The chat history is under **My Activity → Gemini Apps**. This is the most common point of failure and worth surfacing in product onboarding.

**File format:** ZIP with a `Takeout/My Activity/Gemini Apps/MyActivity.json` (or `.html`) file plus uploaded files in a sibling directory.

**Schema:** Each entry is an activity event:
```json
{
  "header": "Gemini Apps",
  "title": "Asked: <your prompt>",
  "time": "2024-09-23T08:14:30.123Z",
  "products": ["Gemini Apps"],
  "subtitles": [...],
  "details": [...]
}
```
Plus a follow-on entry per Gemini response. The structure is **flat activity log** rather than threaded conversation — joining prompts to responses requires sequencing by timestamp and inferring threads.

**Missing:** No explicit model selection per turn (1.5 Pro vs 2.5 Pro vs Flash); no token counts; thread grouping is heuristic; conversations from before Gemini Apps Activity was enabled are unrecoverable. Uploaded files appear in a separate folder but linkage back to specific prompts is fragile.

**Volume:** Generally compact — a heavy user, low tens of MB.

**Freshness:** Takeout supports recurring exports (every 2 months, up to 1 year). Each export is full.

**Open-source parser:** `minipoisson/Gemini_Json2md4NotebookLM` (Python, splits MyActivity.json into Markdown).

### 4. Grok (xAI) — **viable**

**Export path:** `accounts.x.ai/data` → "Download account data" → Download. Email-delivered download link, minutes to a couple of hours processing.

**File format:** Single `.json` inside a ZIP. Unlike ChatGPT's multi-file archive, Grok's export is one JSON file. No HTML companion.

**Schema:** Each item is a conversation with prompts, Grok responses, and timestamps. Grok-specific modes (Think Mode reasoning, DeepSearch citations, Fun Mode) are reflected in content but not as explicit type tags in the published export.

**Missing:** No model variant per message (Grok 3 / Grok 4 / mini); no token counts; private chats started while not signed in are auto-deleted after 30 days and never appear in exports.

**Volume:** Small to moderate.

**Freshness:** Full each time. Deleted-but-recoverable chats live for 30 days in xAI's "Recently Deleted" before purge.

**Open-source parsers:** `Enhanced Grok Export` (Greasy Fork userscript) handles in-app exports; `AI Chat Importer` supports the xAI JSON format directly. No widely adopted CLI yet.

### 5. Cursor — **local SQLite, parse client-side**

**Export path:** No web upload. Cursor stores all chat data **locally** in SQLite. There is no built-in user "export" — the product should ship a small native helper (or a documented shell script) that reads the DBs and uploads parsed JSON.

**Storage layout (macOS):**
- Global DB: `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`
- Per-workspace: `~/Library/Application Support/Cursor/User/workspaceStorage/<hash>/state.vscdb` plus `workspace.json` mapping the hash to a real project path
- Newer builds (2025+): `~/.cursor/chats/` containing `store.db` SQLite files (one per session) — ~280 MB on heavy users
- AI attribution: `~/.cursor/ai-tracking/ai-code-tracking.db`

**Schema:** Inside `state.vscdb`'s `cursorDiskKV` table, rows follow:
- `composerData:<composerId>` → session metadata (JSON value), keys include `_v` (version, currently 3), `richText`, `conversation`, `context`
- `bubbleId:<composerId>:<bubbleId>` → individual message JSON: user text, assistant response, tool calls, diffs, optional "thinking" reasoning blocks, timestamps
- `agentKv:blob:*` → request-level message blobs (32,000+ on one heavy user's machine, per vibe-replay's deep-dive), include injected context wrappers like `<open_and_recently_viewed_files>`

Plus the newer `~/.cursor/chats/<hash>/store.db` files which include `lastUsedModel` (e.g., `gpt-5.4-high`, `claude-4.5-sonnet`) at session granularity.

**Extractable:** Per-message timestamps, model used (per session — better than nothing), tool/diff traces, file paths the agent touched, sometimes commit attribution.

**Missing:** No first-party docs, format has churned 3+ times. Schema is technically not stable.

**Volume:** **Substantial** — 2–7 GB on disk for active multi-month users. Upload UX must be a local helper, not a browser file picker.

**Security caveat:** State is stored in plaintext SQLite with no OS keychain protection. Surface this to users.

**Open source:** `cursor-history` and `cursor-history-mcp` (CLI + MCP server) are the gold-standard parsers. `S2thend/cursor-history` ships full documentation of the storage model.

### 6. GitHub Copilot — **not viable for individual export**

**Verdict: Skip in v1.** There is no first-party, server-side export of Copilot Chat history for individual (Free / Pro / Pro+) users.

- **GitHub's user data export** (Settings → "Request archive," per docs.github.com/en/get-started/archiving-your-github-personal-account-and-public-repositories/requesting-an-archive-of-your-personal-accounts-data) includes "profile data, plan, email addresses … issues, pull requests, comments, reviews, releases, projects, events, attachments, milestones, and settings for each of your repositories" — **Copilot Chat is not listed.**
- **Copilot Business privacy statement** (docs.github.com/en/site-policy/privacy-policies/github-copilot-business-privacy-statement): "Prompts are discarded once a suggestion is returned. Suggestions are not retained by GitHub."
- **github.com Copilot Chat conversations are auto-deleted after ~30 days.** Community discussion #156605 is the long-standing feature request.
- **In-IDE Copilot Chat (VS Code)** stores sessions locally at `workspaceStorage/<hash>/chatSessions/*.json`. The VS Code Command Palette has `Chat: Export Chat…` / `Chat: Import Chat…` — but per-session, not account-wide.
- **Copilot CLI** uses `--resume` and `/chronicle` against local session files.
- Enterprise metrics require **org/enterprise admin** permissions; not self-serve.

**Recommendation:** Ship a local CLI helper that scrapes the VS Code `chatSessions/*.json` directory the same way the Cursor importer does. Frame it as "Copilot (IDE only) — local files."

### 7. Perplexity — **partial / extension-dependent**

**Export path:** No first-party account-wide export. Native UI offers per-thread "Export → PDF" on a thread basis. Bulk export is via Chrome extensions (Perplexity Thread Exporter, Perplexity-to-Notion-Batch-Export) that scrape the rendered library.

**Format from extensions:** JSON + Markdown per thread. Schema is community-defined, not official.

**Extractable:** Question, answer text, sources (citations, often with titles + URLs), related questions, timestamps (best-effort), Spaces grouping.

**Missing:** No first-party export = no guarantees. Model variant (Sonar, GPT-4o, Claude on Perplexity Pro) is not consistently exposed. Library structure varies.

**Recommendation:** v2. Accept Markdown ZIP from the most popular extension format and treat it as a best-effort source.

### 8. Microsoft Copilot (consumer, formerly Bing Chat) — **partial / low-fidelity**

**Export path:** Per Microsoft Support (support.microsoft.com/en-us/topic/manage-your-copilot-activity-history-in-the-privacy-dashboard-2acfee74-d7c4-406d-b3fb-5f73da9272fc): `account.microsoft.com/privacy` → Privacy → Empower your productivity → Copilot → "Your Copilot app activity history" → **"Export all activity history"** → CSV download.

**File format:** CSV. Columns include timestamp, conversation ID, prompt, and a **truncated response summary**.

**Critical issue:** Multiple independent reports (and David Orban's verified writeup on X) confirm the export **truncates assistant responses** to ~100 characters: "Hello there! I'm Microsoft Copilot, your AI companion. I'm here to help with all kinds of tasks, fro…" — effectively useless for content analysis. Microsoft removed the per-conversation Word/PDF export in the new native Copilot app (per the Microsoft Q&A thread).

**Recommendation:** Use only for *count of interactions* and timestamps, not for content. v2 priority.

### 9. Meta AI — **viable but small ROI**

**Export path** (per meta.com/help/artificial-intelligence/1314808549771571): Meta AI app → Menu → Settings → Data & Privacy → Manage your information → **Download your information** → Export your information → Create export → choose external service or download. Alternatively via Facebook Accounts Center → "Download chat history with AIs."

**File format:** ZIP containing JSON or HTML chat logs (chosen at export time). Available for 4 days in the Available downloads section after generation.

**Extractable:** Prompts, responses, timestamps, attached media.

**Missing:** No model variant per turn (Llama 3 / Llama 4); no per-message metadata; vibes (image gen) tracked separately.

**Volume:** Generally small; most users use Meta AI conversationally rather than for work tasks.

**Recommendation:** Support in v2 once the format is verified, but expect low ROI relative to ChatGPT/Claude.

### 10. Claude Code (CLI) — **fully parseable locally**

**Storage:** `~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl` on macOS/Linux; `%USERPROFILE%\.claude\projects\` on Windows. Encoded cwd replaces `/` and `.` with `-`. Also a global `~/.claude/history.jsonl` logging every prompt across all sessions.

**Format:** JSONL (one JSON object per line). Each line is a discrete event:
- `type: "user"` — user message
- `type: "assistant"` — assistant response, with `message.content[]` array of blocks (`text`, `thinking`, `tool_use`, `tool_result`)
- `type: "summary"` — auto-generated session summary
- Other types for compaction boundaries, hook output, file snapshots, subagent coordination

**Extractable per session:** Working directory, git branch, timestamps, exact tool calls (Bash commands, file reads/edits, search), assistant text, thinking blocks, **token usage** (`message.usage` includes `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`) — **this is the only consumer-facing AI export that gives reliable token counts.**

**Missing:** Model variant is mentioned at session start (`lastUsedModel`) but not necessarily stamped on every message — depends on Claude Code version. Older sessions may be trimmed/compacted over time.

**Volume:** Heavy users see hundreds of MB across `~/.claude/projects/`. Default 30-day cleanup behavior is documented.

**Open-source parsers:** `simonw/claude-code-transcripts`, `withLinda/claude-JSONL-browser`, `daaain/claude-code-log` — all production-quality.

**Recommendation:** First-class support via a local helper CLI (analogous to Cursor). The data is the richest of any source.

### 11. Poe (Quora) — **not viable**

Per David Orban's data-portability writeup and corroborating coverage: Poe does not offer a self-serve data export and lacks a clear data-request workflow (a probable CCPA/GDPR compliance issue). **Skip.** The only paths are per-conversation copy/paste or community scrapers, neither suitable for a SaaS upload flow.

### 12. Character.ai — **not viable for the time-saved framing**

Character.ai's use case is roleplay/companionship; "time saved" is not a meaningful framing for the platform. Skip.

---

## AREA 2 — Time-Saved Methodology

### Headline study comparison

| Study | Sample | Task | Productivity gain | Skill-level finding | Citation |
|---|---|---|---|---|---|
| Brynjolfsson, Li, Raymond — "Generative AI at Work," *Quarterly Journal of Economics* vol. 140 (May 2025), pp. 889–942 | 5,172 customer-support agents | Live customer service | **+15% issues/hour** (14% in earlier draft) | Novices/low-skilled +35%; experienced workers near zero; top performers show small declines in quality | doi.org/10.1093/qje/qjae044 |
| Noy & Zhang, *Science* (2023) | 453 college-educated professionals | Mid-level professional writing | **−40% time, +18% quality** (0.8 SD speed, 0.4 SD quality) | Low-ability workers benefit more; productivity inequality compresses | doi.org/10.1126/science.adh2586 |
| Peng, Kalliamvakou, Cihon, Demirer (arXiv 2302.06590, 2023) | 95 developers, JS HTTP-server task | Greenfield coding (one well-defined task) | **−55.8% time** (1h11m vs 2h41m; 95% CI 21%–89%) | Less-experienced developers benefit most | arxiv.org/abs/2302.06590 |
| Cui, Demirer, Jaffe, Musolff, Peng, Salz, *Management Science* (2026), doi 10.1287/mnsc.2025.00535 | 4,867 devs across Microsoft, Accenture, anonymized F100 | Real-world repo work, GitHub Copilot | **+26.08% completed tasks/week** (SE 10.3%) | Junior devs +27–39%; senior +8–13% | pubsonline.informs.org/doi/10.1287/mnsc.2025.00535 |
| Dell'Acqua et al., HBS/BCG (SSRN 4573321, 2023) | 758 BCG consultants | 18 realistic consulting tasks | **+12.2% tasks done, −25.1% time, +40% quality** inside frontier; **−19% accuracy** outside frontier | Below-average +43%, above-average +17% | ssrn.com/abstract=4573321 |
| Becker, Rush, Barnes, Rein — METR, "Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity" (arXiv 2507.09089, July 2025) | 16 experienced OSS devs, 246 tasks | Work on their own mature repos (Cursor + Claude 3.5/3.7 Sonnet) | **+19% time (slowdown)**; devs *believed* −20% | Counterevidence: experienced experts on mature code can be slower | arxiv.org/abs/2507.09089 |
| Anthropic Economic Index "Primitives" report (Jan 2026) | Millions of Claude.ai + API conversations | All Claude tasks | **~9× speedup** on high-school-level prompts, **~12× on college-level**; API task horizon ~3.5 hrs human-equivalent, Claude.ai ~19 hrs | Complex tasks see bigger speedups but lower success rates; **52% augmentation / 45% automation** on Claude.ai Nov 2025 | anthropic.com/research/economic-index-primitives |
| Jaffe et al., "Generative AI in Real-World Workplaces" (Microsoft, 2024) + Dillon et al., "Early Impacts of M365 Copilot" (arXiv 2504.11443, 2025) | ~6,000 workers, 56 firms (RCT) | Email | **−31% reading time / 50 min/week**; total email workload **−25% (~3 hrs/week)** | Effects vary; perceived savings often exceed measured | arxiv.org/html/2504.11443v1 |
| Plitt & Masselot (Autodesk, 2010); Macken et al. (EC DGT, *Informatics* 2020) | 9 lang pairs / 20 EC translators | MT post-editing | **+74% throughput / −43% time** (Autodesk); **+24% productivity** (EC DGT) | Varies by language pair (50–140% range) | mdpi.com/2227-9709/7/2/12 |
| Slack internal pilot, March 2024 (slack.com/blog/news/work-faster-and-smarter-with-slack-ai) | Slack AI pilot customers (size not disclosed); separate Slack Workforce Lab survey of 5,156 desk workers across AU/FR/DE/JP/UK/US | Self-reported across desk work | **"Businesses … saving an average of 97 minutes per user each week, according to an internal analysis of our pilot customers"** | Self-report (vendor) | slack.com/blog/news/work-faster-and-smarter-with-slack-ai |
| Walton Family Foundation–Gallup, "Teaching for Tomorrow: Unlocking Six Weeks a Year With AI" (June 25, 2025; RAND American Teacher Panel, fielded Mar 18–Apr 11, 2025) | 2,232 K-12 teachers | Self-reported | **"Teachers who use AI tools at least weekly save an average of 5.9 hours per week — amounting to six weeks over the course of the school year"** | Self-report | news.gallup.com/poll/691967 |
| Bick, Blandin, Deming — "The Rapid Adoption of Generative AI," Federal Reserve Bank of St. Louis Working Paper 2024-027C (rev. Feb 2025) | US representative survey | Self-reported across knowledge work | **~5.4% of weekly hours ≈ 2.2 hrs/40-hr week**; Fed blog estimates aggregate impact of "0.1% to 0.9%" labor-productivity growth | Conservative population-weighted | stlouisfed.org/on-the-economy/2025/feb/impact-generative-ai-work-productivity |
| Kosmyna et al., "Your Brain on ChatGPT: Accumulation of Cognitive Debt …" (MIT Media Lab arXiv 2506.08872, 2025; **preprint, not peer-reviewed**) | 54 EEG subjects | Essay writing | LLM users showed **weakest brain connectivity**; "accumulation of cognitive debt" warning; rebutted in commentary arXiv 2601.00856 | Counterevidence on quality / skill retention | arxiv.org/abs/2506.08872 |
| Lee, Sarkar, Tankelevitch et al. (Microsoft + CMU, CHI 2025) | 319 knowledge workers, survey | Critical-thinking self-assessment | "Deterioration of cognitive faculties that ought to be preserved" reported among frequent users | Counterevidence | itpro.com/technology/artificial-intelligence (Microsoft Research summary) |

### Per-task-type time-saved table for v1 calibration

| Task category | Time saved | Source |
|---|---|---|
| **Writing (emails, blog, reports, marketing copy)** | **−40% time** vs baseline | Noy & Zhang 2023 |
| **Email reading/triage specifically** | **−31% reading time, 50 min/week** | Jaffe et al. 2024 |
| **Email response/composition** | **~25% workload reduction, ~3 hrs/week** | Dillon et al. 2025 |
| **Greenfield/boilerplate coding** | **−55.8% time** (single task, controlled) | Peng et al. 2023 |
| **Real-world coding (mixed)** | **+26% tasks/week** (novices +27–39%, seniors +8–13%) | Cui et al. 2026 |
| **Coding on mature personal repos (expert)** | **+19% time (slower)** — use as ceiling / counter-evidence | METR 2025 |
| **Customer support / chat responses** | **+15% issues/hour** (novices +35%) | Brynjolfsson/Li/Raymond 2025 |
| **Consulting-style analysis (inside frontier)** | **−25.1% time, +40% quality** | Dell'Acqua et al. 2023 |
| **Translation / post-editing** | **−24% to −43% time** depending on language pair | Macken et al. 2020 / Plitt & Masselot 2010 |
| **Meeting summarization / catch-up** | **"11 minutes a day adds up to 10 hours saved" over 11 weeks** in Microsoft Copilot for M365 study (n=1,300 across diverse industries, Microsoft CEE News Center, Apr 29 2024); **10–18 min saved per meeting** (Cisco Webex AI Assistant, 2024–25) | Microsoft 2024 / Cisco 2024–25 |
| **Research / summarization / brainstorming** | Best proxied via Anthropic's college-level prompts **~12× speedup** with explicit success-rate discount | Anthropic Economic Index Jan 2026 |
| **Image generation (one-off marketing image)** | **30–60 min saved** vs DIY designer comp (industry rule of thumb; no peer-reviewed study) | — flag as estimate |
| **Learning/explanation** | Treat as a portion of writing/research baseline; no clean single benchmark | — |

### Skill-level adjustment factors

The consistent finding across Brynjolfsson/Li/Raymond, Noy & Zhang, Cui et al., and Dell'Acqua et al. is that **novices benefit roughly 2–3× as much as experts** in absolute productivity terms:

- **Brynjolfsson/Li/Raymond:** novices +35%, experienced workers near 0%.
- **Cui et al.:** junior devs +27–39%, senior devs +8–13% (≈2.5× ratio).
- **Dell'Acqua et al.:** below-average +43%, above-average +17% (≈2.5× ratio).
- **METR:** experienced devs on mature personal projects are actually *slower* with AI — a true negative.

**Practical product implementation — three-question persona quiz:**
1. "How long have you been doing this kind of work professionally?" (<2 yrs / 2–5 / 5+)
2. "How familiar are you with the topic of most prompts you send?" (Novice / Intermediate / Expert)
3. "On a typical task, do you accept AI output mostly as-is, edit substantially, or treat it as a draft to rewrite?"

Map to a multiplier:
- Novice → ×1.5 of the published mean
- Intermediate → ×1.0
- Expert → ×0.6
- Expert + mature-codebase coding → **×0.4 with explicit "verify carefully" tooltip**, citing METR.

### Conversation → time-saved conversion: the recommended method

Four options to consider:

1. **LLM-as-judge classifier.** Send each conversation (or a sampled subset, with first/last ~2k tokens) to gpt-4o-mini or Claude Haiku with a prompt like *"Classify this conversation into one of {writing, coding, research, support, analysis, translation, meeting_notes, image_gen, learning, brainstorm, other}. Estimate the number of minutes this would have taken without AI assistance, and the minutes it took with AI. Return JSON."* This is exactly the methodology Anthropic uses for the Economic Index ("speedup" = human-alone / human-with-AI). Cost: at gpt-4o-mini ~$0.15/M input, classifying 1,000 conversations of ~2k tokens is ~$0.30. **This is the most defensible single approach** because it's been validated by Anthropic against millions of real conversations.

2. **Length-based heuristic.** `time_saved_minutes = task_category_multiplier × (assistant_output_words / 100)` with multipliers derived from the per-task table. Cheap, transparent, but loses category nuance.

3. **Token-based.** Same as length-based but with tokens from Claude Code's `message.usage` (available only for Claude Code).

4. **Hybrid.** Default to a regex-based "obvious" classifier (`/^(write|draft|compose|email|fix bug|debug|refactor)/` on the user message) for ~60% of conversations that are unambiguous; LLM-classify the remaining 40%. **This is what v1 should ship.**

**Recommended v1 algorithm:**

```
For each conversation in upload:
  1. Determine primary task category via:
     - Regex heuristics on first user message (fast path)
     - If ambiguous: LLM-classify (gpt-4o-mini) the first/last 2k tokens
  2. Determine "session weight" = max(1, log(assistant_words / 200))
       (caps so a 10-word "thanks" turn doesn't get full credit)
  3. baseline_minutes = task_category_table[category].baseline_minutes_per_unit × session_weight
  4. saved_minutes = baseline_minutes × task_category_table[category].time_saved_pct
                   × skill_multiplier[user.skill_level]
                   × (1 if conversation_appears_successful else 0.4)   // success discount
  5. Cap any single conversation at 4 hours saved to prevent outliers
  6. Sum across all conversations for the period
```

Display the result as a single number **with an uncertainty band of ±35%** (this is roughly the 95% CI from the Peng et al. headline study and reasonable as a default).

### Time → dollars

For the dashboard:
- Default to **BLS occupational mean wage data** by self-reported occupation (Bureau of Labor Statistics OEWS series — publicly available; OEWS code-keyed).
- Let users override with their own hourly rate.
- Show two views: "time saved (hours)" and "value (USD)" but always anchor on time. Hours are honest; dollars are a derived storytelling artifact.

**"What you could have done" engagement layer:** Tie to verifiable units — books read at avg 250 wpm × 80,000-word avg book ≈ 5.3 hrs/book; vacation days at 8 hrs each; flights at average flight duration; etc. Keep these as opt-in flourishes rather than the headline.

### Credibility & transparency design

Best practices the product should adopt (paralleling Wakatime, RescueTime, and Stripe Atlas's tax-estimate UX):
- **Methodology page linked from every "saved" number**, naming each study used in the calc.
- **Confidence band** displayed as a subdued range next to the headline (e.g., "≈ 84 hours saved (range: 55–113)").
- **Per-conversation breakdown** the user can click into, showing exactly which study + which task category was used.
- **A "what we can't see" footer** listing the data gaps for each platform (no token counts on Claude, no model on Gemini, response truncation on Microsoft Copilot, etc.).
- **Counter-evidence disclosure** — a small but findable section that surfaces METR's slowdown finding and the Kosmyna cognitive-debt preprint, with the framing: "These estimates are speed gains. Quality, learning, and skill retention may move in the opposite direction."

### Counter-evidence and limitations the product must handle honestly

1. **METR 2025**: 16 experienced OSS devs on their own mature repos took **19% longer** with AI, while predicting AI would speed them up by 24% — and *post-hoc* still believing AI sped them up 20%. METR's followup (Feb 2026, metr.org/blog/2026-02-24-uplift-update) had to redesign the experiment because too few devs would now agree to work without AI. → For "expert coder on familiar codebase" personas, the product should *cap* time-saved estimates near zero or surface a "you may be slower with AI" warning.
2. **Dell'Acqua jagged frontier**: For tasks outside AI capability, users were **19% less accurate** — the harm is invisible to a usage-export-based tool because the user can't tell. Disclose.
3. **Cambon et al. (Microsoft, 2023)**: In Teams meeting summarization, Copilot users were much faster but their summaries "included fewer key points than human-written ones." Time saved ≠ quality preserved.
4. **Jaffe et al. (Microsoft, 2024)** explicit caveat: *"Many studies show perceived time savings from generative AI exceeding actual time savings, suggesting an unmeasured element related to potential reduced effort or greater enjoyment."* → The product's own self-reported quizzes should be weighted accordingly.
5. **Kosmyna et al. (MIT Media Lab, 2025 preprint)**: EEG study (n=54) found LLM users had the weakest brain connectivity vs Search Engine and Brain-Only groups; authors warn of "accumulation of cognitive debt." Preprint, not peer-reviewed, and a published commentary (arXiv 2601.00856) disputes the methodology — but worth surfacing.
6. **Lee, Sarkar, Tankelevitch et al. (CHI 2025, n=319)**: Critical-thinking skills "deteriorated among frequent users."

---

## Recommended v1 calculation model (concrete, shippable)

```python
# Per conversation
TASK_TABLE = {
    "writing":       {"baseline_min_per_100w": 4.0, "savings_pct": 0.40, "study": "Noy & Zhang, Science 2023"},
    "email":         {"baseline_min_per_100w": 2.5, "savings_pct": 0.31, "study": "Jaffe et al., Microsoft 2024"},
    "coding":        {"baseline_min_per_100w": 5.0, "savings_pct": 0.26, "study": "Cui et al., Mgmt Science 2026"},
    "support":       {"baseline_min_per_100w": 3.0, "savings_pct": 0.15, "study": "Brynjolfsson/Li/Raymond, QJE 2025"},
    "analysis":      {"baseline_min_per_100w": 5.5, "savings_pct": 0.25, "study": "Dell'Acqua et al., HBS/BCG 2023"},
    "translation":   {"baseline_min_per_100w": 4.0, "savings_pct": 0.30, "study": "Macken et al., EC DGT 2020"},
    "research":      {"baseline_min_per_100w": 4.5, "savings_pct": 0.40, "study": "Noy & Zhang 2023 (writing proxy)"},
    "meeting_notes": {"baseline_min_per_meeting": 15, "savings_pct": 0.67, "study": "Cisco Webex AI 2024"},
    "brainstorm":    {"baseline_min_per_100w": 3.5, "savings_pct": 0.30, "study": "Dell'Acqua et al. 2023 (centaur)"},
    "image_gen":     {"baseline_min_per_image": 45, "savings_pct": 0.80, "study": "industry estimate — flagged"},
    "learning":      {"baseline_min_per_100w": 4.0, "savings_pct": 0.25, "study": "weighted average"},
    "other":         {"baseline_min_per_100w": 3.0, "savings_pct": 0.15, "study": "conservative default"},
}

SKILL_MULT = {"novice": 1.5, "intermediate": 1.0, "expert": 0.6, "expert_mature_code": 0.4}

def time_saved(conv, user_skill):
    cat = classify(conv)            # regex first, gpt-4o-mini fallback
    assistant_words = sum(words(m) for m in conv.messages if m.role == "assistant")
    if cat == "meeting_notes":
        units = max(1, conv.attached_meeting_count or 1)
        baseline = TASK_TABLE[cat]["baseline_min_per_meeting"] * units
    elif cat == "image_gen":
        units = count_image_outputs(conv)
        baseline = TASK_TABLE[cat]["baseline_min_per_image"] * units
    else:
        baseline = TASK_TABLE[cat]["baseline_min_per_100w"] * (assistant_words / 100)
    saved = baseline * TASK_TABLE[cat]["savings_pct"] * SKILL_MULT[user_skill]
    if not conv_appears_successful(conv):
        saved *= 0.4   # success discount
    return min(saved, 240)          # cap one conv at 4 hours
```

Aggregate across all conversations in the upload, display with ±35% band, link each task category to its citation, and surface the counter-evidence in a "Caveats" panel.

---

## TL;DR

- **Three** of the twelve targeted platforms (ChatGPT, Claude, Grok) have clean first-party ZIP exports usable in a web upload flow; **two** more (Gemini via Takeout, Meta AI) work with caveats; **two** are local-only and need a helper app (Cursor, Claude Code); **five** are partial-to-unviable (GitHub Copilot, Perplexity, Microsoft Copilot, Poe, Character.ai) — ship v1 around the first five and frame the rest honestly.
- **Ship a hybrid regex+LLM-classifier methodology** that maps each conversation to one of ~12 task categories, applies a named-study time-saved multiplier (Noy & Zhang 40% for writing, Cui et al. 26% for real-world coding, Brynjolfsson/Li/Raymond 15% for support, Dell'Acqua et al. 25% for analysis, Jaffe et al. 31% for email, Macken et al. 24–43% for translation), and scales by a 3-question skill-level multiplier (~1.5× novice / 1.0× intermediate / 0.4–0.6× expert) — backed by the consistent novice-benefits-more finding across all five major RCTs.
- **Win on credibility, not the headline number.** Default to BLS wages for dollarization, display a ±35% band, link every datapoint to its source study, and explicitly surface METR's 19% slowdown finding for experienced devs and the Kosmyna/MIT cognitive-debt preprint — that's the honest framing competitors are afraid to ship and it's the moat.

---

## Recommendations (staged, with thresholds)

**Phase 1 (week 0–6): "Wrapped" MVP, free tier only.**
- Support ChatGPT and Claude ZIP uploads only.
- Run the hybrid regex+LLM classifier; show the user a 6-card Wrapped recap (most-used hour, top task type, model mix where available, estimated hours saved with a ±35% band, top 3 conversations by saved time, a "you would have read N books" delight card).
- Skill quiz before showing the headline; default to "intermediate" if skipped.
- **Threshold to advance:** if free-to-paid conversion ≥3% and median user uploads ≥30 conversations, build Phase 2.

**Phase 2 (week 6–12): Ongoing dashboard for paid subs.**
- Add Gemini Takeout and Grok JSON support.
- Add a local helper CLI (Tauri or Electron) for Cursor + Claude Code (this is where the *richest* time-saved signal lives because of full token usage in Claude Code).
- Monthly cumulative dashboard, with per-platform breakdown and a "skill drift" indicator (am I moving from expert→novice on this category over time? — direct from Anthropic's deskilling finding).
- **Threshold to advance:** if monthly churn <7% and "trust this number" survey ≥4.2/5, build Phase 3.

**Phase 3 (week 12+): Team accounts + counter-evidence honesty as a feature.**
- Team upload (anonymized aggregate of N users in a workspace).
- "Calibrate your number" feature: ask the user once a month to self-report 5 specific tasks (with/without AI duration estimates), then fit their personal multiplier on top of the published ones. This is what makes the number theirs.
- Drop the **honest counter-feature**: a "where AI might be slowing you down" report citing METR and Dell'Acqua, identifying expert-on-mature-code sessions specifically — this differentiates from competitors and builds trust.

**Threshold to kill the project:** if median user can't generate ≥10 hrs/month estimated time saved at intermediate skill setting (i.e., upload is too sparse to be meaningful), pivot to a real-time tracker (browser extension + MCP server logging) instead of post-hoc ZIP parsing.

---

## Caveats

- Self-reported time-saved figures (Slack's 97 min/week pilot-customer claim; Gallup-Walton teachers 5.9 hrs/week; Microsoft's "11 min/day → 10 hrs in 11 weeks" n=1,300 study) reliably *overstate* measured time-saved (Jaffe et al. explicit on this). Do not use them as primary multipliers — they're best treated as upper-bound storytelling, with the cleaner academic figure from Bick/Blandin/Deming (~2.2 hrs/40-hr week from a US representative sample) as the conservative anchor.
- The Anthropic Economic Index speedups (9–12×) are based on **Claude's own estimates of human-alone vs human-with-AI duration** and are higher than any RCT in the literature. Useful as upper-bound storytelling; not safe as a default calc parameter.
- Most studies' samples are knowledge workers with college education. Generalization to creative work, manual hybrid roles, or non-English contexts is weak.
- All export schemas are subject to change (ChatGPT's mapping DAG is the most stable; Cursor's SQLite layout has churned 3× in 18 months). Build a schema-version detector and a graceful degradation path.
- The whole concept assumes the AI is *replacing* time the user would otherwise have spent. For genuinely new work the user wouldn't have attempted (e.g., novel image generation), "time saved" framing is misleading — Anthropic's augmentation/automation split (52%/45% on Claude.ai Nov 2025, per Anthropic Jan 2026 Economic Index) suggests roughly half of usage is collaborative iteration that wouldn't have existed otherwise.
- The Kosmyna et al. "Your Brain on ChatGPT" preprint is *not* peer-reviewed and has been critically rebutted (arXiv 2601.00856); cite it for directional honesty, not as established fact.
- Cursor and Claude Code local data is in plaintext on disk with no OS keychain protection — surface this prominently in the helper CLI's onboarding, both for trust and for security-conscious users who may want to redact secrets before upload.