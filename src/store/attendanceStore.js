import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SCHEDULE_TYPE } from '../config/scheduleConfig.js';

export const useAttendanceStore = create(
  persist(
    (set) => ({
      defaultScheduleType: DEFAULT_SCHEDULE_TYPE,
      mapping: {},
      lastResult: null,
      lastSession: null,
      setDefaultScheduleType: (defaultScheduleType) => set({ defaultScheduleType }),
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
      version: 2,
      migrate: (persistedState) => ({
        ...persistedState,
        lastResult: null,
      }),
      partialize: (state) => ({
        defaultScheduleType: state.defaultScheduleType,
        mapping: state.mapping,
        lastSession: state.lastSession,
      }),
    },
  ),
);
