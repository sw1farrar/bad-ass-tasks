"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { WorkspaceViewHeader } from "@/components/WorkspaceViewHeader";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { memberColorMap } from "@/lib/health/healthAggregates";
import { isSharedWorkspace } from "@/lib/assignee";
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
import { HealthStressPanel } from "./components/HealthStressPanel";
import { LogStressSheet } from "./components/LogStressSheet";
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
  const isStressTab = activeTab === "stress";
  const showMemberFilter = !isStressTab && isSharedWorkspace(members);

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
        toast.success(input.metricType === "stress" ? "Stress check-in saved" : "Health entry logged");
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

  const pendingDelete = pendingDeleteId
    ? readings.find((r) => r.id === pendingDeleteId)
    : undefined;

  const openLog = () => setLogOpen(true);

  const changeTab = (tab: typeof activeTab) => {
    setLogOpen(false);
    onTabChange(tab);
  };

  return (
    <div className="health-root">
    <div className="health-workspace bg-bg">
      <div className="health-workspace__chrome shrink-0">
      <div className="px-3 md:px-4 pt-3 md:pt-4">
      <WorkspaceViewHeader
        title="Health"
        workspaceName={workspaceName ?? ""}
        hideWorkspaceLabelOnMobile
        hideWorkspaceNameOnMobile
        description={
          isMobile
            ? undefined
            : isStressTab
              ? "Private to you — teammates never see scores or comments"
              : "Shared workspace tracking — all members can log and view readings"
        }
        variant="inline"
        actions={
          !isMobile ? (
            <button
              type="button"
              onClick={openLog}
              className="inline-flex items-center gap-2 min-h-[44px] rounded-xl bg-neon-purple px-3 py-2 text-xs font-semibold text-white hover:opacity-90 transition"
            >
              <Plus className="h-4 w-4" />
              {isStressTab ? "Log stress" : "Log entry"}
            </button>
          ) : undefined
        }
      />
      </div>

      {showMemberFilter ? (
        <HealthMemberFilter
          members={members}
          selectedId={selectedMemberId}
          onChange={onMemberChange}
          colorMap={colorMap}
        />
      ) : null}

      <HealthSectionMenu activeTab={activeTab} onTabChange={changeTab} />
      </div>

      {isMobile && !logOpen ? (
        <button
          type="button"
          onClick={openLog}
          className={cn(
            "health-fab fixed z-[55] flex items-center justify-center",
            "h-12 w-12 rounded-full bg-neon-purple text-white shadow-lg active:scale-95 transition",
          )}
          style={{
            right: "max(1rem, env(safe-area-inset-right, 16px))",
            bottom: "calc(6.5rem + env(safe-area-inset-bottom, 10px))",
          }}
          aria-label={isStressTab ? "Log stress" : "Log health entry"}
        >
          <Plus className="h-5 w-5" />
        </button>
      ) : null}

      <div className="health-workspace__content">
        {activeTab === "overview" ? (
          <HealthOverviewPanel
            readings={filteredReadings}
            profiles={profiles}
            members={members}
            selectedMemberId={selectedMemberId}
            currentUserId={currentUserId}
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
        {activeTab === "stress" ? (
          <HealthStressPanel
            readings={
              currentUserId
                ? readings.filter((r) => r.userId === currentUserId)
                : readings
            }
            onDeleteReading={setPendingDeleteId}
          />
        ) : null}
      </div>

      {isStressTab ? (
        <LogStressSheet
          open={logOpen}
          onClose={() => setLogOpen(false)}
          onSubmit={async (input) => {
            await handleLog({
              metricType: "stress",
              value: input.value,
              unit: "score",
              recordedAt: input.recordedAt,
              note: input.note,
              metadata: input.drivers.length ? { drivers: input.drivers } : undefined,
            });
          }}
        />
      ) : (
        <LogHealthModal
          open={logOpen}
          onClose={() => setLogOpen(false)}
          defaultTab={activeTab}
          defaultMetric={defaultMetric}
          onSubmit={handleLog}
        />
      )}

      <ConfirmationModal
        open={!!pendingDeleteId}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title={pendingDelete?.metricType === "stress" ? "Delete this check-in?" : "Delete health entry?"}
        description={
          pendingDelete?.metricType === "stress"
            ? "This stress check-in will be removed. Only you can see these."
            : "This measurement will be permanently removed for everyone in the workspace."
        }
        confirmText="Delete entry"
        variant="destructive"
        onConfirm={() => void confirmDelete()}
      />
    </div>
    </div>
  );
}