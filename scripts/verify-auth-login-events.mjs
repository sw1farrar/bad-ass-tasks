#!/usr/bin/env node
/**
 * Verify auth_login_events table exists (read-only).
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

  const { data, count, error } = await supabase
    .from("auth_login_events")
    .select("id, event_type, email, ip_address, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    if (
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      /auth_login_events/i.test(error.message ?? "")
    ) {
      console.log("MISSING: auth_login_events table does not exist yet");
      process.exit(2);
    }
    console.error("Probe failed:", error.message);
    process.exit(1);
  }

  console.log("OK: auth_login_events table exists");
  console.log(`Rows: ${count ?? 0}`);
  if (data?.[0]) {
    console.log(`Latest event: ${data[0].event_type} @ ${data[0].created_at}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});