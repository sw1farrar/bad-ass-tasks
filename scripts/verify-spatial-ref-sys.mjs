#!/usr/bin/env node
/**
 * Confirm PostGIS spatial_ref_sys is not in public (so Security Advisor
 * rls_disabled_in_public will not email about it).
 * Usage: node scripts/verify-spatial-ref-sys.mjs
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
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function q(label, sql) {
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
  console.log(`\n[${label}] ${r.status}`);
  console.log(body);
  if (!r.ok) throw new Error(`${label} failed: ${body}`);
  return JSON.parse(body);
}

const loc = await q(
  "spatial_ref_sys location",
  `SELECT n.nspname AS schema, c.relname, c.relrowsecurity
   FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE c.relname = 'spatial_ref_sys' AND c.relkind = 'r';`,
);
if (loc.some((r) => r.schema === "public")) {
  throw new Error("FAIL: spatial_ref_sys is still in public");
}
if (!loc.some((r) => r.schema === "extensions")) {
  throw new Error("FAIL: spatial_ref_sys missing from extensions");
}
console.log("OK: spatial_ref_sys is in extensions, not public.");

const missing = await q(
  "public tables missing RLS",
  `SELECT c.relname
   FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
   ORDER BY 1;`,
);
if (missing.length) {
  throw new Error(`FAIL: public tables without RLS: ${missing.map((r) => r.relname).join(", ")}`);
}
console.log("OK: every public table has RLS enabled.");

await q(
  "srid 4326",
  `SELECT srid, auth_name FROM extensions.spatial_ref_sys WHERE srid = 4326 LIMIT 1;`,
);

const rest = await fetch(`${url}/rest/v1/spatial_ref_sys?select=srid&limit=1`, {
  headers: { apikey: anon, Authorization: `Bearer ${anon}` },
});
const restBody = await rest.text();
console.log(`\n[REST spatial_ref_sys] ${rest.status}`);
console.log(restBody);
if (rest.status !== 404) {
  throw new Error(`FAIL: Data API still exposes spatial_ref_sys (${rest.status})`);
}
console.log("OK: Data API does not expose spatial_ref_sys.");
