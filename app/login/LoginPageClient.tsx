"use client";

import { Suspense, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckSquare } from "lucide-react";
import { AuthPanel, type AuthMode } from "@/components/AuthPanel";
import { useTaskStore } from "@/store/useTaskStore";

function sanitizeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useTaskStore((s) => s.user);

  const next = sanitizeNextPath(searchParams.get("next"));
  const modeParam = searchParams.get("mode");
  const initialMode: AuthMode =
    modeParam === "signup"
      ? "signup"
      : modeParam === "reset-verify"
        ? "reset-verify"
        : "signin";

  const goToApp = useCallback(() => {
    router.replace(next);
  }, [router, next]);

  useEffect(() => {
    if (user) {
      goToApp();
    }
  }, [user, goToApp]);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-bg text-text-primary flex flex-col">
      <header className="flex shrink-0 items-center justify-between px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5 text-text-primary hover:opacity-90 transition">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neon-purple">
            <CheckSquare className="h-4 w-4 text-on-accent" strokeWidth={2.5} />
          </div>
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
        <AuthPanel initialMode={initialMode} onSuccess={goToApp} />
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