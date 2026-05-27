"use client";

import { useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export function SupabaseSetupBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (isSupabaseConfigured() || dismissed) return null;

  return (
    <div className="fixed top-[calc(3.25rem+env(safe-area-inset-top,4px))] left-1/2 -translate-x-1/2 z-[65] max-w-[min(26rem,calc(100vw-1.5rem))] w-full mx-3 md:top-auto md:bottom-20 md:max-w-xl md:z-[60]">
      <div className="glass border border-[#c084fc]/30 rounded-2xl md:rounded-2xl px-3 py-1.5 md:px-6 md:py-4 text-xs md:text-sm shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="text-[#c084fc] text-xl mt-0.5">🚀</div>
          <div className="flex-1">
            <div className="font-semibold text-[#c084fc] text-xs md:text-sm">Connected to Supabase — real infrastructure.</div>
            <div className="text-[#a1a1aa] text-[10px] md:text-[13px] md:mt-0.5 leading-tight hidden md:block">
              Real-time sync, auth, workspaces &amp; persistence across devices.
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
            <div className="mt-3 text-[11px] text-[#71717a]">
              1. Create project → 2. Copy URL + anon key into <code>.env.local</code> → 3. Run the schema in <code>supabase/schema.sql</code>
            </div>
          </div>
          <button 
            onClick={() => setDismissed(true)} 
            aria-label="Dismiss Supabase setup banner"
            className="text-[#71717a] hover:text-white p-1 rounded focus:outline-none focus:ring-1 focus:ring-white/30"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
