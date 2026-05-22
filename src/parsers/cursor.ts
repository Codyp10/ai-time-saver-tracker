import initSqlJs from "sql.js";
import type { NormalizedConversation, NormalizedMessage } from "@/types/conversation";
import { ParseError } from "./errors";
import { epochToDate } from "./utils";

interface CursorComposerMeta {
  composerId?: string;
  name?: string;
  title?: string;
  lastUsedModel?: string;
  model?: string;
}

interface CursorBubble {
  type?: number | string;
  role?: string;
  text?: string;
  content?: string;
  rawText?: string;
  createdAt?: number | string;
  timestamp?: number | string;
  model?: string;
}

let sqlPromise: ReturnType<typeof initSqlJs> | null = null;

async function getSql() {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file) => `https://sql.js.org/dist/${file}`,
    });
  }
  return sqlPromise;
}

function decodeValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) return new TextDecoder().decode(value);
  if (Array.isArray(value)) return new TextDecoder().decode(new Uint8Array(value));
  return String(value ?? "");
}

function bubbleRole(bubble: CursorBubble): "user" | "assistant" | null {
  if (bubble.role === "user" || bubble.type === 1 || bubble.type === "user") return "user";
  if (bubble.role === "assistant" || bubble.type === 2 || bubble.type === "assistant") {
    return "assistant";
  }
  return null;
}

function bubbleText(bubble: CursorBubble): string {
  return (bubble.text ?? bubble.content ?? bubble.rawText ?? "").trim();
}

function buildConversation(
  composerId: string,
  meta: CursorComposerMeta | undefined,
  bubbles: CursorBubble[],
): NormalizedConversation | null {
  const messages: NormalizedMessage[] = [];
  const model = meta?.lastUsedModel ?? meta?.model;

  for (const bubble of bubbles) {
    const role = bubbleRole(bubble);
    if (!role) continue;

    const ts = epochToDate(bubble.createdAt ?? bubble.timestamp);
    if (!ts) continue;

    const text = bubbleText(bubble);
    if (!text) continue;

    messages.push({
      id: crypto.randomUUID(),
      role,
      text,
      timestamp: ts,
      model: bubble.model ?? model,
    });
  }

  if (messages.length === 0) return null;

  messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return {
    id: composerId,
    platform: "cursor",
    title: meta?.name?.trim() || meta?.title?.trim() || messages[0]!.text.slice(0, 80) || "Cursor chat",
    messages,
    createdAt: messages[0]!.timestamp,
    updatedAt: messages[messages.length - 1]!.timestamp,
  };
}

export function parseCursorJsonExport(json: unknown): NormalizedConversation[] {
  if (!Array.isArray(json)) {
    throw new ParseError("Cursor export should be a JSON array of chat sessions.", "INVALID_FORMAT");
  }

  const conversations: NormalizedConversation[] = [];

  for (const raw of json) {
    if (!raw || typeof raw !== "object") continue;
    const session = raw as {
      id?: string;
      title?: string;
      name?: string;
      model?: string;
      lastUsedModel?: string;
      messages?: CursorBubble[];
    };

    const conv = buildConversation(
      session.id ?? crypto.randomUUID(),
      { name: session.title ?? session.name, lastUsedModel: session.lastUsedModel ?? session.model },
      session.messages ?? [],
    );
    if (conv) conversations.push(conv);
  }

  if (conversations.length === 0) {
    throw new ParseError("No Cursor sessions found in JSON export.", "INVALID_FORMAT");
  }

  return conversations;
}

export async function parseCursorSqlite(data: Uint8Array): Promise<NormalizedConversation[]> {
  const SQL = await getSql();
  const db = new SQL.Database(data);

  const composers = new Map<string, CursorComposerMeta>();
  const bubbles = new Map<string, CursorBubble[]>();

  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
  const tableNames = tables[0]?.values.map((row: import("sql.js").SqlValue[]) => String(row[0])) ?? [];

  let rows: [string, unknown][] = [];

  if (tableNames.includes("cursorDiskKV")) {
    const result = db.exec("SELECT key, value FROM cursorDiskKV");
    rows = (result[0]?.values ?? []) as [string, unknown][];
  } else if (tableNames.includes("ItemTable")) {
    const result = db.exec("SELECT key, value FROM ItemTable");
    rows = (result[0]?.values ?? []) as [string, unknown][];
  } else {
    db.close();
    throw new ParseError(
      "Unrecognized Cursor database format. Expected cursorDiskKV or ItemTable.",
      "INVALID_FORMAT",
    );
  }

  for (const [key, rawValue] of rows) {
    const valueText = decodeValue(rawValue);
    if (!valueText) continue;

    if (key.startsWith("composerData:")) {
      const composerId = key.slice("composerData:".length);
      try {
        const meta = JSON.parse(valueText) as CursorComposerMeta;
        composers.set(composerId, { ...meta, composerId });
      } catch {
        // skip invalid metadata
      }
      continue;
    }

    if (key.startsWith("bubbleId:")) {
      const parts = key.split(":");
      const composerId = parts[1];
      if (!composerId) continue;

      try {
        const bubble = JSON.parse(valueText) as CursorBubble;
        const list = bubbles.get(composerId) ?? [];
        list.push(bubble);
        bubbles.set(composerId, list);
      } catch {
        // skip invalid bubble
      }
    }
  }

  db.close();

  const composerIds = new Set([...composers.keys(), ...bubbles.keys()]);
  const conversations: NormalizedConversation[] = [];

  for (const composerId of composerIds) {
    const conv = buildConversation(composerId, composers.get(composerId), bubbles.get(composerId) ?? []);
    if (conv) conversations.push(conv);
  }

  if (conversations.length === 0) {
    throw new ParseError(
      "No Cursor chat messages found in database. Try exporting via cursor-history or upload a JSON export.",
      "INVALID_FORMAT",
    );
  }

  return conversations;
}
