import type { HealthMetricType, HealthProfile, HealthReading } from "@/types";
import { generateId } from "@/lib/utils";
import { generateClientId, isSupabaseLive } from "@/lib/data/hybridStore";
import {
  createHealthReading as createReadingDb,
  deleteHealthReading as deleteReadingDb,
  ensureHealthPersistenceReady,
  isHealthPersistenceEnabled,
  updateHealthReading as updateReadingDb,
  upsertHealthProfile as upsertProfileDb,
} from "@/lib/data/healthStore";
import type { HealthSectionTab } from "@/lib/health/healthSections";

function newId(workspaceId: string): string {
  return isLiveWorkspace(workspaceId) ? generateClientId() : generateId();
}

function isLiveWorkspace(workspaceId: string): boolean {
  return isSupabaseLive() && !!workspaceId && !["", "w1", "w2"].includes(workspaceId);
}

function shouldPersist(workspaceId: string): boolean {
  return isLiveWorkspace(workspaceId) && isHealthPersistenceEnabled();
}

type HealthStoreSlice = {
  healthReadings: HealthReading[];
  healthProfiles: HealthProfile[];
  selectedHealthMemberId: string | "all";
  healthSectionTab: HealthSectionTab;
};

type Get = () => HealthStoreSlice & {
  currentWorkspace: { id: string };
  user: { id: string } | null;
};
type Set = (
  partial: Partial<HealthStoreSlice> | ((state: HealthStoreSlice) => Partial<HealthStoreSlice>),
) => void;

export type HealthSliceActions = {
  getHealthReadings: (opts?: {
    userId?: string | "all";
    metricType?: HealthMetricType;
  }) => HealthReading[];
  getHealthProfile: (userId: string) => HealthProfile | null;
  setSelectedHealthMemberId: (id: string | "all") => void;
  setHealthSectionTab: (tab: HealthSectionTab) => void;
  addHealthReading: (input: {
    metricType: HealthMetricType;
    value: number;
    unit: string;
    recordedAt?: string;
    note?: string | null;
    metadata?: Record<string, unknown>;
    userId?: string;
  }) => Promise<HealthReading | null>;
  updateHealthReading: (
    id: string,
    patch: Partial<Pick<HealthReading, "value" | "unit" | "recordedAt" | "note" | "metadata">>,
  ) => Promise<boolean>;
  deleteHealthReading: (id: string) => Promise<boolean>;
  upsertHealthProfile: (input: {
    userId?: string;
    heightCm?: number | null;
    weightGoal?: number | null;
    weightUnit?: string;
  }) => Promise<boolean>;
};

export function createHealthSliceActions(get: Get, set: Set): HealthSliceActions {
  const wsId = () => get().currentWorkspace.id;

  return {
    getHealthReadings: (opts) => {
      const workspaceId = wsId();
      let list = get().healthReadings.filter((r) => r.workspaceId === workspaceId);
      if (opts?.userId && opts.userId !== "all") {
        list = list.filter((r) => r.userId === opts.userId);
      }
      if (opts?.metricType) {
        list = list.filter((r) => r.metricType === opts.metricType);
      }
      return [...list].sort(
        (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
      );
    },

    getHealthProfile: (userId) => {
      return get().healthProfiles.find(
        (p) => p.workspaceId === wsId() && p.userId === userId,
      ) ?? null;
    },

    setSelectedHealthMemberId: (id) => set({ selectedHealthMemberId: id }),
    setHealthSectionTab: (tab) => set({ healthSectionTab: tab }),

    addHealthReading: async (input) => {
      const workspaceId = wsId();
      const userId = input.userId ?? get().user?.id;
      if (!userId) return null;
      await ensureHealthPersistenceReady();
      const now = new Date().toISOString();
      const reading: HealthReading = {
        id: newId(workspaceId),
        workspaceId,
        userId,
        metricType: input.metricType,
        value: input.value,
        unit: input.unit,
        recordedAt: input.recordedAt ?? now,
        note: input.note ?? null,
        metadata: input.metadata,
        createdAt: now,
      };
      set({ healthReadings: [reading, ...get().healthReadings] });
      if (shouldPersist(workspaceId)) {
        const ok = await createReadingDb({
          id: reading.id,
          workspaceId,
          userId,
          metricType: reading.metricType,
          value: reading.value,
          unit: reading.unit,
          recordedAt: reading.recordedAt,
          note: reading.note,
          metadata: reading.metadata,
        });
        if (!ok) {
          set({ healthReadings: get().healthReadings.filter((r) => r.id !== reading.id) });
          return null;
        }
      }
      return reading;
    },

    updateHealthReading: async (id, patch) => {
      const prev = get().healthReadings.find((r) => r.id === id);
      if (!prev) return false;
      const next = { ...prev, ...patch };
      set({
        healthReadings: get().healthReadings.map((r) => (r.id === id ? next : r)),
      });
      if (shouldPersist(prev.workspaceId)) {
        const ok = await updateReadingDb(id, patch);
        if (!ok) {
          set({
            healthReadings: get().healthReadings.map((r) => (r.id === id ? prev : r)),
          });
          return false;
        }
      }
      return true;
    },

    deleteHealthReading: async (id) => {
      const prev = get().healthReadings.find((r) => r.id === id);
      if (!prev) return false;
      set({ healthReadings: get().healthReadings.filter((r) => r.id !== id) });
      if (shouldPersist(prev.workspaceId)) {
        const ok = await deleteReadingDb(id);
        if (!ok) {
          set({ healthReadings: [prev, ...get().healthReadings] });
          return false;
        }
      }
      return true;
    },

    upsertHealthProfile: async (input) => {
      const workspaceId = wsId();
      const userId = input.userId ?? get().user?.id;
      if (!userId) return false;
      await ensureHealthPersistenceReady();
      const now = new Date().toISOString();
      const existing = get().healthProfiles.find(
        (p) => p.workspaceId === workspaceId && p.userId === userId,
      );
      const profile: HealthProfile = {
        workspaceId,
        userId,
        heightCm: input.heightCm !== undefined ? input.heightCm : existing?.heightCm,
        weightGoal: input.weightGoal !== undefined ? input.weightGoal : existing?.weightGoal,
        weightUnit: input.weightUnit ?? existing?.weightUnit ?? "lb",
        updatedAt: now,
      };
      const others = get().healthProfiles.filter(
        (p) => !(p.workspaceId === workspaceId && p.userId === userId),
      );
      set({ healthProfiles: [...others, profile] });
      if (shouldPersist(workspaceId)) {
        const ok = await upsertProfileDb({
          workspaceId,
          userId,
          heightCm: profile.heightCm,
          weightGoal: profile.weightGoal,
          weightUnit: profile.weightUnit,
        });
        if (!ok) {
          set({ healthProfiles: get().healthProfiles });
          return false;
        }
      }
      return true;
    },
  };
}