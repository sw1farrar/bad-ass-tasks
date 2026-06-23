#!/usr/bin/env node
/**
 * Apply SQL to the linked Supabase project.
 *
 * Option A (recommended): SUPABASE_ACCESS_TOKEN in env
 *   Create at https://supabase.com/dashboard/account/tokens
 *
 * Option B: DATABASE_URL (direct Postgres connection string from Supabase → Settings → Database)
 *
 * Usage:
 *   node scripts/apply-supabase-sql.mjs supabase/apply-missing-on-live.sql
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

function projectRefFromUrl(url) {
  const match = url?.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] ?? null;
}

function databaseUrlFromPassword(projectRef, password) {
  if (!projectRef || !password) return null;
  const encoded = encodeURIComponent(password);
  return `postgresql://postgres:${encoded}@db.${projectRef}.supabase.co:5432/postgres`;
}

async function applyViaManagementApi(sql, projectRef, token) {
  const statements = sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  console.log(`Applying ${statements.length} statement(s) via Supabase Management API…`);

  for (const [index, query] of statements.entries()) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    const body = await res.text();
    if (!res.ok) {
      throw new Error(`Statement ${index + 1} failed (${res.status}): ${body}`);
    }
    console.log(`  ✓ ${index + 1}/${statements.length}`);
  }
}

async function applyViaPg(sql, databaseUrl) {
  const pg = await import("pg");
  const client = new pg.default.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log("✓ SQL applied via direct Postgres connection");
  } finally {
    await client.end();
  }
}

async function main() {
  loadEnvLocal();

  const sqlFile = process.argv[2] ?? "supabase/apply-missing-on-live.sql";
  const sqlPath = path.isAbsolute(sqlFile) ? sqlFile : path.join(ROOT, sqlFile);
  const sql = fs.readFileSync(sqlPath, "utf8");

  const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  const projectRef =
    process.env.SUPABASE_PROJECT_REF?.trim() ||
    projectRefFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const databaseUrl =
    process.env.DATABASE_URL?.trim() ||
    databaseUrlFromPassword(projectRef, process.env.SUPABASE_DB_PASSWORD?.trim());

  if (accessToken && projectRef) {
    await applyViaManagementApi(sql, projectRef, accessToken);
    return;
  }

  if (databaseUrl) {
    await applyViaPg(sql, databaseUrl);
    return;
  }

  console.error(
    [
      "Cannot apply SQL: missing credentials.",
      "",
      "Add ONE of the following to .env.local (or your shell env):",
      "  SUPABASE_ACCESS_TOKEN=<personal access token from supabase.com/dashboard/account/tokens>",
      "  DATABASE_URL=<postgres connection string from Supabase → Settings → Database>",
      "  SUPABASE_DB_PASSWORD=<database password from Supabase → Settings → Database>",
      "",
      `Project ref detected: ${projectRef ?? "(unknown — set NEXT_PUBLIC_SUPABASE_URL)"}`,
    ].join("\n"),
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});