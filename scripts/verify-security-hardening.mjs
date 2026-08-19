#!/usr/bin/env node
/**
 * Verify live security hardening after consensus patch.
 * Usage: node scripts/verify-security-hardening.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(ROOT, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

const ref = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(
  /https:\/\/([^.]+)\.supabase\.co/,
)?.[1];
const token = process.env.SUPABASE_ACCESS_TOKEN;

async function q(sql) {
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  const body = await r.text();
  if (!r.ok) throw new Error(`${r.status}: ${body}`);
  return JSON.parse(body);
}

const mapFns = await q(`
SELECT p.proname,
       pg_get_functiondef(p.oid) LIKE '%is_workspace_member%' AS has_membership_check,
       pg_get_functiondef(p.oid) LIKE '%not authorized%' AS has_auth_raise
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'search_map_stores',
    'map_stores_in_geojson',
    'map_stores_in_territory',
    'check_map_territory_overlap',
    'create_workspace_for_user',
    'update_member_role',
    'create_workspace_invite',
    'accept_workspace_invite',
    'search_users_for_invite'
  )
ORDER BY p.proname;
`);

console.log("=== Function hardening ===");
for (const row of mapFns) {
  console.log(
    `- ${row.proname}: membership=${row.has_membership_check} auth_raise=${row.has_auth_raise}`,
  );
}

const triggers = await q(`
SELECT tgname, relname
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
  AND tgname IN (
    'profiles_protect_admin_fields',
    'workspace_list_shares_protect_columns',
    'list_share_invites_protect_recipient',
    'trg_note_attachments_storage_path'
  )
ORDER BY tgname;
`);
console.log("\n=== Protective triggers ===");
for (const row of triggers) {
  console.log(`- ${row.tgname} on ${row.relname}`);
}

const policies = await q(`
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    policyname = 'note_attachments_select'
    OR policyname = 'Owners and admins can remove members'
  )
ORDER BY 1, 2;
`);
console.log("\n=== Key policies ===");
for (const row of policies) {
  console.log(`- ${row.tablename}: ${row.policyname}`);
}

const missingRls = await q(`
SELECT c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
ORDER BY 1;
`);
console.log("\n=== Tables without RLS ===");
console.log(missingRls.map((r) => r.relname).join(", ") || "(none)");
