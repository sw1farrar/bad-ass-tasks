"use client";

import { useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export function SupabaseSetupBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (isSupabaseConfigured() || dismissed) return null;

  return (
    <div
      data-landing-capture-hide
      className="fixed top-[calc(3.25rem+env(safe-area-inset-top,4px))] left-1/2 -translate-x-1/2 z-[65] max-w-[min(26rem,calc(100vw-1.5rem))] w-full mx-3 md:top-auto md:bottom-[calc(6rem+env(safe-area-inset-bottom,0))] md:max-w-xl md:z-[60]"
    >
      <div className="supabase-setup-banner glass border border-neon-purple/30 rounded-2xl md:rounded-2xl px-3 py-1.5 md:px-6 md:py-4 text-xs md:text-sm shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="text-neon-purple text-xl mt-0.5">🚀</div>
          <div className="flex-1">
            <div className="font-semibold text-neon-purple text-xs md:text-sm">Connect to Supabase for real data &amp; realtime.</div>
            <div className="text-text-secondary text-[10px] md:text-[13px] md:mt-0.5 leading-tight hidden md:block">
              Auth, teams, cross-device sync, and live collaboration.
            </div>
            <div className="mt-1 md:mt-3 flex gap-2 text-[10px] md:text-xs">
              <a 
                href="https://supabase.com/dashboard" 
                target="_blank"
                className="btn btn-primary text-[10px] md:text-xs px-3 py-1 md:px-4 md:py-1.5"
              >
                Create project
              </a>
              <button 
                onClick={() => setDismissed(true)}
                aria-label="Dismiss Supabase setup banner for now"
                className="btn btn-ghost text-[10px] md:text-xs px-2 md:px-3"
              >
                Dismiss
              </button>
            </div>
            <div className="mt-3 text-[11px] text-text-muted">
              See <code>docs/MILESTONE-1-SUPABASE-ACTIVATION.md</code> for the exact SQL + steps.
            </div>
          </div>
          <button 
            onClick={() => setDismissed(true)} 
            aria-label="Dismiss Supabase setup banner"
            className="text-text-muted hover:text-text-primary p-1 rounded focus:outline-none focus:ring-1 focus:ring-neon-purple/30"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
