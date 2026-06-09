export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseTagsInput(raw: string): string[] {
  return raw
    .split(/[,#]/)
    .map(normalizeTag)
    .filter(Boolean);
}