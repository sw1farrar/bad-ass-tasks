#!/usr/bin/env node
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
  /https:\/\/([^.]+)\.supabase\.co/
)?.[1];
const token = process.env.SUPABASE_ACCESS_TOKEN;

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
    }
  );
  const body = await r.text();
  console.log(`\n[${label}] ${r.status}`);
  console.log(body);
  return { ok: r.ok, body };
}

await q(
  "triggers",
  `SELECT tgname, tgenabled
   FROM pg_trigger
   WHERE tgrelid = 'public.spatial_ref_sys'::regclass
     AND NOT tgisinternal
   ORDER BY tgname;`
);

await q(
  "function exists",
  `SELECT EXISTS (
     SELECT 1 FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'block_spatial_ref_sys_mutation'
   ) AS fn_exists;`
);

// Mutation should fail (trigger or privilege)
const insert = await q(
  "blocked insert (expect error)",
  `INSERT INTO public.spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text)
   VALUES (-999998, 'TEST', -999998, 'TEST', 'TEST');`
);
if (insert.ok) {
  console.log("\nWARNING: INSERT succeeded — cleaning up and investigating");
  await q(
    "cleanup test row",
    `DELETE FROM public.spatial_ref_sys WHERE srid = -999998;`
  );
} else {
  console.log("\nOK: writes to spatial_ref_sys are blocked.");
}

// SELECT should still work (reference data)
await q(
  "select sample",
  `SELECT srid, auth_name FROM public.spatial_ref_sys WHERE srid = 4326 LIMIT 1;`
);

// Confirm app tables all have RLS
await q(
  "app tables missing RLS (exclude spatial_ref_sys)",
  `SELECT c.relname
   FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
     AND NOT c.relrowsecurity
     AND c.relname <> 'spatial_ref_sys'
   ORDER BY 1;`
);
