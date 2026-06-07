"use client";

import {
  User,
  CheckSquare,
  FileText,
  Users,
  MessageCircle,
  Bell,
  LayoutGrid,
  Loader2,
} from "lucide-react";

interface LandingPageProps {
  onSignIn: () => void;
  isCheckingSession?: boolean;
}

const CAPABILITIES = [
  {
    icon: CheckSquare,
    title: "Tasks",
    description: "Create tasks, set priorities and due dates, and use a Today view to focus on what is due.",
  },
  {
    icon: FileText,
    title: "Notes",
    description: "Write notes in a rich editor. Organize pages, link ideas, and keep work in one place.",
  },
  {
    icon: LayoutGrid,
    title: "Workspaces",
    description: "Separate projects or teams into their own workspace. Switch between them anytime.",
  },
  {
    icon: Users,
    title: "Team",
    description: "Invite people, assign roles, and manage who has access to a workspace.",
  },
  {
    icon: MessageCircle,
    title: "Chat",
    description: "Message your team inside each workspace without leaving the app.",
  },
  {
    icon: Bell,
    title: "Notifications",
    description: "See mentions, comments, invites, and updates in one inbox.",
  },
] as const;

function AppPreviewMock() {
  return (
    <div className="relative w-full max-w-md mx-auto lg:mx-0 lg:ml-auto rounded-2xl border border-white/[0.08] bg-[#111114] shadow-2xl overflow-hidden">
      <div className="flex border-b border-white/[0.06]">
        <div className="w-[72px] border-r border-white/[0.06] p-3 space-y-2">
          <div className="h-2 w-10 rounded bg-white/10" />
          <div className="h-7 rounded-lg bg-[#c084fc]/20 border border-[#c084fc]/25" />
          <div className="h-7 rounded-lg bg-white/[0.04]" />
          <div className="h-7 rounded-lg bg-white/[0.04]" />
          <div className="h-7 rounded-lg bg-white/[0.04]" />
        </div>
        <div className="flex-1 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-3 w-24 rounded bg-white/15" />
            <div className="h-6 w-6 rounded-full bg-[#c084fc]/30" />
          </div>
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
              <div className="h-3.5 w-3.5 rounded border border-[#c084fc]/50" />
              <div className="h-2 flex-1 max-w-[140px] rounded bg-white/12" />
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
              <div className="h-3.5 w-3.5 rounded border border-white/20" />
              <div className="h-2 flex-1 max-w-[180px] rounded bg-white/10" />
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 opacity-70">
              <div className="h-3.5 w-3.5 rounded border border-white/15" />
              <div className="h-2 flex-1 max-w-[120px] rounded bg-white/8" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage({ onSignIn, isCheckingSession }: LandingPageProps) {
  return (
    <div className="fixed inset-0 z-[150] overflow-y-auto bg-[#0a0a0f] text-[#f4f4f5]" aria-label="Badazz Tasks">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(192,132,252,0.12),transparent)]" />

      <header className="relative max-w-6xl mx-auto px-6 pt-8 pb-4 flex items-center justify-between">
        <div className="font-semibold tracking-tight text-lg">Badazz Tasks</div>
        <button
          onClick={onSignIn}
          className="btn btn-secondary text-sm px-5 py-2"
          disabled={isCheckingSession}
        >
          Sign in
        </button>
      </header>

      <section className="relative max-w-6xl mx-auto px-6 pt-12 pb-20 lg:pt-20 lg:pb-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <p className="text-sm text-[#c084fc] mb-4 tracking-wide">Get shit done. Beautifully.</p>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-semibold tracking-[-0.03em] leading-[1.05] mb-6">
              Tasks, notes, and teamwork in one calm workspace.
            </h1>
            <p className="text-[#a1a1aa] text-base sm:text-lg leading-relaxed max-w-lg mb-8">
              Badazz Tasks helps you plan your day, capture ideas, and work with your team — without switching between a dozen apps.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={onSignIn}
                disabled={isCheckingSession}
                className="btn btn-primary text-base px-8 py-3.5 flex items-center justify-center gap-2 font-medium disabled:opacity-70"
              >
                {isCheckingSession ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </>
                ) : (
                  <>
                    <User className="h-4 w-4" />
                    Get started
                  </>
                )}
              </button>
            </div>
          </div>

          <AppPreviewMock />
        </div>
      </section>

      <section id="features" className="relative border-t border-white/[0.06] bg-[#0c0c10]">
        <div className="max-w-6xl mx-auto px-6 py-16 lg:py-24">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3">What you can do</h2>
          <p className="text-[#71717a] text-sm sm:text-base mb-12 max-w-2xl">
            Everything below is built into the app today — tasks, notes, teams, chat, and notifications, saved to your account.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {CAPABILITIES.map(({ icon: Icon, title, description }) => (
              <article
                key={title}
                className="rounded-2xl border border-white/[0.06] bg-[#111114]/80 p-5 hover:border-white/[0.1] transition-colors"
              >
                <div className="h-9 w-9 rounded-xl bg-[#c084fc]/10 border border-[#c084fc]/20 flex items-center justify-center mb-4">
                  <Icon className="h-4 w-4 text-[#c084fc]" strokeWidth={1.75} />
                </div>
                <h3 className="font-medium text-[15px] mb-2">{title}</h3>
                <p className="text-sm text-[#a1a1aa] leading-relaxed">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4">Ready when you are</h2>
          <p className="text-[#71717a] mb-8 text-sm sm:text-base max-w-md mx-auto">
            Create a free account and set up your first workspace in minutes.
          </p>
          <button
            onClick={onSignIn}
            disabled={isCheckingSession}
            className="btn btn-primary text-base px-10 py-3.5 inline-flex items-center gap-2 font-medium disabled:opacity-70"
          >
            <User className="h-4 w-4" />
            Get started
          </button>
        </div>
      </section>
    </div>
  );
}