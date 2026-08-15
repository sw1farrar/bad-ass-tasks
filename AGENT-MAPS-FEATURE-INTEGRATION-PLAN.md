# AGENT-MAPS-FEATURE-INTEGRATION-PLAN.md

**Status:** IMPLEMENTATION COMPLETE (Phases 1–4 landed; apply SQL + Mapbox env to go live)  
**Date:** 2026-07-31  
**Target project:** Bad Ass Tasks (`C:\Users\Steve\dev\Projects\Bad Ass Tasks`)  
**Source project (read-only reference):** Maps / TerritoryMap (`C:\Users\Steve\dev\Projects\maps` or `Maps`)  
**Goal:** Port territory + store mapping into Bad Ass Tasks as an optional per-workspace nav feature. Do **not** port Maps auth/access-codes/sessions.

---

## Why this approach (recommended)

| Option | Verdict |
|--------|---------|
| **A. Implement inside Bad Ass Tasks using this plan + Maps as reference** | **Best.** Correct git root, conventions, tests, Supabase, and nav patterns live here. |
| B. Keep working from the Maps workspace and push files into BAT | Worse. Easy to miss BAT conventions; wrong default cwd for builds/tests. |
| C. Keep two separate apps and deep-link | Rejected by product intent — one app, optional feature per workspace. |

**How you should work next**

1. Open **Bad Ass Tasks** as the Grok/Cursor workspace (this folder).
2. Keep this file open; treat Maps as a **reference tree only** (copy patterns, do not merge auth).
3. Implement in **phases** below so each phase is shippable and testable.
4. Leave the standalone Maps app alone until the feature is live here; then retire or archive Maps.

---

## Product intent (confirmed)

- Users already log into **Bad Ass Tasks** and pick a **workspace**.
- **Map** (territories + stores) is an optional module, like **Notes** and **Health**.
- Each workspace’s **Settings** page can turn the feature **on/off**.
- When on → a **Map** item appears in sidebar + bottom nav for that workspace.
- When off → no nav item; map routes/views should not be active for that workspace.
- **No** Maps access-code login, master code, JWT cookie session, or access-code admin UI.

---

## Existing BAT patterns to copy (do not invent a second system)

### Feature flags (JSON on `workspaces.settings`)

Canonical module: `lib/workspace/workspaceSettings.ts`

Today:

```ts
features?: {
  notesEnabled?: boolean;   // default false
  healthEnabled?: boolean;  // default false
  notebookSections?: ...
}
```

**Add:**

```ts
/** When true, shows Map nav and territory/store workspace. */
mapsEnabled?: boolean;  // default false
```

Helpers to add (mirror health/notes):

- `isMapsFeatureEnabled(settings)`
- parse + merge support in `parseWorkspaceSettings` / `mergeWorkspaceSettings`
- unit tests in `tests/workspaceSettings.test.ts`

### Navigation

File: `lib/nav/workspaceViews.ts`

- Extend `WorkspaceNavViewId` with `"map"` (or `"maps"` — pick one and use everywhere).
- Add view: `{ id: "map", label: "Map", icon: MapPinned }` (lucide).
- In `isViewVisible`: `if (id === "map") return isMapsFeatureEnabled(workspace.settings);`

### Settings UI

File: `features/settings/WorkspaceSettingsView.tsx`

- Owner-only panel (same as Notes/Health).
- Checkbox → `updateWorkspaceDetails({ settings: { features: { mapsEnabled: checked } } })`.
- Copy/adapt the Health panel block (~lines 296–321).

### Main shell view switch

File: `app/page.tsx` (large; search `case "health":`)

- Import `MapsView` (or `MapWorkspaceView`) from `features/maps`.
- `case "map": return <MapsView workspaceId={...} ... />;`
- Guard: if feature off, fall back to home (same idea as chat when `showWorkspaceChat` is false).

### Feature module layout (mirror Health)

```
features/maps/
  index.ts
  MapsView.tsx
  maps-workspace.css          # optional; prefer reusing glass/neon tokens
  components/
    TerritoryMap.tsx          # from Maps (adapt)
    LayerPanel.tsx
    StorePanel.tsx
    TerritoryPanel.tsx
    SearchBar.tsx
    SnapControls.tsx
    CsvImportDialog.tsx
  ...
lib/maps/                     # domain helpers (geo, constants, validations)
  constants.ts
  types.ts
  geo.ts
  map-styles.ts
  validations.ts
app/api/maps/                 # workspace-scoped API routes
  stores/route.ts
  stores/[id]/route.ts
  stores/import/route.ts
  territories/route.ts
  territories/[id]/route.ts
  territories/check-overlap/route.ts
  geocode/route.ts
supabase/
  add-maps-territories-stores.sql
```

### Auth for APIs (BAT style — not Maps)

Maps uses access-code JWT cookies + service role.

BAT should use:

- Existing Supabase session / workspace membership checks (see other `app/api/*` routes and hybridStore guards).
- Prefer **workspace member RLS** on new tables (`is_workspace_member(workspace_id, auth.uid())`) like `add-health-readings.sql`.
- Actor fields: `auth.users` / profile ids — **not** `access_codes`.

---

## What to port from Maps

### Port (product)

| Area | Source (Maps) | Notes |
|------|----------------|-------|
| Map shell UI | `src/app/map/page.tsx` | Strip logout, access-code admin, theme chrome that duplicates BAT chrome |
| Mapbox map + draw | `src/components/map/TerritoryMap.tsx` | Keep dynamic `ssr: false` import |
| Layers / search / snap | `LayerPanel`, `SearchBar`, `SnapControls` | |
| Store CRUD panel | `StorePanel.tsx` | |
| Territory CRUD panel | `TerritoryPanel.tsx` | |
| CSV import | `CsvImportDialog.tsx` | |
| Data hook patterns | `src/hooks/use-map-data.ts` | Re-auth with BAT session/workspace |
| Domain types | `src/lib/types.ts` | Drop `AccessCode`, `SessionUser` |
| Constants | `src/lib/constants.ts` | **Drop** `MASTER_CODE`, `SESSION_*` |
| Geo helpers | `src/lib/geo.ts`, `map-styles.ts`, `validations.ts` | |
| Geocode | `src/lib/geocode.ts` + `api/geocode` | Need Mapbox token in BAT env |
| Overlap RPC usage | `api/territories/check-overlap` | Scope by `workspace_id` |
| Store/territory CRUD APIs | `api/stores/*`, `api/territories/*` | Reimplement with BAT auth |

### Do **not** port

| Area | Source | Why |
|------|--------|-----|
| Access codes | `api/auth/*`, `api/codes/*`, `AccessCodesPanel` | BAT has real auth |
| Login pages / middleware for codes | `login/`, Maps `middleware.ts` | |
| Session cookies / jose JWT | `lib/session.ts`, `lib/auth.ts` | |
| Maps-only audit admin UI | `AuditPanel` optional later | BAT has activity logs; optional phase 4 |
| shadcn tree wholesale | `components/ui/*` | Prefer BAT UI/glass patterns; import only what Maps map UI truly needs |
| Separate Supabase project assumption | Maps `.env` | Prefer **same** BAT Supabase project + additive migration |

### Dependencies to add in BAT `package.json` (as needed)

Maps uses (BAT likely lacks):

- `mapbox-gl`
- `@mapbox/mapbox-gl-draw`
- `@turf/turf`
- `papaparse` (CSV)
- types: `@types/mapbox-gl`, `@types/mapbox__mapbox-gl-draw`, `@types/geojson`, `@types/papaparse`

Do **not** add: `bcryptjs`, `jose` (Maps auth only).

Env (BAT `.env.local` / Vercel):

```
NEXT_PUBLIC_MAPBOX_TOKEN=...
```

(Mapbox geocoding/server may need a secret token later; start with public token like Maps.)

---

## Database design (critical)

### Additive migration (new file)

`supabase/add-maps-territories-stores.sql`

**Requirements vs Maps schema:**

1. Enable PostGIS if not already: `CREATE EXTENSION IF NOT EXISTS postgis;`
2. Tables **must** include `workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE`.
3. Drop FKs to `access_codes`. Use `created_by` / `updated_by` → `auth.users(id)` (nullable OK).
4. RLS: members can CRUD rows in their workspaces (mirror health).
5. Overlap RPC must filter by **same workspace** + same `territory_type`.
6. `stores_in_territory` / `stores_in_geojson` / `search_stores` must take `workspace_id` (or derive from territory).

### Suggested tables

**`map_stores`** (prefix `map_` to avoid generic name clashes) **or** `stores` if unused in BAT — **check live schema first**. Prefer:

- `map_stores`
- `map_territories`

Columns (from Maps, plus workspace):

**map_stores:**  
`id`, `workspace_id`, `name`, `store_number`, `address`, `city`, `state`, `postal_code`, `country`, `latitude`, `longitude`, `location` geography(Point), `mission_types text[]`, `notes`, `status`, timestamps, created_by/updated_by.

**map_territories:**  
`id`, `workspace_id`, `name`, `territory_type`, `geometry` geography(MultiPolygon), `geojson jsonb`, `color`, `notes`, `status`, `assigned_person`, timestamps, created_by/updated_by.

Triggers from Maps (adapt names):

- `set_updated_at` (BAT may already have one — reuse if present)
- `sync_store_location` from lat/lng
- `sync_territory_geometry` from geojson

RPCs (workspace-scoped):

- `check_map_territory_overlap(p_workspace_id, p_geojson, p_territory_type, p_exclude_id)`
- `map_stores_in_territory(p_territory_id)`
- `map_stores_in_geojson(p_workspace_id, p_geojson)`
- `search_map_stores(p_workspace_id, p_query)`

### Feature flag storage

No migration required for the toggle if `workspaces.settings` is already JSONB (it is).  
`mapsEnabled` lives under `settings.features` like health/notes.

### Types

Update `types/supabase.ts` and domain types after migration shape is fixed.

---

## API design

All routes require authenticated user + membership in `workspaceId`.

Suggested query/body always includes `workspaceId` (or path prefix `/api/workspaces/[workspaceId]/maps/...` — match whatever BAT already does for similar features).

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/maps/stores` | List/create (filter `workspaceId`) |
| GET/PATCH/DELETE | `/api/maps/stores/[id]` | |
| POST | `/api/maps/stores/import` | CSV |
| GET/POST | `/api/maps/territories` | |
| GET/PATCH/DELETE | `/api/maps/territories/[id]` | |
| POST | `/api/maps/territories/check-overlap` | |
| GET/POST | `/api/maps/geocode` | Mapbox proxy if needed |

Server: validate with zod (Maps `validations.ts` is a good start).  
Return 403 if not a member; 404 if row’s `workspace_id` mismatches.

Optional later: hybridStore helpers if the rest of BAT prefers store-layer data access over raw fetch from the view.

---

## UI / UX integration notes

- **Chrome:** Maps view should fill the main content area under BAT layout (sidebar/bottom nav already present). Remove Maps’ top bar logout / access-code settings.
- **Styling:** Prefer BAT glass / neon tokens (`border-border-glass`, `text-neon-purple`, etc.) over porting full shadcn theme. Mapbox canvas can stay full-bleed inside the content pane.
- **Permissions:** Start with any workspace **member** can edit map data (like Health). If owners-only later, gate in API + UI.
- **Empty state:** When `mapsEnabled` but zero stores/territories, show short onboarding (import CSV / draw territory).
- **Mobile:** Map + side panels are desktop-heavy; phase 1 can be “usable on mobile with stacked panels,” polish later.

---

## Implementation phases (do in order)

### Phase 0 — Spike / verify (30–60 min)

- [x] Prefer `map_stores` / `map_territories` (no name clash in BAT).
- [x] `NEXT_PUBLIC_MAPBOX_TOKEN` documented in `.env.example`.
- [x] Install Mapbox-related deps (`mapbox-gl`, draw, turf, papaparse, zod + types).
- [ ] Confirm PostGIS on live Supabase when applying migration (hosted Supabase usually yes).

### Phase 1 — Feature flag + empty nav shell (smallest ship)

- [x] `mapsEnabled` in `workspaceSettings.ts` + tests
- [x] Nav view `map` gated in `workspaceViews.ts`
- [x] Settings toggle (owner) in `WorkspaceSettingsView.tsx`
- [x] `features/maps/MapsView.tsx` (full map shell after Phase 3)
- [x] `app/page.tsx` case `"map"`
- [x] Store/nav guards mirror Health

**Exit criteria:** Flag works end-to-end with no DB map tables yet. ✅

### Phase 2 — Schema + read/write APIs

- [x] Write `supabase/add-maps-territories-stores.sql` (workspace-scoped + RLS + RPCs)
- [x] Types in `types/supabase.ts` + domain types under `lib/maps/`
- [x] API routes under `app/api/maps/**` with membership checks (no access codes)
- [ ] Apply SQL on dev Supabase (`node scripts/apply-supabase-sql.mjs supabase/add-maps-territories-stores.sql`)
- [ ] Smoke: create store, create territory, overlap reject for same type

### Phase 3 — Port map UI and wire to APIs

- [x] Port/adapt map components under `features/maps/`
- [x] Wire data loading to current `workspaceId`
- [x] Store panel, territory panel, layers, snap, search
- [x] CSV import
- [x] Dynamic import TerritoryMap with `ssr: false`
- [x] Restyle to BAT glass/neon; strip Maps chrome (logout, access codes)

### Phase 4 — Hardening (as needed)

- [ ] Activity log entries for map mutations (deferred)
- [ ] Realtime refresh (deferred)
- [x] Vitest for `mapsEnabled` workspace settings
- [x] `.env.example` Mapbox token
- [ ] Set `NEXT_PUBLIC_MAPBOX_TOKEN` on Vercel when deploying Maps
- [ ] Archive standalone Maps project when BAT map is trusted

---

## Source file index (Maps → BAT)

Use absolute paths when reading from the Maps project:

```
C:\Users\Steve\dev\Projects\maps\src\app\map\page.tsx
C:\Users\Steve\dev\Projects\maps\src\components\map\TerritoryMap.tsx
C:\Users\Steve\dev\Projects\maps\src\components\map\StorePanel.tsx
C:\Users\Steve\dev\Projects\maps\src\components\map\TerritoryPanel.tsx
C:\Users\Steve\dev\Projects\maps\src\components\map\LayerPanel.tsx
C:\Users\Steve\dev\Projects\maps\src\components\map\SearchBar.tsx
C:\Users\Steve\dev\Projects\maps\src\components\map\SnapControls.tsx
C:\Users\Steve\dev\Projects\maps\src\components\map\CsvImportDialog.tsx
C:\Users\Steve\dev\Projects\maps\src\hooks\use-map-data.ts
C:\Users\Steve\dev\Projects\maps\src\lib\types.ts
C:\Users\Steve\dev\Projects\maps\src\lib\constants.ts
C:\Users\Steve\dev\Projects\maps\src\lib\geo.ts
C:\Users\Steve\dev\Projects\maps\src\lib\geocode.ts
C:\Users\Steve\dev\Projects\maps\src\lib\map-styles.ts
C:\Users\Steve\dev\Projects\maps\src\lib\validations.ts
C:\Users\Steve\dev\Projects\maps\src\app\api\stores\
C:\Users\Steve\dev\Projects\maps\src\app\api\territories\
C:\Users\Steve\dev\Projects\maps\src\app\api\geocode\
C:\Users\Steve\dev\Projects\maps\supabase\migrations\001_initial.sql
```

**Do not copy:**

```
C:\Users\Steve\dev\Projects\maps\src\app\login\
C:\Users\Steve\dev\Projects\maps\src\app\api\auth\
C:\Users\Steve\dev\Projects\maps\src\app\api\codes\
C:\Users\Steve\dev\Projects\maps\src\components\admin\AccessCodesPanel.tsx
C:\Users\Steve\dev\Projects\maps\src\lib\auth.ts
C:\Users\Steve\dev\Projects\maps\src\lib\session.ts
C:\Users\Steve\dev\Projects\maps\src\middleware.ts
```

BAT touchpoints (must edit):

```
lib/workspace/workspaceSettings.ts
lib/nav/workspaceViews.ts
features/settings/WorkspaceSettingsView.tsx
app/page.tsx
tests/workspaceSettings.test.ts
package.json
.env.example (if present)
supabase/add-maps-territories-stores.sql   (new)
features/maps/**                           (new)
app/api/maps/**                            (new)
lib/maps/**                                (new)
```

---

## Acceptance criteria (definition of done)

1. Workspace A enables Map → nav shows Map; workspace B with flag off does not.
2. Owner can toggle in Workspace Settings; non-owners follow existing Notes/Health rules (owner-only toggles).
3. With feature on, user can create/edit/archive territories and stores on a Mapbox map.
4. Same `territory_type` polygons cannot overlap within a workspace; different types may.
5. No access-code UI or Maps session cookies exist in BAT.
6. Data is isolated by `workspace_id` (RLS + API checks).
7. App builds (`npm run build` or project’s typecheck/test scripts) without Mapbox SSR crashes.

---

## Risks & decisions

| Risk | Mitigation |
|------|------------|
| PostGIS not enabled on project | Phase 0 check; enable extension early |
| Mapbox bundle size / SSR | dynamic import + `ssr: false`; import CSS once in MapsView |
| Naming collision `stores` | Prefer `map_stores` / `map_territories` |
| `app/page.tsx` is huge | Minimal case branch; keep UI in `features/maps` |
| Territory type list is paint-business specific | Keep Maps constants for v1; later make configurable per workspace if needed |
| Two Supabase projects | Prefer one BAT project + migration; do not dual-write to Maps DB |

**Open product decisions (defaults if unspecified):**

- Nav label: **Map** (id: `map`)
- Flag key: **`mapsEnabled`**
- Who can edit map data: **all workspace members** (v1)
- Audit UI: **defer** (use BAT activity later if desired)

---

## Agent start prompt (paste when working in Bad Ass Tasks)

```
Implement Phase 1 of AGENT-MAPS-FEATURE-INTEGRATION-PLAN.md:
mapsEnabled workspace feature flag, settings toggle, nav item, and MapsView placeholder.
Follow Notes/Health patterns exactly. Do not port Maps auth. Do not start Phase 2 until Phase 1 works.
Reference maps source only at C:\Users\Steve\dev\Projects\maps for later phases.
```

Then for Phase 2:

```
Continue AGENT-MAPS-FEATURE-INTEGRATION-PLAN.md Phase 2: workspace-scoped PostGIS tables + RLS + APIs.
```

Then Phase 3:

```
Continue AGENT-MAPS-FEATURE-INTEGRATION-PLAN.md Phase 3: port map UI from maps project and wire to BAT APIs.
```

---

## Progress log

| Phase | Status | Date | Notes |
|-------|--------|------|-------|
| 0 Spike | complete | 2026-07-31 | map_* table names; Mapbox deps installed; env documented |
| 1 Flag + nav shell | complete | 2026-07-31 | mapsEnabled, nav, owner toggle, store guards |
| 2 Schema + APIs | complete (code) | 2026-07-31 | SQL + RLS + RPCs + `/api/maps/**`; apply SQL on Supabase still required |
| 3 Map UI port | complete | 2026-07-31 | TerritoryMap + panels + CSV; workspace-scoped; BAT styling |
| 4 Hardening | partial | 2026-07-31 | env example + settings tests; activity logs / realtime deferred |

*(Update this table as work lands.)*
