import type { NormalizedConversation, NormalizedMessage } from "@/types/conversation";
import { ParseError } from "./errors";
import { epochToDate, extractTextFromParts } from "./utils";

export function parseGrokExport(json: unknown): NormalizedConversation[] {
  if (Array.isArray(json)) {
    return json
      .map((item) => parseConversationItem(item))
      .filter((c): c is NormalizedConversation => c !== null);
  }

  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    if (Array.isArray(obj.conversations)) {
      return parseGrokExport(obj.conversations);
    }
    const single = parseConversationItem(json);
    if (single) return [single];
  }

  throw new ParseError("Unrecognized Grok export format.", "INVALID_FORMAT");
}

function parseConversationItem(raw: unknown): NormalizedConversation | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const id = String(obj.id ?? obj.uuid ?? obj.conversation_id ?? crypto.randomUUID());
  const title = String(obj.title ?? obj.name ?? "Untitled conversation");

  let messages: NormalizedMessage[] = [];

  if (Array.isArray(obj.messages)) {
    messages = obj.messages
      .map(parseMessage)
      .filter((m): m is NormalizedMessage => m !== null);
  } else if (Array.isArray(obj.prompts)) {
    messages = flattenPrompts(obj.prompts);
  } else if (Array.isArray(obj.chat_messages)) {
    messages = (obj.chat_messages as unknown[])
      .map(parseMessage)
      .filter((m): m is NormalizedMessage => m !== null);
  }

  if (messages.length === 0) return null;

  messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const createdAt =
    epochToDate(obj.created_at as string | number) ?? messages[0]!.timestamp;
  const updatedAt =
    epochToDate(obj.updated_at as string | number) ??
    messages[messages.length - 1]!.timestamp;

  return {
    id,
    platform: "grok",
    title,
    messages,
    createdAt,
    updatedAt,
  };
}

function parseMessage(raw: unknown): NormalizedMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const roleRaw = String(obj.role ?? obj.sender ?? obj.author ?? "");
  const role =
    roleRaw === "user" || roleRaw === "human"
      ? "user"
      : roleRaw === "assistant" || roleRaw === "grok"
        ? "assistant"
        : null;
  if (!role) return null;

  const ts =
    epochToDate(obj.created_at as string | number) ??
    epochToDate(obj.timestamp as string | number) ??
    epochToDate(obj.time as string | number);
  if (!ts) return null;

  const text =
    typeof obj.text === "string"
      ? obj.text
      : typeof obj.content === "string"
        ? obj.content
        : extractTextFromParts(obj.parts ?? obj.content);

  if (!text.trim()) return null;

  return {
    id: String(obj.id ?? obj.uuid ?? crypto.randomUUID()),
    role,
    text: text.trim(),
    timestamp: ts,
  };
}

function flattenPrompts(prompts: unknown[]): NormalizedMessage[] {
  const out: NormalizedMessage[] = [];
  for (const p of prompts) {
    if (!p || typeof p !== "object") continue;
    const obj = p as Record<string, unknown>;
    const userText = String(obj.prompt ?? obj.user ?? obj.question ?? "");
    const assistantText = String(obj.response ?? obj.answer ?? obj.grok ?? "");
    const ts = epochToDate(obj.created_at as string | number) ?? epochToDate(obj.time as string | number);
    if (!ts) continue;
    if (userText) {
      out.push({
        id: crypto.randomUUID(),
        role: "user",
        text: userText,
        timestamp: ts,
      });
    }
    if (assistantText) {
      out.push({
        id: crypto.randomUUID(),
        role: "assistant",
        text: assistantText,
        timestamp: new Date(ts.getTime() + 1000),
      });
    }
  }
  return out;
}
