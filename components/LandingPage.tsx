"use client";

import { useState } from "react";
import {
  CheckSquare,
  FileText,
  LayoutList,
  Loader2,
  StickyNote,
  Users,
} from "lucide-react";
import { LandingFeaturesModal } from "@/components/landing/LandingFeaturesModal";
import "@/components/landing/landing-page.css";

interface LandingPageProps {
  onSignIn: () => void;
  isCheckingSession?: boolean;
}

const FEATURES = [
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "lists", label: "Lists", icon: LayoutList },
  { id: "files", label: "Files", icon: FileText },
  { id: "team", label: "Teams", icon: Users },
] as const;

export function LandingPage({ onSignIn, isCheckingSession }: LandingPageProps) {
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [featuresSectionId, setFeaturesSectionId] = useState<string | undefined>();

  const openFeatures = (sectionId?: string) => {
    setFeaturesSectionId(sectionId);
    setFeaturesOpen(true);
  };

  return (
    <>
      <div
        className="landing-page landing-shell fixed inset-0 z-[150] bg-bg text-text-primary"
        aria-label="Badazz Tasks"
      >
        <div className="landing-page__ambient pointer-events-none absolute inset-0" aria-hidden />
        <div className="landing-page__grid pointer-events-none absolute inset-0" aria-hidden />

        <div className="relative flex h-full flex-col">
          <header className="landing-header flex shrink-0 items-center justify-between px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2 sm:px-10">
            <div className="flex items-center gap-2.5">
              <div className="landing-brand-icon flex h-8 w-8 items-center justify-center rounded-lg bg-neon-purple">
                <CheckSquare className="h-4 w-4 text-on-accent" strokeWidth={2.5} />
              </div>
              <span className="text-[15px] font-semibold tracking-tight sm:text-base">
                Badazz Tasks
              </span>
            </div>
            <button
              onClick={onSignIn}
              disabled={isCheckingSession}
              className="landing-sign-in text-sm font-medium text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50 min-h-[44px] px-2"
            >
              Sign in
            </button>
          </header>

          <main className="landing-main flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-10">
            <div className="landing-hero w-full max-w-2xl text-center">
              <p className="landing-eyebrow text-[11px] font-medium uppercase tracking-[0.22em] text-text-muted sm:text-xs">
                Workspace for people who ship
              </p>

              <h1 className="landing-headline mt-5 text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.04em] sm:mt-6 sm:text-[3.25rem] md:text-[3.75rem]">
                Get shit done.
                <span className="landing-headline-accent block font-normal text-text-secondary">
                  Beautifully.
                </span>
              </h1>

              <p className="landing-subcopy mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-text-muted sm:mt-6 sm:text-base">
                Tasks, notes, lists, and files — one calm place for you and your team.
              </p>

              <div className="mt-8 flex flex-col items-center gap-3 sm:mt-10">
                <button
                  onClick={() => openFeatures()}
                  disabled={isCheckingSession}
                  className="landing-cta btn btn-primary h-12 min-w-[11rem] px-9 text-sm font-medium disabled:opacity-50"
                >
                  Learn more
                </button>
                <button
                  type="button"
                  onClick={onSignIn}
                  disabled={isCheckingSession}
                  className="text-sm font-medium text-text-secondary transition hover:text-text-primary disabled:opacity-50 min-h-[44px] px-2"
                >
                  {isCheckingSession ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading…
                    </span>
                  ) : (
                    "Sign in to your account"
                  )}
                </button>
              </div>
            </div>

            <ul className="landing-features mt-12 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 sm:mt-14 sm:gap-x-7">
              {FEATURES.map(({ id, label, icon: Icon }) => (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() => openFeatures(id)}
                    className="landing-feature flex items-center gap-2 text-sm text-text-secondary"
                  >
                    <Icon className="h-3.5 w-3.5 text-neon-purple" strokeWidth={2} aria-hidden />
                    <span>{label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </main>
        </div>
      </div>

      <LandingFeaturesModal
        open={featuresOpen}
        onClose={() => setFeaturesOpen(false)}
        onSignIn={onSignIn}
        initialSectionId={featuresSectionId}
      />
    </>
  );
}