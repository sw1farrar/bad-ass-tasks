export function previewEntryBody(body: string, maxLength = 120): string {
  const trimmed = body.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}…`;
}