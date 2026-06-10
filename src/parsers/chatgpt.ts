import type { NormalizedConversation, NormalizedMessage } from "@/types/conversation";
import { ParseError } from "./errors";
import { epochToDate, extractTextFromParts } from "./utils";

interface ChatGPTMappingNode {
  id?: string;
  parent?: string | null;
  children?: string[];
  message?: {
    id?: string;
    author?: { role?: string };
    create_time?: number;
    content?: { parts?: unknown };
    metadata?: { model_slug?: string };
  } | null;
}

interface ChatGPTConversation {
  id?: string;
  title?: string;
  create_time?: number;
  update_time?: number;
  current_node?: string;
  mapping?: Record<string, ChatGPTMappingNode>;
}

export function parseChatGPTExport(json: unknown): NormalizedConversation[] {
  if (!Array.isArray(json)) {
    throw new ParseError(
      "ChatGPT export should be a JSON array in conversations.json.",
      "INVALID_FORMAT",
    );
  }

  return (json as ChatGPTConversation[])
    .map(parseConversation)
    .filter((c): c is NormalizedConversation => c !== null);
}

function flattenedNodes(
  mapping: Record<string, ChatGPTMappingNode>,
): ChatGPTMappingNode[] {
  return Object.values(mapping)
    .filter((n) => n.message?.author?.role)
    .sort((a, b) => (a.message?.create_time ?? 0) - (b.message?.create_time ?? 0));
}

function findMostRecentLeaf(
  mapping: Record<string, ChatGPTMappingNode>,
): string | null {
  const referencedParents = new Set<string>();
  for (const node of Object.values(mapping)) {
    if (typeof node.parent === "string") referencedParents.add(node.parent);
  }

  let leaves = Object.keys(mapping).filter((id) => !referencedParents.has(id));
  if (leaves.length === 0) leaves = Object.keys(mapping);

  let best: string | null = null;
  let bestTime = -Infinity;
  for (const id of leaves) {
    const t = mapping[id]?.message?.create_time ?? 0;
    if (t > bestTime) {
      bestTime = t;
      best = id;
    }
  }
  return best;
}

/** Walk the active branch (current_node → root) so regenerated/edited siblings are not counted. */
function activeBranchNodes(
  mapping: Record<string, ChatGPTMappingNode>,
  currentNode: string | undefined,
): ChatGPTMappingNode[] {
  const hasParentLinks = Object.values(mapping).some(
    (n) => typeof n.parent === "string",
  );
  if (!hasParentLinks) return flattenedNodes(mapping);

  const startId =
    currentNode && mapping[currentNode] ? currentNode : findMostRecentLeaf(mapping);
  if (!startId) return flattenedNodes(mapping);

  const path: ChatGPTMappingNode[] = [];
  const visited = new Set<string>();
  let cursor: string | null | undefined = startId;
  while (cursor && mapping[cursor] && !visited.has(cursor)) {
    visited.add(cursor);
    path.push(mapping[cursor]!);
    cursor = mapping[cursor]!.parent;
  }
  path.reverse();
  return path;
}

function parseConversation(raw: ChatGPTConversation): NormalizedConversation | null {
  const id = raw.id ?? crypto.randomUUID();
  const messages: NormalizedMessage[] = [];

  if (raw.mapping) {
    const nodes = activeBranchNodes(raw.mapping, raw.current_node);

    for (const node of nodes) {
      const msg = node.message;
      if (!msg?.author?.role) continue;

      const ts = epochToDate(msg.create_time);
      if (!ts) continue;

      const role = normalizeRole(msg.author.role);
      if (!role) continue;

      const text = extractTextFromParts(msg.content?.parts);
      if (!text && role !== "tool") continue;

      messages.push({
        id: msg.id ?? node.id ?? crypto.randomUUID(),
        role,
        text,
        timestamp: ts,
        model: msg.metadata?.model_slug,
      });
    }
  }

  if (messages.length === 0) return null;

  const createdAt = epochToDate(raw.create_time) ?? messages[0]!.timestamp;
  const updatedAt =
    epochToDate(raw.update_time) ?? messages[messages.length - 1]!.timestamp;

  return {
    id,
    platform: "chatgpt",
    title: raw.title?.trim() || "Untitled conversation",
    messages,
    createdAt,
    updatedAt,
  };
}

function normalizeRole(
  role: string,
): NormalizedMessage["role"] | null {
  switch (role) {
    case "user":
      return "user";
    case "assistant":
      return "assistant";
    case "system":
      return "system";
    case "tool":
      return "tool";
    default:
      return null;
  }
}
