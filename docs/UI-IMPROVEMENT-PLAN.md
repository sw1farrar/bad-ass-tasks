# UI Improvement Plan: Mobile, Multi-Device & Dialog Containment
**Project**: Bad Ass Tasks (M0 phase and beyond)  
**Role**: UI/UX Specialist Agent  
**Date**: 2026-05-25  
**Status**: Analysis Complete — Actionable Plan (No Code Changes Made)  
**Scope**: Thorough review of current UI codebase with emphasis on mobile/PWA/multi-device experience. Focus on dialog containment, thumb zones, safe areas, responsive breakpoints, PWA polish, and real pain points from implementation.

## Executive Summary & Methodology
This plan is derived exclusively from direct codebase exploration (no assumptions):
- **Project structure** (`app/`, `components/`, `public/`, `lib/`, `features/`, `shared/`, `docs/`).
- **Core files read in full or targeted sections**: `app/layout.tsx`, `app/page.tsx` (main shell + 20+ dialog triggers + views), `app/globals.css` (full theme + all mobile media queries), `tailwind.config.ts`, `package.json`, `public/manifest.json`, `public/sw.js`, `lib/utils.ts` (haptics), all key components.
- **Component deep dives**: `TaskModal.tsx`, `AuthModal.tsx`, `CommandPalette.tsx`, `AIChatPanel.tsx`, `TipTapEditor.tsx`, `KnowledgeGraph.tsx`, `SupabaseSetupBanner.tsx`, plus ad-hoc modals in `page.tsx` (invite, workspace settings, keyboard cheatsheet, landing gate).
- **Grep searches** across `components/`, `app/page.tsx`, `app/globals.css`, `features/`, `lib/` for patterns: `fixed inset|inset-0|z-\[`, `mobile-bottom-sheet|sheet-drag`, `Modal|Dialog|CommandPalette|TaskModal|AuthModal`, `safe-area|env\(`, `@media (max-width`, touch targets, empty/loading states.
- **Existing mobile/PWA work**: `docs/AGENT-27-MOBILE-PWA-COMPLETE-HANDOFF.md`, `docs/mobile-pwa-roadmap.md`, `docs/AGENT-RESEARCH-2026-UX-DESIGN-PATTERNS.md` (gaps noted in mobile polish, glass for sheets, CommandPalette).
- **Cross-references**: Prior handoffs (Agent 10 foundations, Agent 17/27 sheets/haptics/gestures/pull-to-refresh/bottom nav/FAB), M0 artifacts, Zustand store usage, framer-motion for drags.

**Current Strengths** (amplify these):
- Solid PWA base (manifest shortcuts, SW shell, install flow + persistent in palette, deep links).
- Mobile shell: Bottom nav (5 views, glass, safe-area, haptic), FAB (56px neon), pull-to-refresh, swipe gestures (priority/complete), horizontal kanban snap on <768px.
- Haptics via `triggerHaptic` (lib/utils.ts:1484+; patterns for light/medium/success/error).
- Touch targets: CSS-enforced min 44px on mobile (globals.css:384+ for btns/rows/inputs; Agent 27 enlargements for badges ~26px, note actions 32px).
- Good adaptive examples: TaskModal + AIChatPanel + keyboard cheatsheet use `isMobile` (width <768) + `.mobile-bottom-sheet` + drag + safe-area padding + `92dvh`.
- Glassmorphism + neon theme consistent; reduced-motion + perf guards.
- Layout: `h-screen flex-col overflow-hidden` root, viewportFit:cover + themeColor in layout.

**Overall Assessment**: Strong foundations (Agent 10/27 delivered native-feeling phone experience for core flows). However, **dialog containment and consistency lag** — only partial adoption of bottom sheets. Tablet breakpoint gap exists. Content in complex sheets can overflow. Many ad-hoc centered modals duplicate fragile patterns. This risks poor UX on real phones (iPhone SE, Android small, with keyboard), tablets, and PWA installs.

**Prioritization Rationale**: Dialog containment (focus #1) is highest risk for "cut off on mobile" complaints. Mobile-first + responsive fixes enable the "world-class" promise. PWA polish builds on existing without new deps. All recs are **additive/gated** (e.g., `max-width:768px` media or `useMediaQuery` hook), zero desktop impact, leverage framer-motion + existing `.mobile-bottom-sheet` CSS + `triggerHaptic`.

## Key Findings by Focus Area (Referenced to Real Code)

### 1. Dialog / Modal Containment
**Problem**: Inconsistent viewport containment, especially on small screens + virtual keyboard. Many use "fixed inset-0 flex items-center justify-center" + `max-w-md` + heavy `p-6/p-8` without `max-h-[90dvh]`, `overflow-auto`, `safe-area-inset-*`, or mobile bottom-sheet conversion. Leads to top cut-off, bottom overflow, awkward body scroll, or hidden content.

**Specific Evidence**:
- **TaskModal.tsx** (good baseline but incomplete): Lines 368-377 (resize listener `window.innerWidth < 768`), 433-461 (backdrop `fixed inset-0 z-[180]` with conditional `items-end sheet-backdrop` vs center; motion sheet `mobile-bottom-sheet rounded-t-3xl max-w-none` vs `max-w-3xl`; drag only on mobile; header safe-area top). CSS support: globals.css:717-763 (`.mobile-bottom-sheet` forced `bottom:0 left:0 right:0 max-height:92dvh !important`, `.sheet-drag-handle`, flex-col on `.glass`). **Pain**: Inner body `<div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">` (502+) + tall children (RecurrenceEditor ~lines 155-360 with many buttons/inputs/presets/end-conditions; subtasks; comments `max-h-48` local only; AI panels; textarea min-h-160; conflicts banner) — **no flex-1 + overflow-auto wrapper on the grid/content**. On phones, full features easily exceed 92dvh → overflow/cutoff or body scroll.
- **AuthModal.tsx** (classic pain point): 44-61 (signed-in state), 129-132 (`fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4`; inner `glass w-full max-w-md rounded-3xl p-8`). Forms (inputs py-3, buttons). No `isMobile`, no sheet, no extra safe padding, no max-h. Auto-closes on auth but opens frequently.
- **CommandPalette.tsx** (high-traffic, worst for mobile): Uses `cmdk` `Command.Dialog` (183-187: `fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]`); backdrop fixed inset; content `w-full max-w-[640px] mx-4` + list `max-h-[420px] overflow-y-auto`. No mobile detection/adaptation (confirmed in AGENT-27 handoff as remaining). pt-20vh + keyboard = top overflow/cutoff. Long lists/groups (Quick Actions, PWA install, shortcuts) push content. Handoff explicitly calls for bottom-sheet version.
- **Other ad-hoc in app/page.tsx**: Invite dialog (2661: `fixed inset-0 z-[220] flex center p-4`, glass max-w-md p-6); Workspace Settings (3487: z-[230] same pattern); KnowledgeGraph (components:109: z-[200] center); Landing gate (3648: z-[150] center p-6). All duplicate fragile pattern.
- **TipTapEditor.tsx** (slash/popover): 1082 (`absolute z-50 w-72 glass rounded-xl ...` styled with JS `top/left` from `slashPosition`; max-h 260 overflow). No clamping to viewport, no mobile responsive width/positioning (e.g., flip above/below or full-width sheet on small). Triggered in rich notes editing (common on mobile).
- **Inconsistencies**: z-indexes 100–230+ (risk of stacking); `.modal`/`.sheet` animations in CSS (218-224) underused; no centralized primitive (dupe code).
- **Cheatsheet (page.tsx:3562+)**: Positive example — `flex items-end md:items-center`, `mobile-bottom-sheet` class + `sheet-drag-handle md:hidden`, uses globals sheet system. Model for others.

**Impact**: On <640px phones (esp. with keyboard for forms/passwords/search), dialogs get "cut off" or require "awkward scrolling". Violates "every modal stays fully within viewport". Premium glass/neon feels broken when clipped.

### 2. Mobile-First & World-Class Mobile Experience
**Strengths**: 44px+ targets (globals 384-428 + Agent 27 enlargements), bottom nav/FAB (page 3371+, 3411+; CSS 450-532: fixed, safe-area-inset-bottom, z-60/70, 52-56px, haptic on tap), pull-to-refresh + swipes (page + CSS), kanban horiz (globals 555+), haptics everywhere (TaskModal open/complete/delete, palette, etc.).

**Specific Issues**:
- **Thumb zones**: FAB/AI-fab (page 3553 `fixed bottom-6 right-6 z-80`, CSS adjust for nav) good (right 1/3 lower). But top-bar actions (workspace switcher, search?) and some floating (Supabase banner bottom-20) compete or sit in awkward reach. Close/delete in sheets (TaskModal 488-498: p-3 min-44 good, right side).
- **Safe areas**: Inconsistent. Nav/FAB/sheet headers use `env(safe-area-inset-bottom/top)` (CSS 460, 505, 432, 469 in TaskModal). But Auth/centered modals use plain `p-4` (no `max( , env())`); Supabase banner `bottom-20` risks overlap with bottom-nav (z-60 collision possible on phones); main-content pb calc good but not all overlays respect.
- **Bottom sheets vs traditional**: Partial success (Task/AI/Cheatsheet per Agent 27). Auth/CommandPalette/ad-hoc still centered (roadmap #6 called for overhaul; Agent 27 listed as remaining for Command/Auth).
- **Touch targets**: Mostly solid, but complex inners (RecurrenceEditor buttons ~px-2 py-0.5 text-10px in TaskModal; slash menu items; small controls in kanban/cards) can dip below 44px on mobile. Some note action buttons enlarged to 32px but not everywhere.
- **Font scaling/readability**: Base Inter good; mobile CSS enlarges some (badges to 11px). But dense text-xs/10px in modals/palettes (e.g. Command groups, recurrence presets) + large title `text-3xl` in TaskModal can cause wrapping/clip on 320-375px widths. No `clamp()` or dynamic scaling tied to viewport.
- **Keyboard avoidance**: Minimal. Web limitations (no native "Done" bar easy), but current viewport (layout: maxScale:5, no user-scalable) + no JS listeners for focus + dynamic sheet padding or `scrollIntoView` in dialogs with inputs. Password/email in Auth + search in palette + title/textarea in Task + TipTap = content pushed off or hidden behind kb on iOS/Android PWA.
- **Other**: Loading/empty states (page 1347+ skeletons glass h-28; 1354+ empty `p-16` large glass on mobile — wastes space, button ok but not thumb-optimized in 1-col). Glassmorphism on small screens: beautiful but blur(20px) + heavy shadows can feel less "premium" or perf-heavy on low-end (reduced-motion helps anims only).

### 3. Responsive Behavior Across Breakpoints
**Breakpoints Used** (Tailwind defaults + custom CSS):
- Mobile: <640px (some kanban tighten), <768px (nav, sheets, sidebar hide, touch rules).
- Tablet: 640-1024px.
- Desktop: >1024px (lg: sidebar, full grids).

**Issues**:
- **Nav mismatch (critical tablet gap)**: Bottom nav `md:hidden` (visible <768 via CSS 464+). Sidebar `hidden lg:flex` (1024+). Result: 768px–1023px tablets/landscape phones have **neither** — only top-bar (workspace switcher + view? limited). Top bar compacts on mobile (CSS 436) but not a full nav replacement. Views switch via store but discoverability suffers.
- **Dialogs**: Most ignore breakpoints beyond `mx-4` + `max-w-*`. Command pt-20vh, centered modals don't switch to sheets or adjust height/position on <640.
- **Other**: Kanban good (flex horiz snap <768, grid lg). Notes grid 1-col md:2 lg:3. Main p-6 lg:p-8. AI fab / floating adjust via `.ai-fab` + CSS. But ad-hoc fixed elements (e.g. keyboard hint `hidden lg:block`) create gaps.
- **Mental model**: Desktop = sidebar + right AI/panels. Mobile = bottom nav + FAB + sheets from bottom. Tablet undefined — breaks expectations (e.g. CommandPalette behavior should perhaps be full-width or sheet-like).

### 4. PWA & Mobile Polish
**Strong**: `public/manifest.json` (standalone, shortcuts Today/Tasks with icons, maskable, orientation any, categories); layout (appleWebApp capable, viewportFit cover, theme #0a0a0f); sw.js (basic precache + PWA shortcuts per Agent 27); install logic + persistent Command action; offline Zustand + visual sync; deep links `?view=`; haptics; bottom shell; reduced-motion.

**Gaps**:
- Screenshots stub (icon-512.jpg as placeholder for narrow form_factor).
- No Capacitor (per handoffs/roadmap — future for true haptics/statusbar/widgets).
- Glass on small: Still premium? (surgical use for sheets good; over-use on lists may reduce contrast).
- Loading/empty/error: Functional (shimmer, glass empties, sonner toasts top-center) but not mobile-tuned (large padding, no specific PWA offline states beyond sync pill).
- Toaster (layout) + sheets z-stack risk on mobile.
- SW basic (no advanced runtime caching or background sync per remaining in handoff).
- Keyboard in PWA: Same avoidance issues.

### 5. Current Pain Points (Real, File-Specific)
- **Containment overflows**: TaskModal content (full recurrence + comments + subtasks), CommandPalette on kb, Auth forms, slash menu offscreen, ad-hoc modals.
- **Nav disappearance**: Tablets 768-1024px (page 3112 sidebar, 3371 bottom-nav).
- **Banner collision**: SupabaseSetupBanner (bottom-20 z-60 vs bottom-nav z-60).
- **Duplication**: 5+ copies of "fixed inset-0 flex center p-4 glass max-w-md" pattern (fragile, inconsistent padding/safe).
- **Inconsistent mobile treatment**: Only 3 surfaces use sheet system (Task/AI/Cheatsheet); high-use ones don't.
- **Complex inner UIs**: RecurrenceEditor (hundreds of lines of controls) + TipTap slash not mobile-optimized.
- **Empty states**: `p-16` (notes) too generous on phones.
- **Z-index & stacking**: Scattered 60-230; toasts/sheets/FAB compete.
- **Perf/feel on small**: Potential blur cost; no dynamic font clamp; some sub-44px in editors.
- **Verification gaps**: No explicit mobile device tests in current (though Playwright config exists; M0 logs reference regression).

**Positive Callouts**: Agent 27 completion delivered real native feel for core (sheets partial, gestures, targets, PWA polish). Cheatsheet is a model implementation. Haptic + safe-area usage is thoughtful.

## Prioritized UI Improvement Plan

### Phase 1: Quick Wins (High Impact, Low Effort — 1-3 "agent days" equivalent; immediate M0 value)
Focus: Containment patches + consistency without full refactors. Leverage existing CSS/system.

1. **Add Safe-Area, Max-Height, and Scroll Containment to All Centered Modals**  
   **Files**: `components/AuthModal.tsx` (129-132 + forms), `components/CommandPalette.tsx` (187+ content + list), `app/page.tsx` (invite 2661, workspace 3487, landing 3648, KnowledgeGraph component), `components/KnowledgeGraph.tsx`.  
   **Why it matters (esp. mobile)**: Prevents cut-off on <375px phones + keyboard (Auth/Command most used for sign-in/search). Restores premium feel; quick patch before full sheet conversions.  
   **Suggested approach**: 
   - Update backdrop to `fixed inset-0 z-XXX flex items-end md:items-center p-4` (or keep center on md+).
   - Inner: `glass w-full max-w-md md:max-w-lg rounded-t-3xl md:rounded-3xl p-6` + `max-h-[85dvh] md:max-h-[80vh] overflow-auto` (use dvh for dynamic vh/keyboard).
   - Add safe padding: `style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0))' }}` on content or via CSS extension.
   - For Command: Reduce pt-20vh or conditional; ensure list scrolls within max-h.
   - Extract tiny `.modal-content` or `.sheet-content-mobile` utility in globals.css for reuse (no behavior change on desktop).
   - For slash menu (TipTapEditor): Add JS clamping (Math.min/max on position) or `position: fixed` + boundary check; make w-full or 90vw on mobile.
   **Effort**: Low (copy/edit existing patterns from TaskModal/Cheatsheet + CSS).  
   **Acceptance Criteria**:
   - On simulated iPhone SE (375x667) or Android small (320px) + soft kb (trigger inputs), no content clipped; full scrollable without body overflow.
   - Visual: Sheets feel native from bottom on mobile; centered on tablet+.
   - No layout shift on desktop (>1024). Lighthouse mobile no overflow issues. Manual: Open all 6+ modals/palettes on narrow viewport.
   - Safe-area padding visible in notch devices (or dev tools simulation).

2. **Fix Tablet Navigation Gap (768-1023px)**  
   **Files**: `app/page.tsx` (3112 sidebar, 3371 bottom-nav classes), `app/globals.css` (media queries 374+).  
   **Why**: Breaks responsive mental model; users on iPad mini/landscape phones lose primary nav. Top-bar insufficient for 5 views.  
   **Suggested approach**: Unify to consistent breakpoint (e.g., bottom-nav visible <1024 or introduce `lg:hidden` consistently; or simple hamburger in top-bar for tablet that opens a sheet/drawer of VIEWS). Or make bottom-nav `<lg` and sidebar `lg+`. Add tablet-specific top-bar compact nav pills if preferred. Gated, additive.  
   **Effort**: Low-Medium (CSS + minor JSX class tweaks or small conditional menu).  
   **ACs**: 800px viewport shows usable primary navigation (bottom or alternative); no dead zone. Tests: resize browser or device sim between 640-1024; all views reachable without frustration. Sidebar appears only >1024.

3. **Uniform Safe-Area & Collision Fixes for Banners/Floating**  
   **Files**: `components/SupabaseSetupBanner.tsx` (12), `app/page.tsx` (AI fab 3553, floating quick-add), `app/globals.css` (existing .floating adjustments).  
   **Why**: Prevents overlap with bottom-nav on phones (esp. PWA); improves reachability.  
   **Approach**: Change banner to `bottom: calc(5rem + env(safe-area-inset-bottom, 0))` or hide on mobile (md:hidden) + surface in settings. Ensure all fixed bottoms use the calc pattern from FAB/nav.  
   **Effort**: Low.  
   **ACs**: Banner fully visible + tappable above nav on <768; no z or position collision in dev tools/phones.

4. **Enlarge/Optimize Empty & Loading States for Mobile**  
   **Files**: `app/page.tsx` (notes empty 1354 `p-16`, tasks "No tasks match", skeletons 1347+, other views), similar in Today/Tasks renders.  
   **Why**: Large padding wastes thumb zone space on phones; buttons hard to reach in tall empty cards.  
   **Approach**: Add mobile media or `max-md:p-8` / responsive classes; use smaller icons on mobile; ensure CTAs min-44 and centered in thumb zone. Leverage existing `.glass` + shimmer.  
   **Effort**: Low.  
   **ACs**: On <640, empty states use <= p-8 or equiv; tap targets 44px+; content fits without scroll for "no items" case. Looks premium, not sparse.

### Phase 2: M0/M1 Core Mobile & Dialog Polish (Medium Effort; Foundational for Premium Feel)
Build on Quick Wins + existing Agent 27 sheet system. Target consistent native experience.

5. **Convert Remaining High-Use Modals to Bottom Sheet Pattern**  
   **Files**: `components/AuthModal.tsx`, `components/CommandPalette.tsx` (core cmdk integration challenge), `app/page.tsx` (invite, workspaceSettings, others + any future). Reference: TaskModal 363+, AIChatPanel (grep), Cheatsheet 3562, globals 716+ (`.mobile-bottom-sheet` system).  
   **Why (mobile critical)**: Auth (daily for some), CommandPalette (power user #1 entry, ⌘K everywhere), invite/workspace (collaboration). Centered = poor on phones per roadmap/Agent 27. Delivers "all modals consistent native bottom" promise. Improves keyboard (sheets from bottom handle kb better via drag/scroll).  
   **Suggested approach**:
   - Add `isMobile` resize listener (copy TaskModal pattern) or better: shared hook `useIsMobile(768)`.
   - For Auth: Reuse exact structure (backdrop items-end on mobile, motion.div with drag y + handle + spring, header safe top, content flex col + overflow).
   - For CommandPalette: Trickier (cmdk Dialog wrapper). Options: (a) Keep cmdk for a11y/keyboard nav but wrap/override root styles on mobile to bottom (hard); (b) Build custom mobile sheet version of palette content (list + search) using motion + existing cmdk List items or plain; (c) Use cmdk but force bottom positioning + max-h calc. Prefer hybrid: desktop cmdk center, mobile custom sheet (leverage framer + glass). Add PWA install remains prominent.
   - For ad-hoc: Centralize into reusable `MobileAwareModal` or `BottomSheet` component (or just consistent JSX snippet + props for drag/close).
   - Enhance globals: Add more variants (e.g., `.sheet-content-scroll` for flex-1 overflow).
   - Keyboard: On mobile sheet open with inputs, optional `useEffect` focus + `scrollIntoView({block:'center'})` or padding bump.
   - Keep desktop unchanged; haptic on open/close (mobile only).
   **Effort**: Medium (Auth low; CommandPalette higher due to lib — 1-2 focused sessions; introduce 1-2 shared patterns). No new deps (use existing motion/cmdk).  
   **ACs**:
   - All listed surfaces use bottom sheet + drag-dismiss + handle + safe areas + 92dvh on <768 (verified resize + real device or Playwright viewport).
   - CommandPalette fully usable on phone (search, groups, actions, install); no pt-20vh cutoff.
   - Auth flows (sign in/up, errors, already-signed) contained and scrollable.
   - No regression: Desktop cmdk/centered behavior identical; a11y (focus, ESC, labels) preserved or improved.
   - Test matrix: 320px/375px/768px/1024px + keyboard open; drag works; toasts/sheets don't collide.

6. **TaskModal Content Containment Hardening + Polish**  
   **Files**: `components/TaskModal.tsx` (502+ grid + RecurrenceEditor + subtasks + comments + AI), `app/globals.css` (sheet rules).  
   **Why**: Even with sheet, tall complex UIs (recurrence is production-grade but UI-heavy) break containment on small phones. Users can't reach delete/close or scroll easily.  
   **Approach**: Wrap main grid/content in `<div className="flex-1 overflow-auto p-6 ...">` (or dedicated `.sheet-scroll-area`). Add mobile-specific max-h or section collapsing (e.g., recurrence defaults collapsed on mobile). Ensure all inner buttons >=44px (audit recurrence week-day toggles etc.).  
   **Effort**: Low-Medium.  
   **ACs**: Full TaskModal (all sections open) fits/scrolls cleanly in 92dvh on 375px phone; no clipping of actions; smooth drag + content scroll coexistence (touch-action careful).

7. **Slash Menu & TipTap Popovers: Mobile Containment + Thumb Optimization**  
   **Files**: `components/TipTapEditor.tsx` (1082+ slash + cursorOverlay), related editor extensions in `features/notes/editor/`.  
   **Why**: Notes editing primary on mobile; offscreen menus = frustration.  
   **Approach**: JS position clamping (use `useEffect` + getBoundingClientRect or ResizeObserver to flip/offset within viewport bounds, accounting for kb height via visualViewport API if avail). On mobile: wider (95vw or full sheet-like dropdown anchored top), larger tap targets, haptic on open. Consider portal to body.  
   **Effort**: Medium (position math + responsive styles).  
   **ACs**: Slash menu always 100% visible/usable on <640 + kb; tap targets 44px; no overflow in editor viewport (test long notes near bottom).

8. **Enhance Keyboard Avoidance & Font/Readability Mobile**  
   **Files**: `app/layout.tsx` (viewport), `components/AuthModal.tsx` + `CommandPalette.tsx` + `TaskModal.tsx` (inputs), `app/globals.css` (add font rules?), `app/page.tsx` (any dynamic).  
   **Approach**: 
   - Viewport tweaks if safe (or document meta).
   - In dialogs with forms: `useEffect` on focus (inputs/textarea) to add temp class/padding or scroll sheet to focused el.
   - Fonts: Introduce CSS `font-size: clamp(14px, 4vw, 16px)` for body in modals or global mobile; ensure min sizes.
   - Optional: iOS-specific "done" via custom accessory (advanced, low prio).
   **Effort**: Medium.  
   **ACs**: On iOS Safari/PWA + Android, opening kb in Auth/Command/Task does not hide submit buttons or title; content remains readable/scrollable. Text in modals >=14-15px effective on 320px.

9. **PWA-Specific Polish & States**  
   **Files**: `public/manifest.json` (screenshots), `app/page.tsx` (install, toasts, loading), `app/globals.css` (glass/mobile), `public/sw.js`.  
   **Why**: Completes "premium on phones" (handoff vision); real screenshots sell install; states feel native in PWA.  
   **Approach**: Generate/replace screenshots (narrow form_factor, multiple devices) — use existing image tools if avail. Tune sonner position or mobile styles (e.g., bottom on small?). Add PWA-specific empty/offline messaging. Audit glass contrast on small (perhaps subtle variant).  
   **Effort**: Low-Medium (screenshots higher if manual).  
   **ACs**: Manifest validates (Lighthouse PWA 95+); install flow + shortcuts work offline; screenshots show realistic mobile UI; loading/empty polished for narrow viewports.

### Phase 3: Later / M1+ Enhancements (Higher Effort or Future Tech)
- **Central Modal/Sheet Primitive + Design System Evolution**: Per AGENT-RESEARCH-2026-UX... (surgical glass-2.0 for overlays only; tokens for elevation/radius/motion; shared `BottomSheet` + `Modal` components). Replace all dupe patterns. Add full a11y (focus trap, ARIA for complex like recurrence/slash).
- **Advanced Mobile**: Long-press context sheets (beyond current swipe), notes card swipes symmetric to tasks, Capacitor integration (true haptics, status bar, app store build — roadmap).
- **Perf & Polish**: Workbox + background sync (handoff remaining); React.lazy for heavy (calendar/teams/KG); virtual lists; real-device Lighthouse + Playwright mobile matrix in CI.
- **Research-Aligned**: AI-augmented palette (intent parsing); deeper editor integration; structured onboarding/empty state magic moments; WCAG 2.2 full audit (contrast in glass, custom controls).
- **Testing**: Expand M0 verification packet with dedicated mobile dialog matrix (320/375/414/768/1024 viewports, kb open/closed, notch sim, orientation).

## Implementation Guidance & Verification
- **Order**: Quick Wins first (containment patches + tablet nav) → Phase 2 sheets/content (builds directly on TaskModal pattern) → polish.
- **Gating**: All mobile changes behind `@media (max-width: 768px)` or `if (isMobile)` or shared hook. Preserve lg+ exactly.
- **Deps**: Zero new (framer, cmdk, motion already; Tailwind/CSS vars).
- **Testing Strategy** (no code yet):
  - Browser dev tools: Device mode iPhone SE, Pixel 5, iPad, desktop; toggle kb, resize live.
  - Playwright (existing config): Add mobile viewport tests for each dialog open + interact + assert no overflow/visible actions.
  - Real devices: iOS Safari + "Add to Home", Android Chrome PWA.
  - Manual AC checklist per rec above.
  - Regression: Full M0 smoke (views, create/edit/delete, palette, auth flows, notes editor) on narrow + wide.
  - a11y: Keyboard nav in sheets/palette; screen reader labels.
- **Risks/Mitigation**: cmdk mobile conversion (prototype custom first); z-index wars (audit once, use CSS vars?); content height in Task (measure real usage).
- **Metrics of Success**: "Dialogs never clip on phone" (user reports/ tests); tablet nav intuitive; PWA Lighthouse mobile 95+; feels "better than 95% native apps" (per original vision).
- **Handoff**: This plan + existing AGENT-27 + mobile roadmap + UX research doc provide complete context. Next agent (or M0 team) can implement Phase 1 immediately.

**Conclusion**: The app already has excellent mobile bones. This plan closes the remaining gaps in containment and consistency to deliver on the "Bad Ass" promise across every screen — especially the thumb-driven phones where users spend most time. All recommendations are specific, file-referenced, and phased for safe, high-confidence delivery.

Built for people who ship — beautifully, everywhere.

---
*Plan generated from exhaustive static analysis. Ready for review/prioritization/implementation.*