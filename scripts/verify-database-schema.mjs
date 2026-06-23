#!/usr/bin/env node
/**
 * Full read-only Supabase schema verification (tables, columns, RPC functions).
 * Loads .env.local for NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

  const mod = await import(
    pathToFileURL(path.join(ROOT, "lib/supabase/verifyDatabaseSchema.ts")).href
  );
  const report = await mod.verifyDatabaseSchema();

  console.log(`Connected: ${report.connected}`);
  console.log(`Configured: ${report.configured}`);
  console.log(`Schema OK: ${report.ok}`);
  console.log(`Checked at: ${report.checkedAt}`);
  console.log("");

  if (report.missing.length > 0) {
    console.log("Missing / failed:");
    for (const item of report.missing) console.log(`  - ${item}`);
    console.log("");
  }

  const failed = report.objects.filter((o) => !o.ok);
  const passed = report.objects.filter((o) => o.ok);

  console.log(`Objects checked: ${report.objects.length} (${passed.length} ok, ${failed.length} missing)`);
  console.log("");

  for (const obj of report.objects) {
    const mark = obj.ok ? "OK" : "MISSING";
    const detail = obj.detail ? ` — ${obj.detail}` : "";
    console.log(`[${mark}] ${obj.kind}:${obj.name}${detail}`);
  }

  process.exit(report.ok ? 0 : 2);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
