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
        const text = new TextDecoder().decode(e.data.slice(0, 5000));
        return text.includes('"chat_messages"');
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

export function detectPlatformFromJsonSample(json: unknown): Platform | null {
  const sample = JSON.stringify(json).slice(0, 4000);
  if (sample.includes('"chat_messages"')) return "claude";
  if (sample.includes('"mapping"')) return "chatgpt";
  if (sample.includes('"platform":"claude_code"')) return "claude_code";
  if (sample.includes('"platform":"cursor"')) return "cursor";
  if (Array.isArray(json) && json.length > 0) {
    const first = json[0];
    if (first && typeof first === "object") {
      const obj = first as Record<string, unknown>;
      if (obj.platform === "claude_code") return "claude_code";
      if (obj.platform === "cursor") return "cursor";
      if (Array.isArray(obj.messages) && (obj.lastUsedModel || obj.model)) return "cursor";
    }
  }
  return null;
}
