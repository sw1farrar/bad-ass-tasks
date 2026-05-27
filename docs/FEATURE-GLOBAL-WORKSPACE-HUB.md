# Feature Design: Global Workspace Hub ("Life Overview")

**Date:** 2026-05-27  
**Status:** Approved — Implementation Started (May 2026)  
**Requested by:** User  
**Context:** The app already supports multiple workspaces for different teams/areas of life. Users want a single, seamless place that shows "everything I have going on" across all of them.

---

## 1. Vision & Goals

**Core Problem:**  
When a user has 3–8 workspaces (Personal, Startup, Client A, Family, Health, Side Project...), switching constantly to check "what's urgent?" creates friction and mental load. They lose the forest for the trees.

**Goal:**  
Create a **calm, high-signal "single source of truth"** that gives the user an at-a-glance understanding of their entire life/work without forcing them to context-switch.

**Design Principles (Non-negotiable):**
- **Simple first, powerful second.** Never overwhelming.
- **Seamless.** Feels like a natural extension of the existing workspace system, not a bolted-on dashboard.
- **Respectful of attention.** Prioritizes what's actually actionable today/overdue.
- **Workspace-aware but not workspace-bound.** Clearly shows *which* workspace something belongs to, with one-tap navigation.
- **Mobile-friendly** (thumb-friendly, not information-dense walls of text).
- **AI-augmented but not AI-dependent.** The AI summary is a delight, not the only way to understand the state.
- **Hybrid-safe.** Must work beautifully in both demo and live modes.

---

## 2. Suggested Names (Ranked)

| Name                  | Pros                                      | Cons                              | Recommendation |
|-----------------------|-------------------------------------------|-----------------------------------|----------------|
| **Overview**          | Clean, familiar, not flashy               | Generic                           | **Strong** |
| **Hub**               | Modern, implies "central command"         | Can feel techy                    | Good |
| **Life**              | Emotional, implies personal + professional| Slightly vague                    | Interesting |
| **Today Across Everything** | Extremely clear intent               | Too long for nav                  | Too literal |
| **Command Center**    | Powerful, matches Command Palette energy  | Can feel corporate/military       | Avoid |
| **All Workspaces**    | Descriptive                               | Not inspiring                     | Fallback |

**My top recommendation:** **"Overview"**

It feels native (many great apps use this), is humble, and pairs beautifully with "Today" (you can have both a focused Today per workspace *and* a global Overview).

Alternative strong contender: **"Hub"** (especially if we lean into the AI + Graph magic).

---

## 3. Proposed Information Architecture (MVP)

The hub should feel like a **smart briefing**, not a data dump.

### MVP Sections (in priority order)

1. **"What matters right now"** (Hero section)
   - AI-generated one-sentence summary across all workspaces (e.g., "3 P0s due today across Personal and Startup. 2 client deadlines this week.")
   - Big, calm numbers: 
     - Tasks due today or overdue (total + breakdown by workspace)
     - Items you're mentioned in or assigned to

2. **Today's Focus** (actionable list)
   - Grouped by workspace (with colored workspace pills/badges)
   - Top 5–8 most important items across everything (using existing priority + due logic)
   - Quick complete + "Go to workspace" actions

3. **Recent Movement** (lightweight activity)
   - Last 10–15 meaningful events across all workspaces
   - Each entry shows: Workspace badge + action + who + time
   - Clickable to jump to the item (which switches workspace automatically)

4. **Workspace Pulse** (at-a-glance health)
   - Horizontal scrollable (or grid on desktop) cards for each workspace:
     - Workspace name + role
     - # tasks due soon / overdue
     - Recent activity count
     - "Open" button (switches context)

### Nice-to-Have (Post-MVP)

- Upcoming week calendar view across workspaces
- "Stale" workspaces (ones you haven't touched in X days)
- AI "Weekly Review" button that summarizes progress across all areas
- Quick "Create in any workspace" from the hub

---

## 4. Navigation & Placement Recommendations (Revised per Clarification)

**User Clarification (May 2026):**  
Home should **not** sit above the workspace switcher in the top bar. On desktop, it should live in the sidebar **above the "WORKSPACE" label**, which itself sits directly above the name of the currently active workspace.

### Revised Recommendation

**Primary Name:** **Home**

#### Desktop Sidebar Visual Hierarchy (Recommended)

From top → bottom in the sidebar:

1. **Home** (new persistent top-level navigation item)
2. **WORKSPACE** (the existing small uppercase label)
3. [Name of the currently active workspace + role badge]
4. The workspace-specific navigation items (Tasks, Notes, Calendar, Teams...)

The **workspace switcher dropdown** remains in the top bar (next to the logo), exactly as it is today.

**Behavior when "Home" is the active view:**
- The sidebar can still display the "WORKSPACE" section and the current workspace name (useful for quick reference and switching).
- The per-workspace navigation items below can be shown in a subdued state or hidden.
- Tapping any workspace-specific item while viewing Home should switch the user into that workspace and navigate to the chosen view.

#### Mobile Bottom Navigation

- Replace the first tab position (currently "Today") with **Home**.
- Once the user enters a specific workspace, the bottom nav shows the relevant workspace views, with an easy way to return to Home.

**Supporting Access Points:**
- Add **"Home — All Workspaces"** as the top option inside the workspace switcher dropdown.
- Add a strong Command Palette action: "Go to Home".
- When in Home, the top bar can display a light indicator (e.g. "All workspaces" or a subtle global state).

This structure treats Home as a true meta-layer for the user's entire set of workspaces while respecting the existing placement of the workspace switcher in the top bar.

---

## 5. Data & Architecture Considerations

This is where being considerate matters most.

### Current Reality
- Almost all data fetching and realtime is scoped to `currentWorkspace`.
- `switchWorkspace()` deliberately clears and re-initializes per-workspace state (members, onlineUsers, realtime channels).
- Activity, tasks, notes are fetched via `getRecentActivity(workspaceId)`, etc.

### Recommended Architecture

**Do not** try to load *everything* from all workspaces into the main store at once (performance + complexity disaster).

Instead:

1. **New lightweight global layer**
   - Add new store methods:
     - `fetchGlobalOverview()` — aggregates key stats + today's items + recent activity across *all* workspaces the user belongs to.
     - `getGlobalRecentActivity(limit)`
     - `getGlobalTodayTasks()`
   - These should be **separate** from the per-workspace `tasks`/`recentActivity` slices.

2. **Hybrid Store additions**
   - Create `getGlobalRecentActivity(userId)` that:
     - First fetches all workspaces the user belongs to (`workspace_members`).
     - Then queries `activity_logs` with `WHERE workspace_id IN (...)`.
   - Similar pattern for "tasks due today across my workspaces".

3. **Realtime Strategy**
   - When in Overview mode, we probably **don't** want full realtime subscriptions to every workspace (too many channels, battery, noise).
   - Better approaches:
     - Poll lightly for overview stats (every 60–90s) when the hub is visible.
     - Or use a single "user-level" notification channel for cross-workspace events.
     - When the user taps into a specific item from the hub, we switch workspace (which sets up proper realtime for that workspace).

4. **Performance Safeguards**
   - Limit global queries aggressively (e.g., only last 30 days of activity, only top 3 workspaces for certain stats).
   - Cache global overview results in memory + localStorage with short TTL.
   - Show "last updated" timestamp.

5. **Demo vs Live**
   - In demo mode (w1/w2), we can synthesize a nice multi-workspace experience using the existing sample data + the simulator.

---

## 6. Mobile Experience

- The hub must feel **lighter** than individual workspace views.
- Use generous whitespace but avoid the "sparse" problem we saw in the recent screenshot.
- Workspace badges should be very scannable (small colored pills with initials or short names).
- "Jump to workspace" should feel instant and satisfying (with nice transition).

---

## 7. AI Opportunities (This Feature Is a Natural Home)

This is one of the best places in the entire app for AI to shine:

- **Global Daily Briefing** ("Across all your workspaces, here are the 5 things that actually matter today...")
- **Cross-workspace conflict detection** ("You have a P0 in Personal and a client deadline in Startup on the same day.")
- **Weekly Life Review** button.
- Smart prioritization that considers context from multiple areas of life.

We should wire the existing `generateDailyBriefingAI` / weekly functions to accept data from multiple workspaces.

---

## 8. Implementation Phasing (Recommended)

**Phase A – MVP (High value, contained)**
- New Overview view (empty state first).
- Basic stats across workspaces.
- Today's items grouped by workspace.
- Recent activity across workspaces (read-only).
- Workspace pulse cards.
- Basic AI summary (even if it just says "You have activity in 4 workspaces").

**Phase B**
- Make items in the hub clickable (auto switch workspace + deep link to the item).
- Better realtime hints ("New activity in Startup").
- Polish on mobile + density.

**Phase C**
- Advanced AI insights.
- Upcoming calendar across workspaces.
- "Focus mode" that temporarily hides less important workspaces.

---

## 9. My Strongest Recommendation

Build **"Overview"** as a new primary view that sits *above* the per-workspace navigation.

Make it the default landing experience for users who have created or joined more than one workspace.

Start extremely simple:
1. List of workspaces with basic pulse.
2. Today's most important items across everything.
3. One excellent AI summary.
4. Recent movement.

This single screen can dramatically increase the perceived value of the multi-workspace feature.

---

## 10. Open Questions for Discussion

1. Should Overview replace "Today" in the bottom nav for multi-workspace users, or live alongside it?
2. How aggressive should we be with AI in the first version?
3. Do we want any "write" capabilities from the hub (quick add that lets you choose workspace), or read-only at first?
4. Naming preference: Overview vs Hub vs something else?
5. Should there be a way to "star" or "pin" important workspaces so they rise to the top in the hub?

---

Would you like me to:
- Turn this into a more detailed technical implementation plan (with specific store methods, component breakdown, etc.)?
- Adjust any of the recommendations above based on your preferences?
- Explore specific technical risks in more depth (e.g., realtime strategy or query performance)?

I'm ready to refine this until it feels exactly right.