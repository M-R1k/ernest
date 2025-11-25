const SECOND_MESSAGE_REGEX =
  /(🟪|🟣)?\s*(?:\*\*)?\s*De(?:ux|xui)i?[eéè]me\s+message(?:\s*[:\-–]\s*|\s*)(?:\*\*)?/i;

export const SECOND_MESSAGE_INTERVAL_MS = 2000;

export function splitSecondMessage(text?: string | null): string[] {
  if (!text) {
    return [];
  }

  const cleaned = String(text);
  const match = cleaned.match(SECOND_MESSAGE_REGEX);

  if (!match || match.index === undefined) {
    const trimmed = cleaned.trim();
    return trimmed ? [trimmed] : [];
  }

  const before = cleaned.slice(0, match.index).trim();
  const after = cleaned.slice(match.index + match[0].length).trim();
  const parts: string[] = [];

  if (before) {
    parts.push(before);
  }

  if (after) {
    parts.push(...splitSecondMessage(after));
  }

  return parts.length ? parts : (cleaned.trim() ? [cleaned.trim()] : []);
}

export function hasSecondMessageSeparator(text?: string | null): boolean {
  if (!text) return false;
  return SECOND_MESSAGE_REGEX.test(text);
}

