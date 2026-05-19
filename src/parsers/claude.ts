import type { NormalizedConversation, NormalizedMessage } from "@/types/conversation";
import { ParseError } from "./errors";
import { epochToDate } from "./utils";

interface ClaudeContentBlock {
  type?: string;
  text?: string;
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

export function parseClaudeExport(json: unknown): NormalizedConversation[] {
  if (!Array.isArray(json)) {
    throw new ParseError(
      "Claude export should be a JSON array in conversations.json.",
      "INVALID_FORMAT",
    );
  }

  return (json as ClaudeConversation[])
    .map(parseConversation)
    .filter((c): c is NormalizedConversation => c !== null);
}

function parseConversation(raw: ClaudeConversation): NormalizedConversation | null {
  const messages: NormalizedMessage[] = [];

  for (const msg of raw.chat_messages ?? []) {
    const role = msg.sender === "human" ? "user" : msg.sender === "assistant" ? "assistant" : null;
    if (!role) continue;

    const ts = epochToDate(msg.created_at);
    if (!ts) continue;

    const fromContent = (msg.content ?? [])
      .map((b) => b.text ?? "")
      .filter(Boolean)
      .join("\n");
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
