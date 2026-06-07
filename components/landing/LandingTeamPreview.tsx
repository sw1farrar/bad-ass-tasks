"use client";

import { formatRoleLabel } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { LANDING_MEMBERS } from "./landingSampleData";

export function LandingTeamPreview() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111114] p-4 shadow-xl" aria-hidden>
      <div className="text-xs text-[#71717a] font-medium tracking-widest mb-3">TEAM</div>
      <div className="space-y-2">
        {LANDING_MEMBERS.map((member) => (
          <div
            key={member.name}
            className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#141418] px-3 py-2.5"
          >
            <div className="relative">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#c084fc] to-[#a855f7] flex items-center justify-center text-xs font-bold text-black">
                {member.initials}
              </div>
              {member.online && (
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#00ff9f] ring-2 ring-[#141418]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{member.name}</div>
              <div className="text-[11px] text-[#71717a]">{formatRoleLabel(member.role.toLowerCase() as "owner" | "admin" | "member")}</div>
            </div>
            <span
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-md font-medium",
                member.online
                  ? "bg-[#00ff9f]/10 text-[#00ff9f] border border-[#00ff9f]/25"
                  : "bg-white/5 text-[#71717a] border border-white/10",
              )}
            >
              {member.online ? "Online" : "Away"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}