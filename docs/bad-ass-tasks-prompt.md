# Bad Ass Tasks — Ultimate Prompt

You are an elite full-stack AI engineer. Build me **the most badass notes + tasks application ever created**, called **"Bad Ass Tasks"**.

This should feel like the love child of Notion, Todoist, Linear, and Obsidian — but faster, more beautiful, more fun, and built for high-performance individuals and teams who actually ship.

## Vision & Philosophy
- **Name**: Bad Ass Tasks
- **Tagline**: "Get shit done. Beautifully."
- **Core Promise**: The most powerful, delightful, and addictive notes + task management app on the planet.
- Design language: Dark-first, ultra-modern, neon accents (#00ff9f green + #ff00aa pink), glassmorphism, buttery 60fps animations, keyboard-first, zero friction.
- Target users: Ambitious creators, founders, developers, and teams who want to move at the speed of thought.

## Tech Stack (Use This Exactly)
- **Framework**: Next.js 15 (App Router) + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui + Radix UI primitives
- **Animations**: Framer Motion (beautiful page transitions, micro-interactions, drag & drop)
- **Backend**: Supabase (Auth + PostgreSQL + Realtime + Storage + Edge Functions)
- **Rich Text Editor**: TipTap (block-based, Notion-like, with custom extensions)
- **Icons**: Lucide-react + custom SVG where needed
- **Deployment**: Vercel (with automatic preview deployments)
- **State**: TanStack Query + Zustand (for client state)
- **Search**: Supabase full-text + semantic search (pgvector if possible, or hybrid)
- **PWA**: Next.js PWA with offline support (service worker + IndexedDB for offline-first experience)
- **Mobile Excellence**: The app must feel *native* and *bad ass* on iOS and Android — better than most native apps. Mobile is a first-class citizen, not an afterthought.

## Authentication & User System

### Core Auth
- Email + Password (with strong validation)
- Magic link login
- OAuth: Google, GitHub, Apple (add more later)
- Session management with Supabase Auth
- Password reset flow (beautiful emails via Resend or Supabase)

### Roles & Permissions
- **User roles**:
  - `user` (default)
  - `admin` (can manage users in their workspace)
  - `owner` (full control, billing, delete workspace)
- Granular permissions on notes/tasks/folders (View, Comment, Edit, Admin)

### Admin Capabilities
- Dedicated **Admin Dashboard** (accessible only to admins/owners)
- User management table: invite, suspend, change role, remove from workspace
- Team activity log (who did what and when)
- Workspace settings (name, logo, domain, billing)
- Usage analytics (notes created, tasks completed, active users)

### Teams & Sharing
- Users can create **Workspaces** (like "Personal", "Startup", "Client X")
- Invite people via email (with role selection)
- Shared folders with permission inheritance
- Public share links (view-only or editable) with password protection option
- Team inbox / shared tasks that appear for everyone
- @mentions that notify across the entire workspace

## Core Product Features

### 1. Sidebar Navigation (Always Visible)
- Logo + Workspace switcher (dropdown)
- Search bar (global, fuzzy + semantic)
- **Today** (smart daily view)
- **Inbox** (unsorted tasks + notes)
- **Tasks** (all tasks with powerful filters)
- **Notes** (all notes, hierarchical)
- **Calendar** (unified tasks + note deadlines)
- **Teams** (members + shared content)
- **Admin** (only visible to admins)
- **Command Palette** trigger (⌘K)
- User avatar + settings dropdown

### 2. Tasks System (World-Class)
Views (switchable with beautiful transitions):
- **List View** (clean, sortable, filterable)
- **Kanban Board** (drag & drop columns: Backlog → Todo → Doing → Done + custom columns)
- **Calendar View** (month + week + day, drag tasks to reschedule)
- **Timeline View** (Gantt-style)
- **Table View** (Notion database style with properties)

Task properties:
- Title (rich inline editing)
- Description (full TipTap editor)
- Priority (P0–P3 + custom labels with colors)
- Due date + time + reminder
- Recurring (daily, weekly, monthly, custom)
- Status
- Assignee(s) (multi-select with avatars)
- Subtasks (nested, checkable)
- Dependencies (blockers)
- Time estimate + actual time tracked
- Tags (multi-color)
- Linked notes (bidirectional)
- Comments + reactions (Slack-style)
- Attachments (drag & drop files, stored in Supabase Storage)

Smart features:
- Natural language input: "Finish proposal by Friday at 3pm P1 @Sarah"
- Auto-suggestions for due dates, assignees, tags
- Smart "Today" and "This Week" sections
- Overdue highlighting with gentle nudges
- Pomodoro timer built into task modal
- Task templates (save recurring task sets)

### 3. Notes System (Notion-Killer)
- Block-based editor (TipTap) with:
  - Headings, paragraphs, lists, quotes, code blocks, callouts
  - Toggle lists, tables, image embeds, video embeds, file embeds
  - Math equations (KaTeX)
  - Database blocks (inline tables, boards, calendars)
  - Synced blocks (edit once, updates everywhere)
- Nested pages (infinite hierarchy)
- Backlinks + forward links (graph view optional)
- Version history (diff view)
- AI Writing Assistant (sidebar chat that can rewrite, summarize, expand, generate tasks from selection)
- Slash commands (`/task`, `/table`, `/kanban`, `/calendar`, `/embed`, etc.)
- @mentions that link to users + create tasks

### 4. Deep Notes ↔ Tasks Integration
- Convert any note block into a task (and vice versa)
- Embed live task lists inside notes
- "Task from note" button that extracts action items using AI
- Linked references (see every task/note that mentions this page)
- Daily note auto-generated with tasks due today + note highlights

### 5. AI Superpowers (Make It Feel Magical)
- **Global AI Chat** (accessible from anywhere): "What did I commit to this week?" or "Summarize all notes about the new feature"
- **Smart Daily Briefing** (auto-generated every morning)
- **Auto task extraction** from meeting notes or long documents
- **Natural language commands** in command palette
- **Writing coach** that suggests improvements in real time
- **Semantic search** across all notes and tasks ("show me everything about the launch strategy")

### 6. Search & Discovery
- Instant global search (⌘K) with filters (type, date, assignee, tag, workspace)
- Semantic search powered by embeddings
- Saved searches / smart views
- "Recently edited", "Shared with me", "Mentions of me"

### 7. Polish & Delight (This Is What Makes It Bad Ass)
- **Command Palette** (⌘K) — do everything from here (create task, note, switch workspace, AI commands, etc.)
- **Keyboard-first** — every action has a shortcut, discoverable in tooltips
- **Drag & drop** everywhere (tasks between views, blocks, files into notes)
- **Beautiful micro-interactions** (confetti on task completion, smooth expand/collapse, loading states that feel alive)
- **Themes**: Default neon dark + light mode + "Midnight" + "Neon Noir" + custom theme builder
- **Mobile-first** responsive design that actually feels native on phones (PWA installable)
- **Offline support** — everything works offline, syncs when back online
- **Real-time collaboration** — see cursors, live updates on shared notes/tasks
- **Comments with reactions** (👍 ❤️ 🔥 etc.)
- **@mentions** with notifications (in-app + email)
- **Version history** with beautiful diff viewer
- **Export** everything (Markdown, PDF, JSON, Notion import)
- **Onboarding** that feels like a game (first workspace setup, sample data, interactive tutorial)

## Mobile Experience — First Class Citizen (This Must Feel Native & Bad Ass)

The app must be **exceptional on phones** — better than 95% of native apps. Mobile is not an afterthought; it is a core experience.

### Mobile-First Design Principles
- **Adaptive UI**: Desktop uses sidebar + right panel. Mobile uses **bottom navigation bar** (Today / Tasks / Notes / Teams) + floating action button (FAB) for quick add.
- **Bottom Sheet Modals**: All detail views (task details, note editor, filters) open as beautiful bottom sheets with drag-to-dismiss and snap points.
- **Gesture-First Interactions**:
  - Swipe left on task → Mark complete (with haptic + confetti)
  - Swipe right on task → Snooze / Delete / Move
  - Long press → Quick actions menu (iOS-style)
  - Pull-to-refresh on every list with beautiful animation
  - Back swipe gesture (iOS) and predictive back (Android)
- **Touch Targets**: Minimum 44×44px everywhere. Generous spacing. No tiny buttons.
- **Keyboard Handling**: Smart keyboard avoidance. "Done" button on iOS. Quick reply keyboard for comments.

### Native-Like Features
- **Installable PWA**: Beautiful install prompt on mobile. Custom app icon, splash screen, and standalone mode (no browser chrome).
- **Push Notifications** (via Supabase + Vercel):
  - Due task reminders (with smart snooze options)
  - @mentions and comments
  - Team updates ("Sarah completed 'Launch proposal'")
  - Daily briefing notification (optional)
- **Biometric Authentication**: Face ID / Touch ID / Fingerprint on login + sensitive actions.
- **Voice Input**: Floating mic button everywhere. Speak to create task/note ("Remind me to call mom tomorrow at 5"). Works offline with on-device transcription where possible.
- **Home Screen Widgets** (iOS 17+ / Android): Today’s tasks + quick add button.
- **Share Sheet Integration**: Share from any app → "Add to Bad Ass Tasks" (creates task or note instantly).
- **Quick Actions** (3D Touch / Long press on app icon): "New Task", "New Note", "Today’s Tasks".

### Performance & Polish on Mobile
- **60fps on low-end devices**: Aggressive code splitting, lazy loading, virtualized lists (React Window / Virtuoso).
- **Offline-First**: Full offline support with conflict-free sync (CRDT or last-write-wins with clear UI). Show beautiful "Syncing…" status with progress.
- **Haptic Feedback**: Use Capacitor or native haptics for every important action (complete task, error, success, long press).
- **Mobile Editor**: TipTap optimized for mobile — larger handles, smart selection, floating toolbar, voice-to-text button inside editor.
- **Fast App Switching**: Maintain scroll position and state when backgrounding/foregrounding.
- **Battery & Data Friendly**: Smart background sync, respect "Low Data Mode", dark mode that saves battery.
- **Accessibility**: Full VoiceOver / TalkBack support, dynamic type scaling, high contrast mode.

### Mobile-Specific Flows
- **Quick Add from Anywhere**: Notification quick action, widget, share sheet, or home screen quick action → instant task/note creation with smart defaults.
- **Today View on Mobile**: Beautiful one-screen daily briefing with "What matters today" + voice input + swipeable task list.
- **On-the-Go Task Capture**: Voice-first "Inbox" mode. Speak multiple tasks in a row. AI auto-categorizes them later.
- **Offline Writing**: Write long notes or plan projects completely offline. Beautiful sync animation when back online.

**Mobile is where most users will live.** Make every interaction feel delightful, fast, and native. If it doesn't feel better than Todoist + Notion on phone, it fails.

## Desktop + Mobile Excellence — True Cross-Platform Mastery

The app must be **world-class on both desktop and mobile** — not "responsive", but **purpose-built** for each platform while sharing the exact same data and features.

### Unified Philosophy
- One codebase, two exceptional experiences.
- Desktop = Power + Speed + Keyboard
- Mobile = Touch + Speed + Voice + Gestures
- Perfect sync between phone, laptop, tablet, and web — real-time, conflict-free, beautiful.

### Desktop Experience (macOS, Windows, Linux via PWA or Web)
- **Sidebar + Right Panel Layout** (collapsible, resizable, remembers state)
- **Multi-Pane Power User Mode**: Split view (e.g. Notes list + open note + task list side-by-side)
- **Advanced Keyboard Shortcuts** (full cheat sheet accessible via ? key):
  - `⌘K` Command Palette (do 90% of actions here)
  - `⌘N` New task/note
  - `⌘/` Quick filter
  - `j/k` Vim-style navigation in lists
  - `Space` Quick complete / toggle
  - `⌘Enter` Save & next
  - Global hotkeys even when app is in background (optional)
- **Drag & Drop Mastery**:
  - Drag tasks between Kanban columns, calendars, and even between workspaces
  - Drag blocks between notes
  - Drag files from desktop directly into notes
- **Tab / Window Management**:
  - Open multiple notes/tasks in tabs (like a browser)
  - Pop out note or task into its own window
  - Remember open tabs across sessions
- **Mouse + Keyboard Synergy**:
  - Hover previews (quick view task/note without clicking)
  - Right-click context menus with power actions
  - Multi-select with Shift/Cmd + drag to bulk edit
- **Desktop-Only Power Features**:
  - Global search with live results in a floating panel
  - Advanced filters with saved "Smart Views"
  - Bulk actions toolbar
  - Export / import wizards with preview
  - Developer mode (JSON view, API playground — optional but cool)

### Mobile Experience (iOS + Android PWA)
- **Bottom Navigation** (Today / Tasks / Notes / Teams) with active state and subtle animations
- **Floating Action Button (FAB)** — always visible, context-aware (creates task on Tasks screen, note on Notes screen)
- **Bottom Sheet Everything**:
  - Task details, note editor, filters, member list — all beautiful bottom sheets
  - Drag to expand / collapse / dismiss
  - Snap points for power users
- **Gesture Language**:
  - Swipe left = complete (haptic + confetti)
  - Swipe right = snooze / move / delete (with action sheet)
  - Two-finger swipe = bulk select
  - Pull down = refresh with delightful animation
- **Voice-First**:
  - Persistent mic button in FAB and bottom nav
  - Speak naturally: "Finish investor deck by Friday P0 @Sarah"
  - On-device transcription where possible + fallback to cloud
- **Quick Capture**:
  - Home screen widget with "Quick Task" and "Quick Note"
  - Share sheet from any app
  - Notification quick actions
  - Siri / Google Assistant shortcuts (optional)
- **Mobile-Only Delight**:
  - Beautiful Today widget showing today's priorities
  - Offline mode with elegant sync status ("All changes saved" / "Syncing 3 changes…")
  - Biometric + Face ID unlock
  - Dynamic Island / notification center integration
  - Haptic feedback on every meaningful action

### Cross-Platform Glue
- **Perfect Sync**: Real-time via Supabase Realtime. Changes on phone appear instantly on desktop and vice versa.
- **Presence**: See who else is online and what they're editing (subtle avatars in notes/tasks).
- **Conflict Resolution**: Beautiful UI when conflicts happen (rare) — "You edited this on your phone. Keep phone version / desktop version / merge?"
- **Responsive Breakpoints** (but smart):
  - < 768px → Mobile layout (bottom nav + bottom sheets)
  - 768px – 1200px → Tablet layout (collapsible sidebar + bottom sheets)
  - > 1200px → Full desktop power layout (sidebar + right panel + tabs)
- **State Persistence**: Open note/task, scroll position, filters, and view mode remembered per device and synced where it makes sense.

**The goal**: Whether the user is on their phone on the train or at their desk with three monitors, the experience feels *purpose-built* for that moment — fast, beautiful, and delightful.

## Detailed Page Breakdown

### Landing Page (Public)
- Hero with stunning visual + tagline + "Works insanely well on iPhone & Android"
- Feature highlights (with beautiful screenshots/animations) — include mobile screenshots prominently
- "Built for people who ship" testimonials (fake but realistic)
- Pricing tiers (Free / Pro / Team)
- CTA to sign up
- Trust bar: "Used by founders at Vercel, Linear, and 10,000+ ambitious creators"

### Auth Pages
- Login (beautiful centered card)
- Sign up (with workspace name field)
- Password reset
- Magic link sent confirmation

### Main App Layout (Adaptive)
- **Desktop**: Fixed collapsible sidebar + top nav + main content + optional right sidebar
- **Mobile**: Bottom navigation bar + top nav (minimal) + floating action button + bottom sheets for details
- **Tablet**: Hybrid (collapsible sidebar or bottom nav based on orientation)
- Search, notifications, and user menu adapt beautifully to screen size
- Right sidebar becomes bottom sheet on mobile

### Routes
- `/` → Today view (smart daily dashboard)
- `/tasks` → All tasks with view switcher
- `/notes` → All notes + new note button
- `/calendar`
- `/teams`
- `/admin` (admin only)
- `/workspace/[id]/note/[id]`
- `/workspace/[id]/task/[id]`

## Data Models (Supabase)

**Users** (extended auth.users)
- id, email, full_name, avatar_url, role (user/admin/owner), created_at, last_active

**Workspaces**
- id, name, slug, logo_url, owner_id, created_at, settings (jsonb)

**Workspace Members**
- workspace_id, user_id, role, joined_at, invited_by

**Tasks**
- id, workspace_id, title, description, status, priority, due_date, assignee_ids (array), parent_task_id, recurring_rule, time_estimate, time_spent, tags (array), linked_note_ids (array), created_by, created_at, updated_at, completed_at

**Notes**
- id, workspace_id, title, content (jsonb for TipTap), parent_note_id, is_archived, tags, linked_task_ids, created_by, created_at, updated_at, last_edited_by

**Comments**
- id, content, user_id, task_id or note_id, parent_comment_id, created_at

**Activity Log**
- id, workspace_id, user_id, action_type, target_type, target_id, metadata (jsonb), created_at

## Performance & Quality Requirements
- Lighthouse score 95+ on desktop and mobile
- All interactions feel instant (<100ms perceived)
- Smooth 60fps animations everywhere
- Zero layout shift
- Accessible (WCAG 2.2 AA)
- SEO optimized landing page
- Error boundaries + beautiful error states
- Loading states that feel premium (skeletons + shimmer)

## Final Instructions

Build this as a **complete, production-ready application**.

Start by setting up the full Next.js + Supabase project structure with proper TypeScript, ESLint, Prettier, and shadcn/ui.

Then implement authentication, then the core task system, then notes, then AI features, then polish.

Make every screen feel **world-class** — better than Notion, Todoist, and Linear combined.

When you're done, the user should be able to:
1. Sign up
2. Create a workspace
3. Invite teammates
4. Start creating notes and tasks immediately
5. Feel like they're using the future of productivity software

**Output the complete, runnable codebase** with all necessary files, environment variables documented, and a beautiful README.

This is going to be legendary. Let's build the most bad ass notes and task app ever made.
