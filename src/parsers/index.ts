import type { NormalizedConversation, Platform } from "@/types/conversation";
import { parseChatGPTExport } from "./chatgpt";
import { parseClaudeExport } from "./claude";
import { parseGrokExport } from "./grok";
import { parseGeminiExport } from "./gemini";
import { ParseError, userFacingError } from "./errors";
import { decodeText, extractZip, findEntry, parseJson } from "./zip";
import {
  detectPlatformFromEntries,
  detectPlatformFromJsonFilename,
} from "./detectPlatform";

export { userFacingError, ParseError };

export interface ParseResult {
  platform: Platform;
  conversations: NormalizedConversation[];
  warnings: string[];
}

export async function parseUploadFile(file: File): Promise<ParseResult> {
  const warnings: string[] = [];
  const name = file.name.toLowerCase();

  if (name.endsWith(".zip")) {
    return parseZipFile(file, warnings);
  }

  if (name.endsWith(".json")) {
    const text = await file.text();
    const json = parseJson<unknown>(text);
    const platform = detectPlatformFromJsonFilename(file.name);
    if (!platform) {
      const sample = JSON.stringify(json).slice(0, 2000);
      if (sample.includes('"chat_messages"')) {
        return { platform: "claude", conversations: parseClaudeExport(json), warnings };
      }
      if (sample.includes('"mapping"')) {
        return { platform: "chatgpt", conversations: parseChatGPTExport(json), warnings };
      }
      return { platform: "grok", conversations: parseGrokExport(json), warnings };
    }
    return {
      platform,
      conversations: parseByPlatform(platform, json),
      warnings,
    };
  }

  throw new ParseError("Please upload a .zip or .json export file.", "UNSUPPORTED_FILE");
}

async function parseZipFile(file: File, warnings: string[]): Promise<ParseResult> {
  const entries = await extractZip(file);
  let platform = detectPlatformFromEntries(entries);

  if (!platform) {
    throw new ParseError(
      "Could not detect the AI platform. Supported: ChatGPT, Claude, Grok, Gemini Takeout.",
      "UNKNOWN_PLATFORM",
    );
  }

  if (platform === "chatgpt" || platform === "claude") {
    const entry = findEntry(entries, (p) => p.endsWith("conversations.json"));
    if (!entry) {
      throw new ParseError("conversations.json not found in ZIP.", "MISSING_FILE");
    }
    const json = parseJson<unknown>(decodeText(entry.data));
    if (platform === "claude" && !JSON.stringify(json).includes("chat_messages")) {
      const hasMapping = JSON.stringify(json).includes('"mapping"');
      if (hasMapping) platform = "chatgpt";
    }
    return {
      platform,
      conversations: parseByPlatform(platform, json),
      warnings,
    };
  }

  if (platform === "gemini") {
    const entry =
      findEntry(entries, (p) => p.includes("myactivity") && p.endsWith(".json")) ??
      findEntry(entries, (p) => p.includes("gemini") && p.endsWith(".json"));
    if (!entry) {
      throw new ParseError(
        "Gemini MyActivity.json not found. Export via Google Takeout → My Activity → Gemini Apps.",
        "MISSING_FILE",
      );
    }
    warnings.push(
      "Gemini threads are reconstructed from activity log timestamps — counts may be approximate.",
    );
    const json = parseJson<unknown>(decodeText(entry.data));
    return { platform: "gemini", conversations: parseGeminiExport(json), warnings };
  }

  const jsonEntry = entries.find((e) => e.path.toLowerCase().endsWith(".json"));
  if (!jsonEntry) {
    throw new ParseError("No JSON file found in ZIP.", "MISSING_FILE");
  }
  const json = parseJson<unknown>(decodeText(jsonEntry.data));
  return { platform: "grok", conversations: parseGrokExport(json), warnings };
}

function parseByPlatform(platform: Platform, json: unknown): NormalizedConversation[] {
  switch (platform) {
    case "chatgpt":
      return parseChatGPTExport(json);
    case "claude":
      return parseClaudeExport(json);
    case "grok":
      return parseGrokExport(json);
    case "gemini":
      return parseGeminiExport(json);
  }
}

export function filterConversationsByMonth(
  conversations: NormalizedConversation[],
  year: number,
  month: number,
): NormalizedConversation[] {
  return conversations.filter((c) => {
    const d = c.updatedAt;
    return d.getFullYear() === year && d.getMonth() === month - 1;
  });
}
