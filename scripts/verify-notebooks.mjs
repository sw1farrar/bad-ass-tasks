#!/usr/bin/env node
/**
 * Verify notebooks table + notes.notebook_id column (read-only).
 * Loads .env.local for Supabase URL + service role key.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { count: notebookCount, error: tableError } = await supabase
    .from("notebooks")
    .select("id", { count: "exact", head: true });

  if (tableError) {
    if (
      tableError.code === "42P01" ||
      tableError.code === "PGRST205" ||
      /notebooks/i.test(tableError.message ?? "")
    ) {
      console.log("MISSING: notebooks table does not exist yet");
      process.exit(2);
    }
    console.error("Probe failed:", tableError.message);
    process.exit(1);
  }

  const { error: columnError } = await supabase
    .from("notes")
    .select("notebook_id")
    .limit(0);

  if (columnError) {
    if (
      columnError.code === "PGRST204" ||
      /notebook_id/i.test(columnError.message ?? "")
    ) {
      console.log("MISSING: notes.notebook_id column does not exist yet");
      process.exit(2);
    }
    console.error("Column probe failed:", columnError.message);
    process.exit(1);
  }

  console.log("OK: notebooks table exists");
  console.log(`Notebooks: ${notebookCount ?? 0}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});