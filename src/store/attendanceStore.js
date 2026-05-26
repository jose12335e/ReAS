import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_MODIFIED_SCHEDULE, DEFAULT_SCHEDULE_TYPE } from '../config/scheduleConfig.js';

const DEFAULT_DGH_CODE = 'JCE-DGH-6064-2026';
const DEFAULT_EXPORT_FILENAME = 'reporte-asistencia';

export const useAttendanceStore = create(
  persist(
    (set) => ({
      defaultScheduleType: DEFAULT_SCHEDULE_TYPE,
      modifiedSchedule: DEFAULT_MODIFIED_SCHEDULE,
      dghCode: DEFAULT_DGH_CODE,
      exportFilename: DEFAULT_EXPORT_FILENAME,
      mapping: {},
      lastResult: null,
      lastSession: null,
      setDefaultScheduleType: (defaultScheduleType) => set({ defaultScheduleType }),
      setModifiedSchedule: (modifiedSchedule) => set({ modifiedSchedule }),
      setDghCode: (dghCode) => set({ dghCode }),
      setExportFilename: (exportFilename) => set({ exportFilename }),
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
      version: 5,
      migrate: (persistedState) => ({
        ...persistedState,
        modifiedSchedule: persistedState?.modifiedSchedule || DEFAULT_MODIFIED_SCHEDULE,
        dghCode: persistedState?.dghCode || DEFAULT_DGH_CODE,
        exportFilename: persistedState?.exportFilename || DEFAULT_EXPORT_FILENAME,
        lastResult: null,
      }),
      partialize: (state) => ({
        defaultScheduleType: state.defaultScheduleType,
        modifiedSchedule: state.modifiedSchedule,
        dghCode: state.dghCode,
        exportFilename: state.exportFilename,
        mapping: state.mapping,
        lastSession: state.lastSession,
      }),
    },
  ),
);
