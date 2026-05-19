import type { Platform } from "@/types/conversation";
import type { ZipEntry } from "./zip";

export function detectPlatformFromEntries(entries: ZipEntry[]): Platform | null {
  const paths = entries.map((e) => e.path.toLowerCase());

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
    return "grok";
  }

  return null;
}

export function detectPlatformFromJsonFilename(filename: string): Platform | null {
  const lower = filename.toLowerCase();
  if (lower.includes("myactivity") && lower.includes("gemini")) return "gemini";
  if (lower === "conversations.json") return null;
  if (lower.endsWith(".json")) return "grok";
  return null;
}
