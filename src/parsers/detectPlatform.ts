import type { Platform } from "@/types/conversation";
import type { ZipEntry } from "./zip";

export function detectPlatformFromEntries(entries: ZipEntry[]): Platform | null {
  const paths = entries.map((e) => e.path.toLowerCase());

  if (paths.some((p) => p.endsWith(".jsonl"))) {
    return "claude_code";
  }

  if (paths.some((p) => p.endsWith("conversations.json"))) {
    const hasChatMessages = entries.some((e) => {
      if (!e.path.toLowerCase().endsWith("conversations.json")) return false;
      try {
        const text = new TextDecoder().decode(e.data.slice(0, 8000));
        return (
          text.includes('"chat_messages"') ||
          text.includes('"sender":"human"') ||
          text.includes('"sender": "human"')
        );
      } catch {
        return false;
      }
    });
    if (hasChatMessages) return "claude";
    return "chatgpt";
  }

  if (paths.some((p) => p.includes("myactivity.json") && p.includes("gemini"))) {
    return "gemini";
  }

  if (paths.some((p) => p.includes("gemini apps") && p.endsWith(".json"))) {
    return "gemini";
  }

  const jsonFiles = entries.filter((e) => e.path.toLowerCase().endsWith(".json"));
  if (jsonFiles.length === 1 && !paths.some((p) => p.includes("takeout"))) {
    const sample = new TextDecoder().decode(jsonFiles[0]!.data.slice(0, 4000));
    if (sample.includes('"platform":"cursor"') || sample.includes('"lastUsedModel"')) {
      return "cursor";
    }
    if (sample.includes('"sessionId"') && sample.includes('"type":"user"')) {
      return "claude_code";
    }
    return "grok";
  }

  return null;
}

export function detectPlatformFromJsonFilename(filename: string): Platform | null {
  const lower = filename.toLowerCase();
  if (lower.includes("myactivity") && lower.includes("gemini")) return "gemini";
  if (lower.includes("claude-code") || lower.includes("claude_code")) return "claude_code";
  if (lower.includes("cursor")) return "cursor";
  if (lower === "conversations.json") return null;
  if (lower.endsWith(".json")) return "grok";
  return null;
}

export function detectPlatformFromFilename(filename: string): Platform | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".jsonl")) return "claude_code";
  if (lower.endsWith(".db") || lower.endsWith(".vscdb")) return "cursor";
  return detectPlatformFromJsonFilename(filename);
}

function firstConversationRecord(json: unknown): Record<string, unknown> | null {
  if (Array.isArray(json) && json.length > 0 && json[0] && typeof json[0] === "object") {
    return json[0] as Record<string, unknown>;
  }
  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    for (const key of ["conversations", "data", "items"]) {
      const nested = obj[key];
      if (Array.isArray(nested) && nested.length > 0 && nested[0] && typeof nested[0] === "object") {
        return nested[0] as Record<string, unknown>;
      }
      if (nested && typeof nested === "object") {
        const inner = (nested as Record<string, unknown>).conversations;
        if (Array.isArray(inner) && inner.length > 0 && inner[0] && typeof inner[0] === "object") {
          return inner[0] as Record<string, unknown>;
        }
      }
    }
  }
  return null;
}

export function exportJsonHasChatMessages(json: unknown): boolean {
  const first = firstConversationRecord(json);
  return first !== null && "chat_messages" in first;
}

export function exportJsonHasMapping(json: unknown): boolean {
  const first = firstConversationRecord(json);
  return first !== null && "mapping" in first;
}

export function resolveConversationsExportPlatform(
  json: unknown,
  detected: "claude" | "chatgpt",
): "claude" | "chatgpt" {
  if (detected === "chatgpt") return "chatgpt";
  if (exportJsonHasChatMessages(json)) return "claude";
  if (exportJsonHasMapping(json)) return "chatgpt";
  return detected;
}

export function detectPlatformFromJsonSample(json: unknown): Platform | null {
  if (exportJsonHasChatMessages(json)) return "claude";
  if (exportJsonHasMapping(json)) return "chatgpt";

  const first = firstConversationRecord(json);
  if (first) {
    if (first.platform === "claude_code") return "claude_code";
    if (first.platform === "cursor") return "cursor";
    if (Array.isArray(first.messages) && (first.lastUsedModel || first.model)) return "cursor";
  }

  if (Array.isArray(json) && json.length > 0) {
    const item = json[0];
    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      if (obj.platform === "claude_code") return "claude_code";
      if (obj.platform === "cursor") return "cursor";
      if (Array.isArray(obj.messages) && (obj.lastUsedModel || obj.model)) return "cursor";
    }
  }

  return null;
}
