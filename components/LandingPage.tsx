"use client";

import { CheckSquare, Loader2 } from "lucide-react";
import { LandingProductPeek } from "@/components/landing/LandingProductPeek";
import "@/components/landing/landing-page.css";

interface LandingPageProps {
  onSignIn: () => void;
  isCheckingSession?: boolean;
}

export function LandingPage({ onSignIn, isCheckingSession }: LandingPageProps) {
  return (
    <div
      className="landing-page landing-shell fixed inset-0 z-[150] bg-[#0a0a0f] text-[#f4f4f5]"
      aria-label="Badazz Tasks"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-20%,rgba(255,255,255,0.04),transparent_60%)]"
        aria-hidden
      />

      <div className="relative flex h-full flex-col">
        <header className="flex shrink-0 items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 sm:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#c084fc]">
              <CheckSquare className="h-4 w-4 text-[#0a0a0f]" strokeWidth={2.5} />
            </div>
            <span className="text-[15px] font-semibold tracking-tight sm:text-base">
              Badazz Tasks
            </span>
          </div>
          <button
            onClick={onSignIn}
            disabled={isCheckingSession}
            className="text-sm font-medium text-[#a1a1aa] transition-colors hover:text-[#f4f4f5] disabled:opacity-50 min-h-[44px] px-2"
          >
            Sign in
          </button>
        </header>

        <main className="landing-main flex min-h-0 flex-1 flex-col px-5 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-12 xl:gap-16 xl:px-12">
          <div className="flex min-h-0 flex-1 flex-col justify-center text-center lg:flex-none lg:text-left">
            <h1 className="text-[1.65rem] font-semibold leading-[1.12] tracking-[-0.03em] sm:text-[2.25rem] lg:text-[3.25rem] lg:leading-[1.06]">
              Tasks, notes, and team{" "}
              <span className="text-[#a1a1aa] font-normal">— together.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-[#71717a] sm:text-base lg:mx-0 lg:mt-5 lg:max-w-md">
              A calm workspace for people who ship.
            </p>
            <div className="mt-7 flex justify-center lg:justify-start sm:mt-8">
              <button
                onClick={onSignIn}
                disabled={isCheckingSession}
                className="btn btn-primary h-11 min-w-[10.5rem] px-8 text-sm font-medium disabled:opacity-50"
              >
                {isCheckingSession ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </span>
                ) : (
                  "Get started"
                )}
              </button>
            </div>
          </div>

          <LandingProductPeek />
        </main>
      </div>
    </div>
  );
}