"use client";

import { useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export function SupabaseSetupBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (isSupabaseConfigured() || dismissed) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] max-w-xl w-full mx-4">
      <div className="glass border border-[#c084fc]/30 rounded-2xl px-6 py-4 text-sm shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="text-[#c084fc] text-xl mt-0.5">🚀</div>
          <div className="flex-1">
            <div className="font-semibold text-[#c084fc]">Ready for real data &amp; auth?</div>
            <div className="text-[#a1a1aa] mt-1 text-[13px]">
              This is currently running in beautiful local demo mode. 
              Connect Supabase to unlock real-time sync, auth, workspaces, and persistence across devices.
            </div>
            <div className="mt-3 flex gap-2 text-xs">
              <a 
                href="https://supabase.com/dashboard" 
                target="_blank"
                className="btn btn-primary text-xs px-4 py-1.5"
              >
                Create free Supabase project
              </a>
              <button 
                onClick={() => setDismissed(true)}
                aria-label="Dismiss Supabase setup banner for now"
                className="btn btn-ghost text-xs px-3"
              >
                Dismiss for now
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
