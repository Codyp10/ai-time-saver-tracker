# AI Wrapped

Privacy-first monthly wrap of your AI usage. Upload export files from **ChatGPT**, **Claude**, **Grok**, **Gemini (Google Takeout)**, **Claude Code**, or **Cursor** and get estimated time spent and time saved — computed entirely in your browser.

Built with [Astro](https://astro.build/) for HTML-first pages. Marketing content, methodology, and export guides ship as static HTML. Upload, quiz, reports, and settings hydrate as React islands in the browser.

## Privacy

- **No backend.** Your chat exports are never uploaded to any server.
- Parsing, classification, and calculations run locally in the browser.
- Reports are stored in **IndexedDB** on your device only.
- Optional OpenAI API key (for better classification) stays in local storage and calls OpenAI directly from your browser if you enable it.

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
