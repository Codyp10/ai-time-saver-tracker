# AI Wrapped

Privacy-first monthly wrap of your AI usage. Upload export files from **ChatGPT**, **Claude**, **Grok**, **Gemini (Google Takeout)**, **Claude Code**, or **Cursor** and get estimated time spent and time saved — computed entirely in your browser.

Built with [Astro](https://astro.build/) for HTML-first pages. Marketing content, methodology, and export guides ship as static HTML. Upload, quiz, reports, and settings hydrate as React islands in the browser.

## Privacy

- **No backend.** Your chats and exports are never sent to our servers — we have no servers. Parsing and analysis are 100% client-side.
- Parsing, classification, and calculations run locally in the browser.
- Reports are stored in **IndexedDB** on your device only.
- We use anonymous page-view analytics (Google Tag Manager); your uploaded data is never sent to our servers.
- Optional OpenAI API key (for better classification) stays in local storage; if you enable it, conversation snippets are sent directly from your browser to OpenAI using your own key.

## Supported platforms

| Platform | Export |
|----------|--------|
| ChatGPT | Settings → Data Controls → Export |
| Claude | Settings → Privacy → Export data |
| Grok | [accounts.x.ai/data](https://accounts.x.ai/data) |
| Gemini | Google Takeout → **My Activity → Gemini Apps** (not top-level Gemini) |
| Claude Code | Local `.jsonl` session files (`~/.claude/projects/…`) |
| Cursor | Local `.db` / `.vscdb` chat databases |

See in-app export guides for step-by-step instructions.

## Methodology

Time saved estimates use peer-reviewed multipliers (Noy & Zhang, Cui et al., Brynjolfsson/Li/Raymond, etc.) by task category, adjusted for a short skill quiz. Every number includes a confidence band and links to its source study. See the **Methodology** page in the app.

## Development

```bash
npm install
npm run dev
```

```bash
npm run build
npm test
```

## Print / Save PDF

The report page **Print / Save PDF** action uses the browser print dialog (`window.print()`). Print styles live in `src/index.css` (loaded via `src/styles/global.css`) and preserve the Wrapped dark theme:

- **Background:** `#0a0a0a` with `print-color-adjust: exact` so browsers include background fills
- **Accent:** wrap green (`#00ff41`) on headings, progress bars, saved-time values, and heatmap cells
- **Hidden chrome:** site header/footer, action buttons, sort controls, and marketing CTAs (`.no-print`, `.site-header`, `.site-footer`)
- **Kept content:** wrap hero, stat cards, insights (heatmap, topic mix, forecast), and conversation table
- **Page breaks:** conversation table starts on a new page; third insight card can break to avoid cramped two-up layout

Use **Background graphics** / **Print backgrounds** in the print dialog if your browser still strips fills.

## Deploy

Static build — deploy `dist/` to Vercel, Netlify, or any static host:

```bash
npm run build
```

## Out of scope

- GitHub Copilot, Perplexity, Microsoft Copilot, Poe
- Server accounts or team dashboards

## License

MIT
