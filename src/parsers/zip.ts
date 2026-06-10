import { unzip } from "fflate";
import {
  MAX_UNCOMPRESSED_BYTES,
  MAX_ZIP_ENTRIES,
  MAX_ZIP_ENTRY_BYTES,
  formatBytes,
  yieldToEventLoop,
} from "@/config/securityLimits";
import type { NormalizedConversation } from "@/types/conversation";
import { parseClaudeCodeJsonl } from "./claude-code";
import { mergeConversations } from "./merge";
import { ParseError, userFacingError } from "./errors";

export interface ZipEntry {
  path: string;
  data: Uint8Array;
}

function validateZipEntries(entries: Record<string, Uint8Array>): void {
  const paths = Object.keys(entries).filter((p) => !p.endsWith("/"));

  if (paths.length === 0) {
    throw new ParseError("ZIP file is empty.", "INVALID_ZIP");
  }

  if (paths.length > MAX_ZIP_ENTRIES) {
    throw new ParseError(
      `ZIP contains too many files (${paths.length.toLocaleString()}). Maximum is ${MAX_ZIP_ENTRIES.toLocaleString()}.`,
      "ZIP_TOO_LARGE",
    );
  }

  let totalUncompressed = 0;
  for (const path of paths) {
    const size = entries[path]!.byteLength;
    if (size > MAX_ZIP_ENTRY_BYTES) {
      throw new ParseError(
        `File "${path}" in ZIP is too large (${formatBytes(size)}). Maximum per file is ${formatBytes(MAX_ZIP_ENTRY_BYTES)}.`,
        "ZIP_TOO_LARGE",
      );
    }
    totalUncompressed += size;
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
      throw new ParseError(
        `ZIP uncompressed content exceeds ${formatBytes(MAX_UNCOMPRESSED_BYTES)}. This may be a zip bomb or an unusually large export — try splitting your export.`,
        "ZIP_TOO_LARGE",
      );
    }
  }
}

export async function extractZip(
  buffer: ArrayBuffer,
  warnings?: string[],
): Promise<ZipEntry[]> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
      unzip(new Uint8Array(buffer), (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  } catch {
    throw new ParseError(
      "Could not open ZIP file. Make sure it is a valid export archive.",
      "INVALID_ZIP",
    );
  }

  validateZipEntries(entries);

  const result = Object.entries(entries)
    .filter(([path]) => !path.endsWith("/"))
    .map(([path, data]) => ({ path, data }));

  return coalesceClaudeCodeJsonlEntries(result, warnings);
}

function serializeToClaudeCodeJsonl(conversations: NormalizedConversation[]): string {
  const lines: string[] = [];
  for (const conv of conversations) {
    for (const msg of conv.messages) {
      lines.push(
        JSON.stringify({
          type: msg.role,
          sessionId: conv.id,
          uuid: msg.id,
          timestamp: msg.timestamp.toISOString(),
          message: { role: msg.role, content: msg.text, model: msg.model },
        }),
      );
    }
  }
  return lines.join("\n");
}

/**
 * A zipped ~/.claude/projects directory contains one .jsonl per session. Downstream
 * parsing reads a single .jsonl entry, so combine them all here: parse each session
 * file, de-dupe via merge logic, and re-serialize into one entry.
 */
export async function coalesceClaudeCodeJsonlEntries(
  entries: ZipEntry[],
  warnings?: string[],
): Promise<ZipEntry[]> {
  const jsonlEntries = entries.filter((e) => e.path.toLowerCase().endsWith(".jsonl"));
  if (jsonlEntries.length <= 1) return entries;

  const conversations: NormalizedConversation[] = [];
  for (const entry of jsonlEntries) {
    try {
      conversations.push(...parseClaudeCodeJsonl(decodeText(entry.data), entry.path));
    } catch (err) {
      warnings?.push(`Skipped "${entry.path}": ${userFacingError(err)}`);
    }
    await yieldToEventLoop();
  }
  if (conversations.length === 0) return entries;

  const data = new TextEncoder().encode(
    serializeToClaudeCodeJsonl(mergeConversations(conversations).merged),
  );
  if (data.byteLength > MAX_ZIP_ENTRY_BYTES) {
    throw new ParseError(
      `Combined Claude Code sessions in ZIP are too large (${formatBytes(data.byteLength)}). Maximum per file is ${formatBytes(MAX_ZIP_ENTRY_BYTES)}.`,
      "ZIP_TOO_LARGE",
    );
  }

  const combined: ZipEntry = {
    path: jsonlEntries[0]!.path,
    data,
  };

  let inserted = false;
  const result: ZipEntry[] = [];
  for (const entry of entries) {
    if (entry.path.toLowerCase().endsWith(".jsonl")) {
      if (!inserted) {
        result.push(combined);
        inserted = true;
      }
      continue;
    }
    result.push(entry);
  }
  return result;
}

export function findEntry(
  entries: ZipEntry[],
  matcher: (path: string) => boolean,
): ZipEntry | undefined {
  return entries.find((e) => matcher(e.path.toLowerCase()));
}

export function decodeText(data: Uint8Array): string {
  return new TextDecoder("utf-8").decode(data);
}

export function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ParseError(
      "Could not read JSON in export file. The file may be corrupted or incomplete.",
      "INVALID_JSON",
    );
  }
}
