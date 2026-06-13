import { normalizeTag } from "@/lib/files/parseTagsInput";

const MAX_SUGGESTED_TAGS = 8;
const SYSTEM_TAG = "from-email";

/** Normalize and keep only tags that exist in the workspace filing pool. */
export function resolveSuggestedFilingTags(
  suggested: string[] | undefined | null,
  allowed: string[],
): string[] {
  if (!suggested?.length || !allowed.length) return [];

  const allowedSet = new Set(
    allowed.map((tag) => normalizeTag(tag)).filter((tag) => tag && tag !== SYSTEM_TAG),
  );
  if (!allowedSet.size) return [];

  const seen = new Set<string>();
  const resolved: string[] = [];

  for (const raw of suggested) {
    const tag = normalizeTag(raw);
    if (!tag || tag === SYSTEM_TAG || !allowedSet.has(tag) || seen.has(tag)) continue;
    seen.add(tag);
    resolved.push(tag);
    if (resolved.length >= MAX_SUGGESTED_TAGS) break;
  }

  return resolved;
}

export function mergeWorkspaceFilingTags(...lists: Array<string[] | undefined>): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const list of lists) {
    for (const raw of list ?? []) {
      const tag = normalizeTag(raw);
      if (!tag || tag === SYSTEM_TAG || seen.has(tag)) continue;
      seen.add(tag);
      merged.push(tag);
    }
  }

  return merged.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}