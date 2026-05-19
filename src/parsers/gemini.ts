import type { NormalizedConversation, NormalizedMessage } from "@/types/conversation";
import { ParseError } from "./errors";
import { epochToDate } from "./utils";

interface GeminiActivityEntry {
  header?: string;
  title?: string;
  time?: string;
  subtitles?: { name?: string }[];
}

export function parseGeminiExport(json: unknown): NormalizedConversation[] {
  const entries = normalizeEntries(json);
  if (entries.length === 0) {
    throw new ParseError("No Gemini activity entries found.", "EMPTY_EXPORT");
  }

  const conversations: NormalizedConversation[] = [];
  let current: NormalizedMessage[] = [];
  let convIndex = 0;

  const sorted = [...entries].sort(
    (a, b) => (epochToDate(a.time)?.getTime() ?? 0) - (epochToDate(b.time)?.getTime() ?? 0),
  );

  for (const entry of sorted) {
    const ts = epochToDate(entry.time);
    if (!ts) continue;

    const title = entry.title ?? "";
    const isPrompt =
      title.toLowerCase().startsWith("asked:") ||
      title.toLowerCase().includes("prompt");

    const text = cleanTitle(title);
    if (!text) continue;

    const role: NormalizedMessage["role"] = isPrompt ? "user" : "assistant";

    if (
      current.length > 0 &&
      role === "user" &&
      ts.getTime() - current[current.length - 1]!.timestamp.getTime() > 30 * 60 * 1000
    ) {
      conversations.push(buildConversation(current, convIndex++));
      current = [];
    }

    current.push({
      id: crypto.randomUUID(),
      role,
      text,
      timestamp: ts,
    });
  }

  if (current.length > 0) {
    conversations.push(buildConversation(current, convIndex));
  }

  return conversations;
}

function normalizeEntries(json: unknown): GeminiActivityEntry[] {
  if (Array.isArray(json)) return json as GeminiActivityEntry[];
  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    if (Array.isArray(obj.events)) return obj.events as GeminiActivityEntry[];
  }
  return [];
}

function cleanTitle(title: string): string {
  return title
    .replace(/^Asked:\s*/i, "")
    .replace(/^Prompt:\s*/i, "")
    .trim();
}

function buildConversation(
  messages: NormalizedMessage[],
  index: number,
): NormalizedConversation {
  const firstUser = messages.find((m) => m.role === "user");
  const title =
    firstUser?.text.slice(0, 80).trim() || `Gemini session ${index + 1}`;

  return {
    id: `gemini-${index}-${messages[0]!.timestamp.getTime()}`,
    platform: "gemini",
    title,
    messages,
    createdAt: messages[0]!.timestamp,
    updatedAt: messages[messages.length - 1]!.timestamp,
  };
}
