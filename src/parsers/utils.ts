export function isValidTimestamp(date: Date): boolean {
  if (Number.isNaN(date.getTime())) return false;
  if (date.getFullYear() < 2020) return false;
  return true;
}

export function epochToDate(value: number | string | undefined): Date | null {
  if (value === undefined || value === null) return null;
  const num = typeof value === "string" ? Date.parse(value) : value;
  if (typeof num === "number" && num > 1e12) {
    const d = new Date(num);
    return isValidTimestamp(d) ? d : null;
  }
  if (typeof num === "number" && num > 1e9) {
    const d = new Date(num * 1000);
    return isValidTimestamp(d) ? d : null;
  }
  if (typeof value === "string") {
    const d = new Date(value);
    return isValidTimestamp(d) ? d : null;
  }
  return null;
}

export function extractTextFromParts(parts: unknown): string {
  if (!parts) return "";
  if (typeof parts === "string") return parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((p) => {
      if (typeof p === "string") return p;
      if (p && typeof p === "object" && "text" in p) return String((p as { text: string }).text);
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
