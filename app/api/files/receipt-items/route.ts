import { NextResponse } from "next/server";
import { mapReceiptItemRow } from "@/lib/files/mapReceiptItemRow";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let query = (supabase.from("workspace_receipt_items") as any)
    .select(
      "id, workspace_id, note_id, transaction_date, vendor, item_name, item_category, price_paid, warranty, return_policy, source, created_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .order("transaction_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const vendor = url.searchParams.get("vendor")?.trim();
  const category = url.searchParams.get("category")?.trim();
  const dateFrom = url.searchParams.get("dateFrom")?.trim();
  const dateTo = url.searchParams.get("dateTo")?.trim();

  if (vendor) query = query.ilike("vendor", vendor);
  if (category) query = query.ilike("item_category", category);
  if (dateFrom) query = query.gte("transaction_date", dateFrom);
  if (dateTo) query = query.lte("transaction_date", dateTo);

  const { data, error } = await query.limit(500);

  if (error?.code === "42P01") {
    return NextResponse.json({ ok: true, items: [], vendors: [], categories: [] });
  }
  if (error) {
    return NextResponse.json({ error: "Failed to load receipt items" }, { status: 500 });
  }

  const items = ((data ?? []) as Record<string, unknown>[]).map(mapReceiptItemRow);
  const vendors = [...new Set(items.map((item) => item.vendor).filter(Boolean))].sort();
  const categories = [...new Set(items.map((item) => item.itemCategory).filter(Boolean))].sort();

  return NextResponse.json({
    ok: true,
    items,
    vendors,
    categories,
    count: items.length,
  });
}