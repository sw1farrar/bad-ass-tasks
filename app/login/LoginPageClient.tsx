"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { AuthPanel, type AuthMode } from "@/components/AuthPanel";
import { AuthTransitionPanel } from "@/components/AuthTransitionPanel";
import { isRecoverySession } from "@/lib/auth/recoverySession";
import { useTaskStore } from "@/store/useTaskStore";

function sanitizeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useTaskStore((s) => s.user);
  const session = useTaskStore((s) => s.session);
  const isAuthLoading = useTaskStore((s) => s.isAuthLoading);
  const [authReady, setAuthReady] = useState(false);

  const next = sanitizeNextPath(searchParams.get("next"));
  const modeParam = searchParams.get("mode");
  const initialMode: AuthMode =
    modeParam === "signup"
      ? "signup"
      : modeParam === "reset-verify"
        ? "reset-verify"
        : modeParam === "reset-request"
          ? "reset-request"
          : "signin";
  const initialEmail = searchParams.get("email")?.trim().toLowerCase() ?? "";

  const goToApp = useCallback(() => {
    router.replace(next);
  }, [router, next]);

  useEffect(() => {
    void useTaskStore
      .getState()
      .initializeAuth()
      .finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    if (user && !isRecoverySession(session)) {
      goToApp();
    }
  }, [user, session, goToApp]);

  const completingRecovery = !!user && isRecoverySession(session);
  const showTransition = !authReady || isAuthLoading || (!!user && !completingRecovery);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-bg text-text-primary flex flex-col">
      <header className="flex shrink-0 items-center justify-between px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5 text-text-primary hover:opacity-90 transition">
          <BrandLogo size="md" />
          <span className="text-[15px] font-semibold tracking-tight sm:text-base">Badazz Tasks</span>
        </Link>
        <Link
          href="/"
          className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary min-h-[44px] flex items-center px-2"
        >
          Back to home
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {showTransition ? (
          <AuthTransitionPanel
            subtitle={user?.email ? `Signed in as ${user.email}` : "Just a moment"}
          />
        ) : (
          <AuthPanel initialMode={initialMode} initialEmail={initialEmail} />
        )}
      </main>
    </div>
  );
}

export function LoginPageClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bg flex items-center justify-center text-text-muted text-sm">
          Loading…
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}