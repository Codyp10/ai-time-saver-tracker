import type { NormalizedConversation } from "@/types/conversation";

const SESSION_GAP_MS = 30 * 60 * 1000;
const MAX_SESSION_MS = 2 * 60 * 60 * 1000;
const MIN_CONVERSATION_MS = 60 * 1000;

export function estimateConversationMinutes(conv: NormalizedConversation): number {
  const msgs = conv.messages.filter((m) => m.role === "user" || m.role === "assistant");
  if (msgs.length < 2) {
    return msgs.length >= 1 ? 1 : 0;
  }

  let totalMs = 0;
  let sessionStart = msgs[0]!.timestamp.getTime();
  let prev = sessionStart;

  for (let i = 1; i < msgs.length; i++) {
    const t = msgs[i]!.timestamp.getTime();
    const gap = t - prev;
    if (gap > SESSION_GAP_MS) {
      totalMs += Math.min(prev - sessionStart, MAX_SESSION_MS);
      sessionStart = t;
    }
    prev = t;
  }
  totalMs += Math.min(prev - sessionStart, MAX_SESSION_MS);

  const minutes = Math.max(totalMs / 60000, MIN_CONVERSATION_MS / 60000);
  return Math.round(minutes * 10) / 10;
}

export function estimateTotalMinutes(conversations: NormalizedConversation[]): number {
  return conversations.reduce((sum, c) => sum + estimateConversationMinutes(c), 0);
}
