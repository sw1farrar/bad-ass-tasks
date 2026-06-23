#!/usr/bin/env node
/**
 * Safe, idempotent migration: auth_login_events audit table.
 *
 * Requires in .env.local (or shell):
 *   SUPABASE_ACCESS_TOKEN  — https://supabase.com/dashboard/account/tokens
 *   or DATABASE_URL        — Supabase → Settings → Database
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Step 1/3 — verify current schema (read-only)…");
const verifyStatus = spawnSync(
  process.execPath,
  [path.join(ROOT, "scripts/verify-auth-login-events.mjs")],
  { cwd: ROOT, stdio: "inherit", env: process.env },
);

if (verifyStatus.status === 0) {
  console.log("Table already exists — nothing to do.");
  process.exit(0);
}

if (verifyStatus.status !== 2) {
  process.exit(verifyStatus.status ?? 1);
}

console.log("\nStep 2/3 — apply migration…");
runNode(path.join(ROOT, "scripts/apply-supabase-sql.mjs"), [
  "supabase/add-auth-login-events.sql",
]);

console.log("\nStep 3/3 — verify migration succeeded…");
runNode(path.join(ROOT, "scripts/verify-auth-login-events.mjs"));
console.log("\n✓ Migration complete.");