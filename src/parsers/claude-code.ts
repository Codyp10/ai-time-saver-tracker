import type { NormalizedConversation, NormalizedMessage } from "@/types/conversation";
import { ParseError } from "./errors";
import { epochToDate, extractTextFromParts } from "./utils";

interface ClaudeCodeEvent {
  type?: string;
  sessionId?: string;
  uuid?: string;
  timestamp?: string;
  message?: {
    role?: string;
    content?: unknown;
    model?: string;
  };
  lastUsedModel?: string;
}

function extractMessageText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "string") return block;
        if (block && typeof block === "object") {
          const b = block as { type?: string; text?: string };
          if (b.type === "text" || b.text) return b.text ?? "";
        }
        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  return extractTextFromParts(content).trim();
}

function eventRole(event: ClaudeCodeEvent): "user" | "assistant" | null {
  if (event.type === "user") return "user";
  if (event.type === "assistant") return "assistant";
  const role = event.message?.role;
  if (role === "user") return "user";
  if (role === "assistant") return "assistant";
  return null;
}

function parseEvents(events: ClaudeCodeEvent[], sessionFallback: string): NormalizedConversation | null {
  const messages: NormalizedMessage[] = [];
  let model: string | undefined;
  let title = "Claude Code session";

  for (const event of events) {
    if (event.lastUsedModel) model = event.lastUsedModel;
    if (event.message?.model) model = event.message.model;

    const role = eventRole(event);
    if (!role) continue;

    const ts = epochToDate(event.timestamp);
    if (!ts) continue;

    const text = extractMessageText(event.message?.content);
    if (!text) continue;

    if (role === "user" && title === "Claude Code session") {
      title = text.slice(0, 80) || title;
    }

    messages.push({
      id: event.uuid ?? crypto.randomUUID(),
      role,
      text,
      timestamp: ts,
      model,
    });
  }

  if (messages.length === 0) return null;

  return {
    id: sessionFallback,
    platform: "claude_code",
    title,
    messages,
    createdAt: messages[0]!.timestamp,
    updatedAt: messages[messages.length - 1]!.timestamp,
  };
}

export function parseClaudeCodeJsonl(text: string, filename?: string): NormalizedConversation[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) {
    throw new ParseError("Claude Code JSONL file is empty.", "INVALID_FORMAT");
  }

  const bySession = new Map<string, ClaudeCodeEvent[]>();

  for (const line of lines) {
    try {
      const event = JSON.parse(line) as ClaudeCodeEvent;
      const sessionId =
        event.sessionId ??
        filename?.replace(/\.jsonl$/i, "") ??
        "claude-code-session";
      const list = bySession.get(sessionId) ?? [];
      list.push(event);
      bySession.set(sessionId, list);
    } catch {
      // skip malformed lines
    }
  }

  const conversations: NormalizedConversation[] = [];
  for (const [sessionId, events] of bySession) {
    const conv = parseEvents(events, sessionId);
    if (conv) conversations.push(conv);
  }

  if (conversations.length === 0) {
    throw new ParseError(
      "No Claude Code messages found. Expected JSONL with type user/assistant events.",
      "INVALID_FORMAT",
    );
  }

  return conversations;
}

export function parseClaudeCodeExport(json: unknown): NormalizedConversation[] {
  if (!Array.isArray(json)) {
    throw new ParseError("Claude Code export should be a JSON array of sessions.", "INVALID_FORMAT");
  }

  const conversations: NormalizedConversation[] = [];
  for (const raw of json) {
    if (!raw || typeof raw !== "object") continue;
    const session = raw as {
      id?: string;
      title?: string;
      model?: string;
      messages?: Array<{
        role?: string;
        text?: string;
        content?: unknown;
        timestamp?: string | number;
        model?: string;
      }>;
    };

    const messages: NormalizedMessage[] = [];
    for (const msg of session.messages ?? []) {
      const role = msg.role === "user" || msg.role === "assistant" ? msg.role : null;
      if (!role) continue;
      const ts = epochToDate(msg.timestamp);
      if (!ts) continue;
      const text = (msg.text ?? extractMessageText(msg.content)).trim();
      if (!text) continue;
      messages.push({
        id: crypto.randomUUID(),
        role,
        text,
        timestamp: ts,
        model: msg.model ?? session.model,
      });
    }

    if (messages.length === 0) continue;

    conversations.push({
      id: session.id ?? crypto.randomUUID(),
      platform: "claude_code",
      title: session.title?.trim() || messages[0]!.text.slice(0, 80) || "Claude Code session",
      messages,
      createdAt: messages[0]!.timestamp,
      updatedAt: messages[messages.length - 1]!.timestamp,
    });
  }

  if (conversations.length === 0) {
    throw new ParseError("No Claude Code sessions found in JSON export.", "INVALID_FORMAT");
  }

  return conversations;
}
