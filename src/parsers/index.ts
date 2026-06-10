import type { NormalizedConversation, Platform } from "@/types/conversation";
import { parseChatGPTExport } from "./chatgpt";
import { parseClaudeExport, parseClaudeExportAsync } from "./claude";
import { parseClaudeCodeExport, parseClaudeCodeJsonl } from "./claude-code";
import { parseCursorJsonExport, parseCursorSqlite } from "./cursor";
import { parseGrokExport } from "./grok";
import { parseGeminiExport } from "./gemini";
import { ParseError, userFacingError } from "./errors";
import {
  assertBatchUploadSize,
  assertUploadSize,
  computeParseTimeoutMs,
  formatBytes,
  readArrayBufferWithLimit,
  readTextWithLimit,
  withTimeout,
  yieldToEventLoop,
} from "@/config/securityLimits";
import { decodeText, extractZip, findEntry, parseJson } from "./zip";
import {
  detectPlatformFromEntries,
  detectPlatformFromJsonFilename,
  detectPlatformFromJsonSample,
  exportJsonHasChatMessages,
  exportJsonHasMapping,
  resolveConversationsExportPlatform,
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

export interface ParseProgress {
  fileIndex: number;
  fileCount: number;
  fileName: string;
  fileSizeBytes: number;
  stage: string;
}

export async function parseUploadFile(
  file: File,
  onStage?: (stage: string) => void,
): Promise<ParseResult> {
  return withTimeout(
    parseUploadFileInner(file, onStage),
    computeParseTimeoutMs(file.size),
    `Parsing "${file.name}" (${formatBytes(file.size)})`,
  );
}

export async function parseMultipleUploadFiles(
  files: File[],
  onProgress?: (progress: ParseProgress) => void,
): Promise<MultiParseResult> {
  assertBatchUploadSize(files);

  const outcomes: FileParseOutcome[] = [];
  const allConversations: NormalizedConversation[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    try {
      const result = await parseUploadFile(file, (stage) => {
        onProgress?.({
          fileIndex: i + 1,
          fileCount: files.length,
          fileName: file.name,
          fileSizeBytes: file.size,
          stage,
        });
      });
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

async function parseUploadFileInner(
  file: File,
  onStage?: (stage: string) => void,
): Promise<ParseResult> {
  const warnings: string[] = [];
  const name = file.name.toLowerCase();
  assertUploadSize(file);

  if (name.endsWith(".zip")) {
    return parseZipFile(file, warnings, onStage);
  }

  if (name.endsWith(".jsonl")) {
    onStage?.("Reading file");
    warnings.push("Claude Code sessions are parsed from local JSONL — data stays in your browser.");
    const text = await readTextWithLimit(file);
    onStage?.("Parsing conversations");
    return {
      platform: "claude_code",
      conversations: parseClaudeCodeJsonl(text, file.name),
      warnings,
    };
  }

  if (name.endsWith(".db") || name.endsWith(".vscdb")) {
    onStage?.("Reading database");
    warnings.push(
      "Cursor databases are parsed locally in your browser. They may contain file paths from your projects.",
    );
    const buffer = new Uint8Array(await readArrayBufferWithLimit(file));
    onStage?.("Parsing conversations");
    return {
      platform: "cursor",
      conversations: await parseCursorSqlite(buffer),
      warnings,
    };
  }

  if (name.endsWith(".json")) {
    onStage?.("Reading file");
    const text = await readTextWithLimit(file);
    onStage?.("Parsing JSON");
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
      if (exportJsonHasChatMessages(json)) {
        onStage?.("Parsing conversations");
        return { platform: "claude", conversations: await parseClaudeExportAsync(json), warnings };
      }
      if (exportJsonHasMapping(json)) {
        onStage?.("Parsing conversations");
        return { platform: "chatgpt", conversations: parseChatGPTExport(json), warnings };
      }
      onStage?.("Parsing conversations");
      return { platform: "grok", conversations: parseGrokExport(json), warnings };
    }

    onStage?.("Parsing conversations");
    return {
      platform,
      conversations: await parseByPlatform(platform, json),
      warnings,
    };
  }

  throw new ParseError(
    "Please upload a .zip, .json, .jsonl, or Cursor .db / .vscdb file.",
    "UNSUPPORTED_FILE",
  );
}

async function parseZipFile(
  file: File,
  warnings: string[],
  onStage?: (stage: string) => void,
): Promise<ParseResult> {
  onStage?.("Reading file");
  const buffer = await readArrayBufferWithLimit(file);
  onStage?.("Extracting ZIP");
  await yieldToEventLoop();
  const entries = await extractZip(buffer, warnings);
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
    onStage?.("Parsing conversations.json");
    await yieldToEventLoop();
    const json = parseJson<unknown>(decodeText(entry.data));
    platform = resolveConversationsExportPlatform(json, platform);
    onStage?.("Parsing conversations");
    return {
      platform,
      conversations: await parseByPlatform(platform, json),
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

function parseByPlatformSync(platform: Platform, json: unknown): NormalizedConversation[] {
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

async function parseByPlatform(platform: Platform, json: unknown): Promise<NormalizedConversation[]> {
  if (platform === "claude") {
    return parseClaudeExportAsync(json);
  }
  return parseByPlatformSync(platform, json);
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

export function listMonthsInConversations(
  conversations: NormalizedConversation[],
): { year: number; month: number }[] {
  const seen = new Set<string>();
  const months: { year: number; month: number }[] = [];
  for (const c of conversations) {
    const year = c.updatedAt.getFullYear();
    const month = c.updatedAt.getMonth() + 1;
    const key = `${year}-${month}`;
    if (seen.has(key)) continue;
    seen.add(key);
    months.push({ year, month });
  }
  return months.sort((a, b) => a.year - b.year || a.month - b.month);
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
