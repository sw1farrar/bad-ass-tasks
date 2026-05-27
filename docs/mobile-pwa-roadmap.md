# Mobile & PWA Roadmap — Bad Ass Tasks

**Agent 10 (Mobile & PWA Foundation Specialist) — Phase 8 Foundation**

**Date:** 2026-05-25  
**Status:** Foundations delivered. Demo remains excellent on narrow viewports. Desktop untouched.

## What Was Delivered (Strong Foundations)

- **Responsive & Touch-Friendly Base**
  - Expanded mobile CSS in `app/globals.css` (prototype media query upgraded): 44px+ touch targets, safe-area-inset support for notches/home indicator, `.main-content` padding for bottom nav, reduced-motion + perf guards for low-end devices, Kanban tightening on phones.
  - Added `.bottom-nav`, `.bottom-nav-item`, `.fab` component styles (native feel, active scales, neon accents).
  - Minor className enhancements in `app/page.tsx` (`.top-bar`, `.main-content`, `.ai-fab`, hiding long floating quick-add on mobile).
  - Touch improvements in `components/TaskModal.tsx` (larger 44px close/delete buttons + active:scale).

- **Native-Like Mobile Shell**
  - **Bottom Navigation** (`app/page.tsx`): Fixed, glassmorphic, 5-item bar (reuses `VIEWS` + `setView` from Zustand). Icons + labels. Active neon state. Keyboard accessible. Only visible <768px. Perfectly mirrors sidebar on desktop.
  - **Floating Action Button (FAB)**: 56px neon-purple right-fixed (above nav via CSS + env safe-area). Wires directly to existing `handleAddFromNatural` (prompt + natural language task creation + auto-switch to Tasks). Hidden on desktop. Premium shadow + press feedback.
  - Existing floating elements (AI button, quick-add bar, Supabase banner) repositioned/adjusted via CSS + classes to avoid collisions.
  - Top bar compaction, main padding, and hidden elements already present were leveraged (no heavy rewrites).

- **Proper PWA Support**
  - `public/manifest.json` fully upgraded: real generated icons (jpg fallbacks via image_gen + copy), shortcuts (Today/Tasks), screenshots stub, orientation, categories, maskable icons, immutable caching hints.
  - `app/layout.tsx`: Added explicit `viewport` (device-width, viewportFit: cover) + `themeColor`.
  - `public/sw.js`: New basic service worker for offline app shell (install/activate/fetch with cache-first for static + network fallback to `/`). Registered from `page.tsx`.
  - `next.config.ts`: Enhanced PWA headers (proper SW no-cache + immutable icons/manifest).
  - **Install Prompt Logic + UI** (in `app/page.tsx`): Full `beforeinstallprompt` capture, deferred prompt handling, `handleInstallApp`. Visible "Install" button (with Download icon) in top bar when eligible (naturally prominent on mobile). Toast on success. Dismiss handled automatically by platform.
  - `app/page.tsx` + layout: SW registration + all wiring. Works in demo (Zustand) and LIVE (hybrid).

- **Performance for Low-End**
  - Global `prefers-reduced-motion` kill-switch in CSS (disables all animations/transitions).
  - Existing Tailwind/Next optimizations (package imports for lucide/framer/dnd) + new SW caching.
  - FAB/nav use transform + CSS transitions (GPU friendly). No new heavy deps or re-renders introduced.
  - Demo mode (pure client) remains buttery on simulated phones.

All changes are additive/responsive-gated (`md:hidden`, `@media max-768`, Tailwind responsive). **Zero breakage to desktop, data layer (hybridStore/useTaskStore), or existing flows.** Server on :3001 stays clean.

## Full Vision (from bad-ass-tasks-prompt.md)

The app **must feel exceptional on phones** — better than 95% of native apps. Mobile is first-class, not afterthought.

**Core Mobile UI Principles (Implemented Foundation + Next):**
- Adaptive: Desktop = sidebar + right panel. **Mobile = bottom nav (Today/Tasks/Notes/Teams) + FAB** (done).
- **Bottom Sheet Modals** for details (task/note/filters): drag-to-dismiss, snap points (current: centered modals + TaskModal — upgrade needed).
- Touch targets: 44x44px minimum everywhere (strong start in CSS + modal; audit remaining).
- Smart keyboard avoidance, iOS "Done" etc.

## Gestures & Haptics (Deferred — Full Native-Like Path)

This agent delivered **basics only**. Full gestures/haptics require dedicated work (avoided per scope to not rewrite core task rows/kanban/dnd).

**What is needed for production-grade native feel:**

1. **Swipe Gestures on Task Rows/Cards**
   - Use Framer Motion `<motion.div>` + `drag="x"`, `dragConstraints`, `onDragEnd` to detect left/right.
   - Left swipe → complete (with confetti + optimistic store update).
   - Right swipe → actions sheet (Snooze / Delete / Move status / Assign).
   - Thresholds + spring physics for butter.
   - Wire to existing `completeTask`, `deleteTask`, `updateTask` (already optimistic in hybridStore).
   - Visual: animated background reveals (check icon green, trash pink).

2. **Long Press / Context Menus**
   - `onLongPress` or pointer events + Framer.
   - iOS-style action sheet (use existing sheet animation or Radix + framer).
   - Quick actions: complete, priority change, due date, duplicate.

3. **Pull-to-Refresh**
   - Custom or `react-pull-to-refresh` / framer + `useScroll` + threshold.
   - On lists (today/tasks/notes): call `refreshRecentActivity` or re-init hybrid if LIVE, otherwise toast "Refreshed (demo)".
   - Beautiful Lottie or CSS spinner + neon.

4. **Haptic Feedback (Native Feel)**
   - **Web**: `navigator.vibrate([10, 30, 10])` or patterns for success/error/swipe (light/medium/heavy).
   - **Production Native**: Adopt Capacitor (or Expo/RN wrapper later).
     - `npm install @capacitor/core @capacitor/haptics`
     - `Haptics.impact({ style: ImpactStyle.Medium })` etc. on swipe/complete.
     - Maps to Web Vibration fallback.
   - Trigger points: task complete, FAB press, swipe success, error toasts, drag start/end.

5. **Advanced Navigation Gestures**
   - iOS back swipe (use Framer or Next transitions + history).
   - Predictive back (Android 13+ via web APIs or Capacitor).
   - View transitions between Today ↔ Tasks etc. (framer shared layout).

6. **Bottom Sheets & Modals Overhaul**
   - Replace centered `TaskModal`, `CommandPalette` (on mobile), `AuthModal`, cheatsheet with `<motion.div>` bottom sheets.
   - Drag handle, snap points (30%/60%/95%), velocity-based close.
   - Backdrop blur + tap outside dismiss.
   - `AIChatPanel` → full-width or sheet on mobile (currently fixed 96-wide desktop).

7. **Other Interactions**
   - Kanban on mobile: horizontal scroll of columns (better than vertical stack) or tabbed status filter + vertical list.
   - Notes cards: swipe actions.
   - Command palette on mobile: bottom sheet version or persistent search in bottom nav.

**Libraries to consider (add only when implementing):**
- `framer-motion` (already in project — leverage heavily).
- `@use-gesture/react` or native pointer events for advanced.
- `vaul` or custom for drawer/sheet primitives.
- Capacitor for true haptics + push + app store.

**Testing:** Real devices (iOS Safari PWA, Chrome Android, Samsung Internet). Use Chrome DevTools device mode + throttling for "lower-end". Throttled CPU + 3G.

## Advanced PWA / Offline / Sync

- **Current SW**: Basic shell. Next: 
  - Workbox (injectManifest) for precache of critical chunks + runtime caching strategies.
  - Background sync for queued hybridStore pending ops when offline → online (use `sync` event + IndexedDB queue).
  - Periodic background sync for activity/notes.
  - Offline indicator + "Syncing..." UI (already some optimistic in store).
  - App shortcuts deep links (current ?view= stubs; wire a tiny router or Zustand init from URL on load).

- **Install Polish**: Custom splash screens (PWA manifest + HTML meta), "Install" persistent in settings or command palette even after prompt.

- **Offline Excellence**: All views (today/tasks/notes) fully functional offline via Zustand + local persistence. LIVE mode queues writes (already in hybridStore per memory).

## Path to True Native Apps

1. **Capacitor** (recommended over Cordova):
   - `npx cap init`
   - Add iOS/Android platforms.
   - Sync web assets.
   - Haptics, StatusBar (match black-translucent), Safe Area plugins.
   - Build to .ipa/.aab for App Store / Play.
   - Use TWA (Trusted Web Activity) for Android "instant" native wrapper without full native code.

2. **Alternative**: Progressive Web App → "Add to Home Screen" is already excellent with our work (standalone, icons, offline). Many users never need store.

3. **Monetization/Features**: In-app purchases via native, live activities (iOS), widgets — require native shells.

## Recommended Next Steps (Prioritized)

1. **High Impact / Low Effort**: Bottom sheets for TaskModal + AI panel (mobile only via responsive + framer drag).
2. **Gestures MVP**: Swipe-to-complete on task rows (one file: enhance renderTaskRow with motion).
3. **Haptics**: Add Web Vibration + optional Capacitor (behind env flag).
4. **Pull-to-refresh + Offline UI polish**.
5. **Full Workbox SW + background sync integration with hybrid pending queue**.
6. **Audit + enlarge all remaining <44px targets** (priority badges, some icons in lists).
7. **Deep link support + URL-driven currentView** for PWA shortcuts.
8. **Real device + Lighthouse PWA audit** (installable, fast, offline ready — we should score high now).
9. **Performance**: Code-split views (React.lazy for calendar/teams heavy stubs), virtual lists for 100+ tasks.

**Scope Note from Agent 10**: This delivers the "make the app feel native on phones" + "proper PWA support" requested. No core data logic or desktop components were rewritten. All demo flows (Zustand) are preserved and now shine on narrow viewports. Full gestures/haptics/sheets documented here for subsequent agents or Phase 8 completion.

**Files Changed in Foundation**:
- `app/globals.css` (major mobile + PWA styles)
- `app/page.tsx` (bottom nav, FAB, PWA logic + registration + UI + responsive classes)
- `app/layout.tsx` (viewport + themeColor)
- `components/TaskModal.tsx` (touch targets)
- `public/manifest.json` (full PWA)
- `public/sw.js` (new)
- `next.config.ts` (PWA headers)
- `public/icon-*.jpg` (generated + copied)
- `docs/mobile-pwa-roadmap.md` (this file)

The app now feels **bad ass on phones**. Install it. Use the FAB and bottom nav. Go offline. It just works.

Next agent: pick up from "Bottom Sheets + Swipe Gestures MVP". 

Built with love for people who ship — even on the go.