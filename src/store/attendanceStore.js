import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SCHEDULE_TYPE } from '../config/scheduleConfig.js';

const DEFAULT_DGH_CODE = 'JCE-DGH-6064-2026';

export const useAttendanceStore = create(
  persist(
    (set) => ({
      defaultScheduleType: DEFAULT_SCHEDULE_TYPE,
      dghCode: DEFAULT_DGH_CODE,
      mapping: {},
      lastResult: null,
      lastSession: null,
      setDefaultScheduleType: (defaultScheduleType) => set({ defaultScheduleType }),
      setDghCode: (dghCode) => set({ dghCode }),
      setMapping: (mapping) => set({ mapping }),
      setLastResult: (lastResult) =>
        set({
          lastResult,
          lastSession: lastResult
            ? {
                savedAt: new Date().toISOString(),
                processedRows: lastResult.metadata?.processedRows ?? 0,
                generatedAt: lastResult.metadata?.generatedAt,
              }
            : null,
        }),
      resetMapping: () => set({ mapping: {} }),
      clearLastResult: () => set({ lastResult: null, lastSession: null }),
    }),
    {
      name: 'reas-attendance-config',
      version: 3,
      migrate: (persistedState) => ({
        ...persistedState,
        dghCode: persistedState?.dghCode || DEFAULT_DGH_CODE,
        lastResult: null,
      }),
      partialize: (state) => ({
        defaultScheduleType: state.defaultScheduleType,
        dghCode: state.dghCode,
        mapping: state.mapping,
        lastSession: state.lastSession,
      }),
    },
  ),
);
