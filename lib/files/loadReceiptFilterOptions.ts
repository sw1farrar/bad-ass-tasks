import type { ReceiptItemsSupabase } from "@/lib/files/persistReceiptLineItems";

export async function loadReceiptFilterOptions(
  supabase: ReceiptItemsSupabase,
  workspaceId: string,
): Promise<{ vendors: string[]; categories: string[] }> {
  const { data, error } = await (supabase.from("workspace_receipt_items") as any)
    .select("vendor, item_category")
    .eq("workspace_id", workspaceId)
    .limit(5000);

  if (error?.code === "42P01" || error) {
    return { vendors: [], categories: [] };
  }

  const vendors = new Set<string>();
  const categories = new Set<string>();
  for (const row of (data ?? []) as Array<{ vendor?: string; item_category?: string | null }>) {
    if (row.vendor?.trim()) vendors.add(row.vendor.trim());
    if (row.item_category?.trim()) categories.add(row.item_category.trim());
  }

  return {
    vendors: [...vendors].sort((a, b) => a.localeCompare(b)),
    categories: [...categories].sort((a, b) => a.localeCompare(b)),
  };
}