import { NextResponse } from "next/server";
import { assertReceiptItemAccess } from "@/lib/files/assertReceiptItemAccess";
import { buildReceiptDedupeKey } from "@/lib/files/receiptLineItems";
import { mapReceiptItemRow } from "@/lib/files/mapReceiptItemRow";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type UpdateReceiptItemBody = {
  itemName?: string;
  itemCategory?: string | null;
  pricePaid?: number | null;
  transactionDate?: string | null;
  vendor?: string | null;
  warranty?: string | null;
  returnPolicy?: string | null;
};

function normalizeUpdate(body: UpdateReceiptItemBody) {
  const itemName = body.itemName?.trim();
  if (!itemName) return null;

  const pricePaid =
    body.pricePaid == null
      ? null
      : Number.isFinite(Number(body.pricePaid))
        ? Math.round(Number(body.pricePaid) * 100) / 100
        : null;

  const transactionDate = body.transactionDate?.trim() || null;
  const vendor = body.vendor?.trim() ?? "";
  const itemCategory = body.itemCategory?.trim() || null;
  const warranty = body.warranty?.trim() || null;
  const returnPolicy = body.returnPolicy?.trim() || null;

  return {
    item_name: itemName,
    item_category: itemCategory,
    price_paid: pricePaid,
    transaction_date: transactionDate,
    vendor,
    warranty,
    return_policy: returnPolicy,
  };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  let body: UpdateReceiptItemBody;
  try {
    body = (await request.json()) as UpdateReceiptItemBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates = normalizeUpdate(body);
  if (!updates) {
    return NextResponse.json({ error: "itemName required" }, { status: 400 });
  }

  try {
    const { supabase: scoped, noteId, itemId } = await assertReceiptItemAccess(id, user.id);
    const dedupeKey = buildReceiptDedupeKey({
      noteId,
      itemName: updates.item_name,
      pricePaid: updates.price_paid,
      transactionDate: updates.transaction_date,
    });

    const { data, error } = await (scoped.from("workspace_receipt_items") as any)
      .update({
        ...updates,
        dedupe_key: dedupeKey,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId)
      .select(
        "id, workspace_id, note_id, transaction_date, vendor, item_name, item_category, price_paid, warranty, return_policy, source, created_at, updated_at",
      )
      .maybeSingle();

    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "duplicate_item", message: "An item with the same name, price, and date already exists." },
        { status: 409 },
      );
    }
    if (error) {
      return NextResponse.json({ error: "Failed to update receipt item" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      item: mapReceiptItemRow(data as Record<string, unknown>),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "update_failed";
    if (message === "not_a_member") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (message === "item_not_found") {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update receipt item" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const { supabase: scoped, itemId } = await assertReceiptItemAccess(id, user.id);
    const { error } = await (scoped.from("workspace_receipt_items") as any)
      .delete()
      .eq("id", itemId);

    if (error) {
      return NextResponse.json({ error: "Failed to delete receipt item" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "delete_failed";
    if (message === "not_a_member") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (message === "item_not_found") {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete receipt item" }, { status: 500 });
  }
}