#!/usr/bin/env node
/**
 * Verify notes.ai_suggestion column exists (read-only).
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

  const { count: noteCountBefore, error: countError } = await supabase
    .from("notes")
    .select("id", { count: "exact", head: true });

  if (countError) {
    console.error("Could not count notes:", countError.message);
    process.exit(1);
  }

  const { data, error } = await supabase
    .from("notes")
    .select("id, ai_suggestion")
    .limit(1);

  if (error) {
    if (error.code === "42703" || /ai_suggestion/i.test(error.message ?? "")) {
      console.log("MISSING: notes.ai_suggestion column does not exist yet");
      console.log(`Notes in database (unchanged): ${noteCountBefore ?? "?"}`);
      process.exit(2);
    }
    console.error("Probe failed:", error.message);
    process.exit(1);
  }

  console.log("OK: notes.ai_suggestion column exists");
  console.log(`Notes in database: ${noteCountBefore ?? "?"}`);
  console.log(`Sample row id: ${data?.[0]?.id ?? "(no notes)"}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});