"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const workspaceNameEase = [0.22, 1, 0.36, 1] as const;

type WorkspaceSwitchVariant = "sidebar" | "mobile" | "bottom-nav";

interface WorkspaceSwitchEffectsProps {
  workspaceId: string;
  variant?: WorkspaceSwitchVariant;
  className?: string;
}

export function WorkspaceSwitchEffects({
  workspaceId,
  variant = "sidebar",
  className,
}: WorkspaceSwitchEffectsProps) {
  if (variant === "bottom-nav") {
    return (
      <div
        className={cn("absolute inset-0 pointer-events-none overflow-hidden z-0", className)}
        aria-hidden
      >
        <AnimatePresence>
          <motion.div
            key={`bnav-bloom-${workspaceId}`}
            initial={{ opacity: 0.55, scaleY: 0.85 }}
            animate={{ opacity: 0, scaleY: 1.12 }}
            transition={{ duration: 0.95, ease: "easeOut" }}
            className="absolute inset-0 bg-gradient-to-t from-[#c084fc]/28 via-[#a855f7]/10 to-transparent"
          />
          <motion.div
            key={`bnav-shimmer-${workspaceId}`}
            initial={{ x: "-140%", opacity: 0.85 }}
            animate={{ x: "240%", opacity: 0 }}
            transition={{ duration: 1.05, ease: workspaceNameEase, delay: 0.03 }}
            className="absolute inset-y-0 w-[42%] bg-gradient-to-r from-transparent via-[#f5f3ff]/22 to-transparent -skew-x-12"
          />
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={`bnav-spark-${workspaceId}-${i}`}
              initial={{ opacity: 0, y: 6, scale: 0 }}
              animate={{ opacity: [0, 0.9, 0], y: -14 - i * 5, scale: [0, 1, 0.4] }}
              transition={{ duration: 0.75, delay: 0.1 + i * 0.065, ease: "easeOut" }}
              className="absolute bottom-2.5 h-1 w-1 rounded-full bg-[#e9d5ff]"
              style={{
                left: `${10 + i * 20}%`,
                boxShadow: "0 0 8px rgba(233, 213, 255, 0.85)",
              }}
            />
          ))}
        </AnimatePresence>

        <motion.div
          key={`bnav-line-${workspaceId}`}
          initial={{ scaleX: 0.12, opacity: 0.25 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="absolute left-0 right-0 top-0 h-[2px] origin-center bg-gradient-to-r from-transparent via-[#c084fc] to-transparent"
          style={{ boxShadow: "0 0 22px rgba(192, 132, 252, 0.5)" }}
        />
      </div>
    );
  }

  const isMobile = variant === "mobile";

  return (
    <div className={cn("absolute inset-0 pointer-events-none overflow-hidden", className)} aria-hidden>
      <AnimatePresence>
        <motion.div
          key={`ws-burst-${workspaceId}`}
          initial={{ opacity: isMobile ? 0.65 : 0.5, scale: 0.96 }}
          animate={{ opacity: 0, scale: isMobile ? 1.04 : 1.06 }}
          transition={{ duration: isMobile ? 0.85 : 0.7, ease: "easeOut" }}
          className={cn(
            "absolute inset-0 bg-[#c084fc]/20",
            isMobile ? "rounded-none" : "rounded-xl",
          )}
        />
        <motion.div
          key={`ws-shimmer-${workspaceId}`}
          initial={{ x: "-120%", opacity: isMobile ? 0.85 : 0.7 }}
          animate={{ x: "220%", opacity: 0 }}
          transition={{ duration: isMobile ? 0.9 : 0.75, ease: "easeOut", delay: 0.04 }}
          className={cn(
            "absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-12",
            isMobile && "via-[#e9d5ff]/35",
          )}
        />
      </AnimatePresence>

      <motion.div
        key={`ws-accent-${workspaceId}`}
        initial={isMobile ? { scaleX: 0.15, opacity: 0.35 } : { scaleY: 0.2, opacity: 0.4 }}
        animate={isMobile ? { scaleX: 1, opacity: 1 } : { scaleY: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 30 }}
        className={cn(
          isMobile
            ? "absolute left-0 right-0 bottom-0 h-[2px] origin-center bg-gradient-to-r from-[#a855f7] via-[#c084fc] to-[#a855f7]"
            : "absolute left-0 top-1.5 bottom-1.5 w-[3px] origin-center rounded-full bg-gradient-to-b from-[#e9d5ff] via-[#c084fc] to-[#a855f7]",
        )}
        style={{ boxShadow: "0 0 16px rgba(192, 132, 252, 0.55)" }}
      />
    </div>
  );
}

interface AnimatedBottomNavItemContentProps {
  workspaceId: string;
  itemId: string;
  index: number;
  children: React.ReactNode;
  className?: string;
}

export function AnimatedBottomNavItemContent({
  workspaceId,
  itemId,
  index,
  children,
  className,
}: AnimatedBottomNavItemContentProps) {
  return (
    <motion.div
      key={`${workspaceId}-${itemId}`}
      initial={{ opacity: 0.15, y: 10, scale: 0.84, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={{
        delay: 0.05 + index * 0.065,
        duration: 0.52,
        ease: workspaceNameEase,
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 w-full min-h-0",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

interface AnimatedWorkspaceNameProps {
  workspaceId: string;
  name: string;
  className?: string;
}

export const AnimatedWorkspaceName = React.forwardRef<HTMLSpanElement, AnimatedWorkspaceNameProps>(
  function AnimatedWorkspaceName({ workspaceId, name, className }, ref) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={workspaceId}
          ref={ref}
          initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
          transition={{ duration: 0.34, ease: workspaceNameEase }}
          className={className}
        >
          {name}
        </motion.span>
      </AnimatePresence>
    );
  },
);