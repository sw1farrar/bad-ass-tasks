#!/usr/bin/env node
/**
 * List public tables missing RLS on the linked Supabase project.
 * Usage: node scripts/audit-rls.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

loadEnvLocal();
const projectRef = projectRefFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!projectRef || !token) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_ACCESS_TOKEN");
  process.exit(1);
}

const sql = `
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced,
       pg_get_userbyid(c.relowner) AS owner,
       COALESCE(
         (SELECT string_agg(privilege_type, ', ' ORDER BY privilege_type)
          FROM information_schema.role_table_grants g
          WHERE g.table_schema = 'public'
            AND g.table_name = c.relname
            AND g.grantee IN ('anon', 'authenticated', 'PUBLIC')),
         ''
       ) AS grants_to_api_roles
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relrowsecurity ASC, c.relname;
`;

const res = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  }
);

const body = await res.text();
if (!res.ok) {
  console.error(`Query failed (${res.status}): ${body}`);
  process.exit(1);
}

const rows = JSON.parse(body);
const missing = rows.filter((r) => !r.rls_enabled);
const enabled = rows.filter((r) => r.rls_enabled);

console.log(`Project: ${projectRef}`);
console.log(`Public tables: ${rows.length}`);
console.log(`RLS enabled: ${enabled.length}`);
console.log(`RLS DISABLED: ${missing.length}`);
console.log("");
if (missing.length) {
  console.log("=== Tables WITHOUT RLS ===");
  for (const r of missing) {
    console.log(
      `- ${r.table_name} (owner=${r.owner}, grants=${r.grants_to_api_roles || "none"})`
    );
  }
} else {
  console.log("All public tables have RLS enabled.");
}

// Also check mutation-blocking triggers on spatial_ref_sys
const trigSql = `
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'public.spatial_ref_sys'::regclass
  AND NOT tgisinternal
ORDER BY tgname;
`;
const trigRes = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: trigSql }),
  }
);
const trigBody = await trigRes.text();
if (trigRes.ok) {
  console.log("\n=== spatial_ref_sys triggers ===");
  console.log(trigBody);
} else {
  console.log("\nCould not list spatial_ref_sys triggers:", trigBody);
}
