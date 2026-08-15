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
  /https:\/\/([^.]+)\.supabase\.co/,
)?.[1];
const token = process.env.SUPABASE_ACCESS_TOKEN;

const sql = `
SELECT p.proname,
  (pg_get_functiondef(p.oid) LIKE '%Cannot invite as owner%') AS block_owner_invite,
  (pg_get_functiondef(p.oid) LIKE '%Use transfer_workspace_ownership%') AS block_owner_role,
  (pg_get_functiondef(p.oid) LIKE '%Not authorized to create workspace%') AS bind_create_ws,
  (pg_get_functiondef(p.oid) LIKE '%DO NOTHING%') AS no_reaccept_upgrade,
  (pg_get_functiondef(p.oid) LIKE '%Invalid invite role%') AS reject_owner_accept,
  (pg_get_functiondef(p.oid) LIKE '%length(term) < 2%') AS min_search_len,
  (pg_get_functiondef(p.oid) LIKE '%invited_user_id IS NOT NULL AND v_invite.invited_user_id = auth.uid()%') AS null_safe_list_share,
  (pg_get_functiondef(p.oid) LIKE '%Admins cannot change owner or admin roles%') AS admin_scope
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'create_workspace_invite',
    'update_member_role',
    'create_workspace_for_user',
    'accept_workspace_invite',
    'search_users_for_invite',
    'accept_list_share_invite'
  )
ORDER BY 1;
`;

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
if (!r.ok) {
  console.error(body);
  process.exit(1);
}
console.log(JSON.stringify(JSON.parse(body), null, 2));
