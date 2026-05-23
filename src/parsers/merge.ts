import type { NormalizedConversation, Platform } from "@/types/conversation";

export const PLATFORM_LABELS: Record<Platform, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  grok: "Grok",
  gemini: "Gemini",
  cursor: "Cursor",
  claude_code: "Claude Code",
};

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

function idKey(conv: NormalizedConversation): string {
  return `${conv.platform}\0${conv.id}`;
}

function titleTimestampKey(conv: NormalizedConversation): string {
  return `${conv.platform}\0${normalizeTitle(conv.title)}\0${conv.updatedAt.getTime()}`;
}

function pickBetter(
  a: NormalizedConversation,
  b: NormalizedConversation,
): NormalizedConversation {
  if (a.messages.length !== b.messages.length) {
    return a.messages.length > b.messages.length ? a : b;
  }
  if (a.updatedAt.getTime() !== b.updatedAt.getTime()) {
    return a.updatedAt.getTime() > b.updatedAt.getTime() ? a : b;
  }
  return a;
}

export interface MergeResult {
  merged: NormalizedConversation[];
  duplicatesRemoved: number;
}

/** Merge conversations from multiple exports; de-dupe by platform+id and title+timestamp. */
export function mergeConversations(conversations: NormalizedConversation[]): MergeResult {
  const byId = new Map<string, NormalizedConversation>();
  const titleTsToIdKey = new Map<string, string>();
  let duplicatesRemoved = 0;

  for (const conv of conversations) {
    const key = idKey(conv);

    const existingById = byId.get(key);
    if (existingById) {
      byId.set(key, pickBetter(existingById, conv));
      duplicatesRemoved++;
      continue;
    }

    const ttKey = titleTimestampKey(conv);
    const existingIdKey = titleTsToIdKey.get(ttKey);
    if (existingIdKey && existingIdKey !== key) {
      const existing = byId.get(existingIdKey);
      if (existing) {
        const chosen = pickBetter(existing, conv);
        byId.delete(existingIdKey);
        titleTsToIdKey.delete(ttKey);
        const chosenKey = idKey(chosen);
        byId.set(chosenKey, chosen);
        titleTsToIdKey.set(titleTimestampKey(chosen), chosenKey);
        duplicatesRemoved++;
        continue;
      }
    }

    byId.set(key, conv);
    titleTsToIdKey.set(ttKey, key);
  }

  return { merged: [...byId.values()], duplicatesRemoved };
}

export function countByPlatform(
  conversations: NormalizedConversation[],
): Partial<Record<Platform, number>> {
  const counts: Partial<Record<Platform, number>> = {};
  for (const conv of conversations) {
    counts[conv.platform] = (counts[conv.platform] ?? 0) + 1;
  }
  return counts;
}

export function formatPlatformBreakdown(counts: Partial<Record<Platform, number>>): string {
  return Object.entries(counts)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([p, n]) => `${PLATFORM_LABELS[p as Platform] ?? p}: ${n}`)
    .join(", ");
}

export function formatUploadSummary(
  filesParsed: number,
  conversationCount: number,
  byPlatform: Partial<Record<Platform, number>>,
): string {
  const breakdown = formatPlatformBreakdown(byPlatform);
  const base = `${filesParsed} file${filesParsed === 1 ? "" : "s"} parsed → ${conversationCount} conversation${conversationCount === 1 ? "" : "s"}`;
  return breakdown ? `${base} (${breakdown})` : base;
}
