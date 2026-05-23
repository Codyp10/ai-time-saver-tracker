import type { NormalizedConversation, Platform } from "@/types/conversation";
import { parseChatGPTExport } from "./chatgpt";
import { parseClaudeExport } from "./claude";
import { parseClaudeCodeExport, parseClaudeCodeJsonl } from "./claude-code";
import { parseCursorJsonExport, parseCursorSqlite } from "./cursor";
import { parseGrokExport } from "./grok";
import { parseGeminiExport } from "./gemini";
import { ParseError, userFacingError } from "./errors";
import {
  assertBatchUploadSize,
  assertUploadSize,
  readArrayBufferWithLimit,
  readTextWithLimit,
  withTimeout,
} from "@/config/securityLimits";
import { decodeText, extractZip, findEntry, parseJson } from "./zip";
import {
  detectPlatformFromEntries,
  detectPlatformFromJsonFilename,
  detectPlatformFromJsonSample,
} from "./detectPlatform";
import {
  countByPlatform,
  mergeConversations,
  type MergeResult,
} from "./merge";

export { userFacingError, ParseError };
export {
  mergeConversations,
  countByPlatform,
  formatPlatformBreakdown,
  formatUploadSummary,
  PLATFORM_LABELS,
} from "./merge";
export type { MergeResult } from "./merge";

export interface ParseResult {
  platform: Platform;
  conversations: NormalizedConversation[];
  warnings: string[];
}

export interface FileParseOutcome {
  fileName: string;
  success: boolean;
  result?: ParseResult;
  error?: string;
}

export interface MultiParseResult {
  conversations: NormalizedConversation[];
  outcomes: FileParseOutcome[];
  warnings: string[];
  merge: MergeResult;
  filesParsed: number;
  filesFailed: number;
  byPlatform: Partial<Record<Platform, number>>;
}

const LOCAL_FILE_PLATFORMS: Platform[] = ["cursor", "claude_code"];

export async function parseUploadFile(file: File): Promise<ParseResult> {
  return withTimeout(parseUploadFileInner(file), undefined, "Parsing");
}

export async function parseMultipleUploadFiles(files: File[]): Promise<MultiParseResult> {
  assertBatchUploadSize(files);

  const outcomes: FileParseOutcome[] = [];
  const allConversations: NormalizedConversation[] = [];
  const warnings: string[] = [];

  for (const file of files) {
    try {
      const result = await parseUploadFile(file);
      outcomes.push({ fileName: file.name, success: true, result });
      allConversations.push(...result.conversations);
      warnings.push(...result.warnings);
    } catch (err) {
      outcomes.push({
        fileName: file.name,
        success: false,
        error: userFacingError(err),
      });
    }
  }

  const merge = mergeConversations(allConversations);
  const filesParsed = outcomes.filter((o) => o.success).length;
  const filesFailed = outcomes.filter((o) => !o.success).length;

  return {
    conversations: merge.merged,
    outcomes,
    warnings,
    merge,
    filesParsed,
    filesFailed,
    byPlatform: countByPlatform(merge.merged),
  };
}

async function parseUploadFileInner(file: File): Promise<ParseResult> {
  const warnings: string[] = [];
  const name = file.name.toLowerCase();
  assertUploadSize(file);

  if (name.endsWith(".zip")) {
    return parseZipFile(file, warnings);
  }

  if (name.endsWith(".jsonl")) {
    warnings.push("Claude Code sessions are parsed from local JSONL — data stays in your browser.");
    const text = await readTextWithLimit(file);
    return {
      platform: "claude_code",
      conversations: parseClaudeCodeJsonl(text, file.name),
      warnings,
    };
  }

  if (name.endsWith(".db") || name.endsWith(".vscdb")) {
    warnings.push(
      "Cursor databases are parsed locally in your browser. They may contain file paths from your projects.",
    );
    const buffer = new Uint8Array(await readArrayBufferWithLimit(file));
    return {
      platform: "cursor",
      conversations: await parseCursorSqlite(buffer),
      warnings,
    };
  }

  if (name.endsWith(".json")) {
    const text = await readTextWithLimit(file);
    const json = parseJson<unknown>(text);
    const fromName = detectPlatformFromJsonFilename(file.name);
    const fromSample = detectPlatformFromJsonSample(json);

    if (fromName === "claude_code" || fromSample === "claude_code") {
      return {
        platform: "claude_code",
        conversations: parseClaudeCodeExport(json),
        warnings,
      };
    }

    if (fromName === "cursor" || fromSample === "cursor") {
      return {
        platform: "cursor",
        conversations: parseCursorJsonExport(json),
        warnings,
      };
    }

    const platform = fromName ?? fromSample;
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

  throw new ParseError(
    "Please upload a .zip, .json, .jsonl, or Cursor .db / .vscdb file.",
    "UNSUPPORTED_FILE",
  );
}

async function parseZipFile(file: File, warnings: string[]): Promise<ParseResult> {
  const buffer = await readArrayBufferWithLimit(file);
  const entries = await extractZip(buffer);
  let platform = detectPlatformFromEntries(entries);

  if (!platform) {
    throw new ParseError(
      "Could not detect the AI platform. Supported: ChatGPT, Claude, Grok, Gemini Takeout, Claude Code, Cursor.",
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

  if (platform === "claude_code") {
    const jsonlEntry = entries.find((e) => e.path.toLowerCase().endsWith(".jsonl"));
    if (jsonlEntry) {
      warnings.push("Claude Code JSONL parsed from ZIP — sessions grouped by sessionId.");
      return {
        platform: "claude_code",
        conversations: parseClaudeCodeJsonl(decodeText(jsonlEntry.data), jsonlEntry.path),
        warnings,
      };
    }
    const jsonEntry = entries.find((e) => e.path.toLowerCase().endsWith(".json"));
    if (!jsonEntry) {
      throw new ParseError("No JSONL or JSON session file found in ZIP.", "MISSING_FILE");
    }
    const json = parseJson<unknown>(decodeText(jsonEntry.data));
    return {
      platform: "claude_code",
      conversations: parseClaudeCodeExport(json),
      warnings,
    };
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
    case "claude_code":
      return parseClaudeCodeExport(json);
    case "cursor":
      return parseCursorJsonExport(json);
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

export type MonthFilterOutcome = "empty_export" | "month_mismatch" | "matched";

export function classifyMonthFilter(
  conversations: NormalizedConversation[],
  year: number,
  month: number,
): MonthFilterOutcome {
  if (conversations.length === 0) return "empty_export";
  if (filterConversationsByMonth(conversations, year, month).length === 0) {
    return "month_mismatch";
  }
  return "matched";
}

export { LOCAL_FILE_PLATFORMS };
