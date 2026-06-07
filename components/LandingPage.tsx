"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import {
  User,
  CheckSquare,
  FileText,
  Users,
  MessageCircle,
  Bell,
  LayoutGrid,
  Loader2,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { LandingAppPreview } from "@/components/landing/LandingAppPreview";
import { LandingTeamPreview } from "@/components/landing/LandingTeamPreview";

interface LandingPageProps {
  onSignIn: () => void;
  isCheckingSession?: boolean;
}

const FEATURES = [
  {
    icon: CheckSquare,
    title: "Tasks & Today",
    description: "Priorities, due dates, recurring work, and a focused Today view.",
  },
  {
    icon: FileText,
    title: "Notes",
    description: "Rich notes with linking — capture ideas beside your tasks.",
  },
  {
    icon: LayoutGrid,
    title: "Workspaces",
    description: "Separate projects and teams. Switch context in one click.",
  },
  {
    icon: Users,
    title: "Team",
    description: "Invite members, assign roles, transfer ownership when you need to.",
  },
  {
    icon: MessageCircle,
    title: "Chat",
    description: "Workspace chat so conversations stay with the work.",
  },
  {
    icon: Bell,
    title: "Notifications",
    description: "Invites, mentions, and updates in one inbox.",
  },
] as const;

function SignInButton({
  onSignIn,
  isCheckingSession,
  size = "default",
}: {
  onSignIn: () => void;
  isCheckingSession?: boolean;
  size?: "default" | "large";
}) {
  const large = size === "large";
  return (
    <button
      onClick={onSignIn}
      disabled={isCheckingSession}
      className={
        large
          ? "btn btn-primary text-base px-8 py-3.5 flex items-center justify-center gap-2 font-medium disabled:opacity-70"
          : "btn btn-primary text-sm px-6 py-2.5 flex items-center justify-center gap-2 font-medium disabled:opacity-70"
      }
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
  );
}

function ShowcaseSection({
  eyebrow,
  title,
  description,
  imageSrc,
  imageAlt,
  reverse,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  reverse?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="relative py-16 lg:py-24">
      <div
        className={`max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center ${
          reverse ? "lg:[&>*:first-child]:order-2" : ""
        }`}
      >
        <div className="relative">
          <div className="absolute -inset-4 rounded-3xl bg-[#c084fc]/10 blur-2xl opacity-60 pointer-events-none" />
          <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl ring-1 ring-white/[0.06]">
            <Image
              src={imageSrc}
              alt={imageAlt}
              width={1200}
              height={800}
              className="w-full h-auto object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </div>
        <div>
          <p className="text-sm text-[#c084fc] mb-3 tracking-wide font-medium">{eyebrow}</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4">{title}</h2>
          <p className="text-[#a1a1aa] leading-relaxed mb-6">{description}</p>
          {children}
        </div>
      </div>
    </section>
  );
}

export function LandingPage({ onSignIn, isCheckingSession }: LandingPageProps) {
  return (
    <div className="fixed inset-0 z-[150] overflow-y-auto bg-[#0a0a0f] text-[#f4f4f5]" aria-label="Badazz Tasks">
      {/* Ambient layers */}
      <div className="pointer-events-none fixed inset-0">
        <Image
          src="/landing/ambient-bg.jpg"
          alt=""
          fill
          className="object-cover opacity-30"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(192,132,252,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0f]/40 to-[#0a0a0f]" />
      </div>

      <header className="relative sticky top-0 z-20 border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#c084fc] to-[#a855f7] flex items-center justify-center">
              <CheckSquare className="h-4 w-4 text-black" />
            </div>
            <span className="font-semibold tracking-tight text-lg">Badazz Tasks</span>
          </div>
          <button
            onClick={onSignIn}
            className="btn btn-secondary text-sm px-5 py-2"
            disabled={isCheckingSession}
          >
            Sign in
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative max-w-6xl mx-auto px-6 pt-14 pb-20 lg:pt-20 lg:pb-28">
        <div className="grid lg:grid-cols-[1fr_1.05fr] gap-12 lg:gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#c084fc]/25 bg-[#c084fc]/10 px-3 py-1 text-xs text-[#c084fc] mb-6">
              <Sparkles className="h-3.5 w-3.5" />
              Built for teams that move fast
            </div>
            <p className="text-sm text-[#c084fc] mb-3 tracking-wide">Get shit done. Beautifully.</p>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.35rem] font-semibold tracking-[-0.03em] leading-[1.05] mb-6">
              Your tasks, notes, and team — in one calm workspace.
            </h1>
            <p className="text-[#a1a1aa] text-base sm:text-lg leading-relaxed max-w-lg mb-8">
              Badazz Tasks is the neon-dark productivity hub you see below — real UI, not a wireframe.
              Plan your day, write notes, invite your team, and stay in sync without app-hopping.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <SignInButton onSignIn={onSignIn} isCheckingSession={isCheckingSession} size="large" />
              <a
                href="#features"
                className="text-sm text-[#a1a1aa] hover:text-[#f4f4f5] inline-flex items-center gap-1.5 transition-colors px-2 py-2"
              >
                Explore features
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <LandingAppPreview />
        </div>
      </section>

      {/* Imagine showcase — Today & command */}
      <div className="relative border-t border-white/[0.06] bg-[#0c0c10]/80">
        <ShowcaseSection
          eyebrow="Focus"
          title="Command your day from Today"
          description="Jump to any task, note, or teammate with the command palette. The Today view surfaces what is due now — with the same task rows you use after sign-in."
          imageSrc="/landing/command.jpg"
          imageAlt="Neon Today view and command bar concept art"
        />
      </div>

      {/* Notes */}
      <ShowcaseSection
        eyebrow="Capture"
        title="Notes that connect to the work"
        description="Write in a rich editor, link ideas across pages, and keep context beside your tasks. Notes live in the same workspace as everything else."
        imageSrc="/landing/notes.jpg"
        imageAlt="Linked notes workspace concept art"
        reverse
      />

      {/* Team */}
      <div className="relative border-t border-white/[0.06] bg-[#0c0c10]/80">
        <ShowcaseSection
          eyebrow="Collaborate"
          title="Team presence, roles, and chat"
          description="Invite members, see who is online, assign roles, and message in workspace chat. Ownership transfers when you need to hand off the keys."
          imageSrc="/landing/team.jpg"
          imageAlt="Team collaboration concept art"
        >
          <LandingTeamPreview />
        </ShowcaseSection>
      </div>

      {/* Hero art band */}
      <section className="relative py-12 lg:py-16 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <div className="relative rounded-3xl overflow-hidden border border-white/10 min-h-[220px] sm:min-h-[280px]">
            <Image
              src="/landing/hero.jpg"
              alt="Floating task boards and collaboration UI concept art"
              fill
              className="object-cover object-center"
              sizes="(max-width: 1200px) 100vw, 1200px"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f] via-[#0a0a0f]/70 to-transparent" />
            <div className="relative z-10 p-8 sm:p-12 max-w-xl">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3">
                One workspace. Zero chaos.
              </h2>
              <p className="text-[#a1a1aa] text-sm sm:text-base leading-relaxed">
                Tasks, notes, team, chat, and notifications — designed as a single cohesive app with a signature neon-dark aesthetic.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section id="features" className="relative border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 py-16 lg:py-24">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3">Everything in one app</h2>
          <p className="text-[#71717a] text-sm sm:text-base mb-12 max-w-2xl">
            No bolt-ons. These are the real views waiting after you sign in.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <article
                key={title}
                className="rounded-2xl border border-white/[0.06] bg-[#111114]/80 p-5 hover:border-[#c084fc]/25 hover:bg-[#111114] transition-colors"
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

      {/* CTA */}
      <section className="relative border-t border-white/[0.06] pb-16">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4">Ready when you are</h2>
          <p className="text-[#71717a] mb-8 text-sm sm:text-base max-w-md mx-auto">
            Create a free account and set up your first workspace in minutes.
          </p>
          <SignInButton onSignIn={onSignIn} isCheckingSession={isCheckingSession} size="large" />
        </div>
      </section>
    </div>
  );
}