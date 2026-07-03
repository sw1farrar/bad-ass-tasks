"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { WorkspaceViewHeader } from "@/components/WorkspaceViewHeader";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { memberColorMap } from "@/lib/health/healthAggregates";
import type { HealthSectionTab } from "@/lib/health/healthSections";
import type { HealthMetricType, HealthProfile, HealthReading, WorkspaceMember } from "@/types";
import { HealthSectionMenu } from "./components/HealthSectionMenu";
import { HealthMemberFilter } from "./components/HealthMemberFilter";
import { LogHealthModal } from "./components/LogHealthModal";
import { HealthOverviewPanel } from "./components/HealthOverviewPanel";
import { HealthWeightPanel } from "./components/HealthWeightPanel";
import { HealthBodyPanel } from "./components/HealthBodyPanel";
import { HealthVitalsPanel } from "./components/HealthVitalsPanel";
import { HealthActivityPanel } from "./components/HealthActivityPanel";
import "./health-workspace.css";

export interface HealthViewProps {
  workspaceId: string;
  workspaceName?: string;
  readings: HealthReading[];
  profiles: HealthProfile[];
  members: WorkspaceMember[];
  currentUserId?: string;
  activeTab: HealthSectionTab;
  selectedMemberId: string | "all";
  onTabChange: (tab: HealthSectionTab) => void;
  onMemberChange: (id: string | "all") => void;
  onAddReading: (input: {
    metricType: HealthMetricType;
    value: number;
    unit: string;
    recordedAt?: string;
    note?: string | null;
    metadata?: Record<string, unknown>;
  }) => Promise<HealthReading | null>;
  onDeleteReading: (id: string) => Promise<boolean>;
  onUpdateProfile: (input: {
    heightCm?: number | null;
    weightGoal?: number | null;
    weightUnit?: string;
  }) => Promise<boolean>;
}

export function HealthView({
  workspaceName,
  readings,
  profiles,
  members,
  currentUserId,
  activeTab,
  selectedMemberId,
  onTabChange,
  onMemberChange,
  onAddReading,
  onDeleteReading,
  onUpdateProfile,
}: HealthViewProps) {
  const isMobile = useIsMobileViewport();
  const [logOpen, setLogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const filteredReadings = useMemo(() => {
    const list = [...readings].sort(
      (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
    );
    if (selectedMemberId === "all") return list;
    return list.filter((r) => r.userId === selectedMemberId);
  }, [readings, selectedMemberId]);

  const colorMap = useMemo(() => memberColorMap(members), [members]);

  const handleLog = useCallback(
    async (input: {
      metricType: HealthMetricType;
      value: number;
      unit: string;
      recordedAt: string;
      note?: string;
      metadata?: Record<string, unknown>;
    }) => {
      const res = await onAddReading({
        ...input,
        recordedAt: input.recordedAt,
      });
      if (res) {
        toast.success("Health entry logged");
      } else {
        toast.error("Could not save entry");
      }
    },
    [onAddReading],
  );

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    const ok = await onDeleteReading(pendingDeleteId);
    if (ok) toast.success("Entry deleted");
    else toast.error("Could not delete entry");
    setPendingDeleteId(null);
  };

  const defaultMetric: HealthMetricType | undefined =
    activeTab === "weight"
      ? "weight"
      : activeTab === "body"
        ? "body_fat"
        : activeTab === "vitals"
          ? "blood_pressure_systolic"
          : activeTab === "activity"
            ? "steps"
            : undefined;

  return (
    <div className="health-root flex flex-col flex-1 min-h-0">
    <div className="health-workspace flex flex-col h-full min-h-0 bg-bg">
      <div className="px-3 md:px-4 pt-3 md:pt-4 shrink-0">
      <WorkspaceViewHeader
        title="Health"
        workspaceName={workspaceName ?? ""}
        hideWorkspaceLabelOnMobile
        hideWorkspaceNameOnMobile
        description={
          isMobile
            ? undefined
            : "Shared workspace tracking — all members can log and view readings"
        }
        variant="inline"
        actions={
          !isMobile ? (
            <button
              type="button"
              onClick={() => setLogOpen(true)}
              className="inline-flex items-center gap-2 min-h-[44px] rounded-xl bg-neon-purple px-3 py-2 text-xs font-semibold text-white hover:opacity-90 transition"
            >
              <Plus className="h-4 w-4" />
              Log entry
            </button>
          ) : undefined
        }
      />
      </div>

      <HealthMemberFilter
        members={members}
        selectedId={selectedMemberId}
        onChange={onMemberChange}
        colorMap={colorMap}
      />

      <HealthSectionMenu activeTab={activeTab} onTabChange={onTabChange} />

      {isMobile ? (
        <button
          type="button"
          onClick={() => setLogOpen(true)}
          className={cn(
            "health-fab fixed right-4 z-50 flex items-center justify-center",
            "h-12 w-12 rounded-full bg-neon-purple text-white shadow-lg active:scale-95 transition",
          )}
          style={{ bottom: "calc(6.5rem + env(safe-area-inset-bottom, 10px))" }}
          aria-label="Log health entry"
        >
          <Plus className="h-5 w-5" />
        </button>
      ) : null}

      <div className="health-workspace__content flex-1 min-h-0 overflow-y-auto max-md:overscroll-contain">
        {activeTab === "overview" ? (
          <HealthOverviewPanel
            readings={filteredReadings}
            profiles={profiles}
            members={members}
            selectedMemberId={selectedMemberId}
            onDeleteReading={setPendingDeleteId}
          />
        ) : null}
        {activeTab === "weight" ? (
          <HealthWeightPanel
            readings={filteredReadings}
            profiles={profiles}
            members={members}
            selectedMemberId={selectedMemberId}
            currentUserId={currentUserId}
            onDeleteReading={setPendingDeleteId}
            onUpdateProfile={onUpdateProfile}
          />
        ) : null}
        {activeTab === "body" ? (
          <HealthBodyPanel
            readings={filteredReadings}
            members={members}
            selectedMemberId={selectedMemberId}
            onDeleteReading={setPendingDeleteId}
          />
        ) : null}
        {activeTab === "vitals" ? (
          <HealthVitalsPanel
            readings={filteredReadings}
            members={members}
            selectedMemberId={selectedMemberId}
            onDeleteReading={setPendingDeleteId}
          />
        ) : null}
        {activeTab === "activity" ? (
          <HealthActivityPanel
            readings={filteredReadings}
            members={members}
            selectedMemberId={selectedMemberId}
            onDeleteReading={setPendingDeleteId}
          />
        ) : null}
      </div>

      <LogHealthModal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        defaultTab={activeTab}
        defaultMetric={defaultMetric}
        onSubmit={handleLog}
      />

      <ConfirmationModal
        open={!!pendingDeleteId}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Delete health entry?"
        description="This measurement will be permanently removed for everyone in the workspace."
        confirmText="Delete entry"
        variant="destructive"
        onConfirm={() => void confirmDelete()}
      />
    </div>
    </div>
  );
}