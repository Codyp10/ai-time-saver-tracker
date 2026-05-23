import type { NormalizedConversation, NormalizedMessage } from "@/types/conversation";
import { ParseError } from "./errors";
import { epochToDate } from "./utils";

interface ClaudeContentBlock {
  type?: string;
  text?: string;
  content?: string;
  name?: string;
  input?: unknown;
}

interface ClaudeMessage {
  uuid?: string;
  text?: string;
  sender?: string;
  created_at?: string;
  content?: ClaudeContentBlock[];
}

interface ClaudeConversation {
  uuid?: string;
  name?: string;
  created_at?: string;
  updated_at?: string;
  chat_messages?: ClaudeMessage[];
}

function messageRole(sender: string | undefined): "user" | "assistant" | null {
  if (sender === "human" || sender === "user") return "user";
  if (sender === "assistant") return "assistant";
  return null;
}

function extractContentText(blocks: ClaudeContentBlock[] | undefined): string {
  if (!blocks?.length) return "";
  return blocks
    .map((block) => {
      if (block.text) return block.text;
      if (typeof block.content === "string") return block.content;
      if (block.type === "text" && block.text) return block.text;
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function unwrapClaudeExport(json: unknown): ClaudeConversation[] {
  if (Array.isArray(json)) {
    return json as ClaudeConversation[];
  }
  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    for (const key of ["conversations", "data", "items"]) {
      const nested = obj[key];
      if (Array.isArray(nested)) {
        return nested as ClaudeConversation[];
      }
      if (nested && typeof nested === "object") {
        const inner = nested as Record<string, unknown>;
        if (Array.isArray(inner.conversations)) {
          return inner.conversations as ClaudeConversation[];
        }
      }
    }
  }
  throw new ParseError(
    "Claude export should be a JSON array in conversations.json.",
    "INVALID_FORMAT",
  );
}

export function parseClaudeExport(json: unknown): NormalizedConversation[] {
  const conversations = unwrapClaudeExport(json)
    .map(parseConversation)
    .filter((c): c is NormalizedConversation => c !== null);

  if (conversations.length === 0) {
    throw new ParseError(
      "No readable Claude conversations found. Messages may use an unsupported format.",
      "INVALID_FORMAT",
    );
  }

  return conversations;
}

function parseConversation(raw: ClaudeConversation): NormalizedConversation | null {
  const messages: NormalizedMessage[] = [];

  for (const msg of raw.chat_messages ?? []) {
    const role = messageRole(msg.sender);
    if (!role) continue;

    const ts = epochToDate(msg.created_at);
    if (!ts) continue;

    const fromContent = extractContentText(msg.content);
    const text = (msg.text ?? fromContent).trim();
    if (!text) continue;

    messages.push({
      id: msg.uuid ?? crypto.randomUUID(),
      role,
      text,
      timestamp: ts,
    });
  }

  if (messages.length === 0) return null;

  const createdAt = epochToDate(raw.created_at) ?? messages[0]!.timestamp;
  const updatedAt = epochToDate(raw.updated_at) ?? messages[messages.length - 1]!.timestamp;

  return {
    id: raw.uuid ?? crypto.randomUUID(),
    platform: "claude",
    title: raw.name?.trim() || "Untitled conversation",
    messages,
    createdAt,
    updatedAt,
  };
}
