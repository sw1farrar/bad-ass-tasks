import { NextResponse } from "next/server";
import type { EnrichedReceiptLineItem } from "@/lib/files/enrichReceiptItemPolicies";
import { assertWorkspaceMember } from "@/lib/files/assertReceiptItemAccess";
import { loadReceiptFilterOptions } from "@/lib/files/loadReceiptFilterOptions";
import { mapReceiptItemRow } from "@/lib/files/mapReceiptItemRow";
import { persistReceiptLineItems } from "@/lib/files/persistReceiptLineItems";
import {
  buildReceiptSearchOrFilter,
  RECEIPT_LEDGER_PAGE_SIZE,
  receiptLedgerSortToDbColumn,
  resolveReceiptLedgerSort,
} from "@/lib/files/receiptLineItems";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type PersistReceiptItemsBody = {
  workspaceId?: string;
  noteId?: string;
  items?: EnrichedReceiptLineItem[];
};

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

  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? String(RECEIPT_LEDGER_PAGE_SIZE), 10) || RECEIPT_LEDGER_PAGE_SIZE, 1),
    100,
  );
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);
  const includeFilters = url.searchParams.get("includeFilters") === "1";

  const { column: sortColumn, direction: sortDirection } = resolveReceiptLedgerSort(
    url.searchParams.get("sortBy"),
    url.searchParams.get("sortDir"),
  );
  const ascending = sortDirection === "asc";

  let query = (supabase.from("workspace_receipt_items") as any)
    .select(
      "id, workspace_id, note_id, transaction_date, vendor, item_name, item_category, price_paid, warranty, return_policy, source, created_at, updated_at",
      { count: "exact" },
    )
    .eq("workspace_id", workspaceId)
    .order(receiptLedgerSortToDbColumn(sortColumn), { ascending, nullsFirst: false })
    .order("created_at", { ascending: false });

  const vendor = url.searchParams.get("vendor")?.trim();
  const category = url.searchParams.get("category")?.trim();
  const dateFrom = url.searchParams.get("dateFrom")?.trim();
  const dateTo = url.searchParams.get("dateTo")?.trim();
  const searchQuery = url.searchParams.get("query")?.trim();
  const searchOr = buildReceiptSearchOrFilter(searchQuery ?? "");

  if (vendor) query = query.ilike("vendor", vendor);
  if (category) query = query.ilike("item_category", category);
  if (dateFrom) query = query.gte("transaction_date", dateFrom);
  if (dateTo) query = query.lte("transaction_date", dateTo);
  if (searchOr) query = query.or(searchOr);

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error?.code === "42P01") {
    return NextResponse.json({
      ok: true,
      items: [],
      vendors: [],
      categories: [],
      total: 0,
      hasMore: false,
      offset,
      limit,
    });
  }
  if (error) {
    return NextResponse.json({ error: "Failed to load receipt items" }, { status: 500 });
  }

  const items = ((data ?? []) as Record<string, unknown>[]).map(mapReceiptItemRow);
  const total = count ?? items.length;
  const filterOptions = includeFilters
    ? await loadReceiptFilterOptions(supabase, workspaceId)
    : { vendors: [], categories: [] };

  return NextResponse.json({
    ok: true,
    items,
    vendors: filterOptions.vendors,
    categories: filterOptions.categories,
    total,
    hasMore: offset + items.length < total,
    offset,
    limit,
  });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PersistReceiptItemsBody;
  try {
    body = (await request.json()) as PersistReceiptItemsBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const workspaceId = body.workspaceId?.trim();
  const noteId = body.noteId?.trim();
  const items = (body.items ?? []).filter((item) => item.itemName?.trim());

  if (!workspaceId || !noteId) {
    return NextResponse.json({ error: "workspaceId and noteId required" }, { status: 400 });
  }
  if (!items.length) {
    return NextResponse.json({ error: "items required" }, { status: 400 });
  }

  try {
    const scoped = await assertWorkspaceMember(workspaceId, user.id);
    const result = await persistReceiptLineItems(scoped, workspaceId, noteId, items);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "persist_failed";
    if (message === "not_a_member") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to save receipt items" }, { status: 500 });
  }
}