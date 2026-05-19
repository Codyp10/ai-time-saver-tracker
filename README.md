# AI Time Saver Tracker

Privacy-first monthly wrap of your AI usage. Upload export ZIPs from **ChatGPT**, **Claude**, **Grok**, or **Gemini (Google Takeout)** and get estimated time spent and time saved — computed entirely in your browser.

## Privacy

- **No backend.** Your chat exports are never uploaded to any server.
- Parsing, classification, and calculations run locally in the browser.
- Reports are stored in **IndexedDB** on your device only.
- Optional OpenAI API key (for better classification) stays in local storage and calls OpenAI directly from your browser if you enable it.

## Supported platforms (v1)

| Platform | Export |
|----------|--------|
| ChatGPT | Settings → Data Controls → Export |
| Claude | Settings → Privacy → Export data |
| Grok | [accounts.x.ai/data](https://accounts.x.ai/data) |
| Gemini | Google Takeout → **My Activity → Gemini Apps** (not top-level Gemini) |

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

`vercel.json` includes SPA rewrites for client-side routing.

## Out of scope (v1)

- Cursor / Claude Code (local files — planned for v2)
- GitHub Copilot, Perplexity, Microsoft Copilot, Poe
- Server accounts or team dashboards

## License

MIT
