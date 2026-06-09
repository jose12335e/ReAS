import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_MODIFIED_SCHEDULE, DEFAULT_SCHEDULE_TYPE } from '../config/scheduleConfig.js';

const DEFAULT_DGH_CODE = 'JCE-DGH-6064-2026';
const DEFAULT_EXPORT_FILENAME = 'reporte-asistencia';
export const SESSION_TTL_HOURS = 24;
const SESSION_TTL_MS = SESSION_TTL_HOURS * 60 * 60 * 1000;

function isExpiredSession(lastSession) {
  if (!lastSession?.savedAt) return false;
  const savedAt = new Date(lastSession.savedAt).getTime();
  if (!Number.isFinite(savedAt)) return true;
  return Date.now() - savedAt > SESSION_TTL_MS;
}

export const useAttendanceStore = create(
  persist(
    (set, get) => ({
      defaultScheduleType: DEFAULT_SCHEDULE_TYPE,
      modifiedSchedule: DEFAULT_MODIFIED_SCHEDULE,
      dghCode: DEFAULT_DGH_CODE,
      exportFilename: DEFAULT_EXPORT_FILENAME,
      saveSession: true,
      mapping: {},
      lastResult: null,
      lastSession: null,
      setDefaultScheduleType: (defaultScheduleType) => set({ defaultScheduleType }),
      setModifiedSchedule: (modifiedSchedule) => set({ modifiedSchedule }),
      setDghCode: (dghCode) => set({ dghCode }),
      setExportFilename: (exportFilename) => set({ exportFilename }),
      setSaveSession: (saveSession) =>
        set({
          saveSession,
          ...(saveSession ? {} : { lastResult: null, lastSession: null }),
        }),
      setMapping: (mapping) => set({ mapping }),
      setLastResult: (lastResult) =>
        set(() => {
          if (!get().saveSession) {
            return { lastResult: null, lastSession: null };
          }

          return {
            lastResult,
            lastSession: lastResult
              ? {
                  savedAt: new Date().toISOString(),
                  processedRows: lastResult.metadata?.processedRows ?? 0,
                  generatedAt: lastResult.metadata?.generatedAt,
                }
              : null,
          };
        }),
      resetMapping: () => set({ mapping: {} }),
      clearLastResult: () => set({ lastResult: null, lastSession: null }),
      clearExpiredSession: () =>
        set((state) =>
          isExpiredSession(state.lastSession) ? { lastResult: null, lastSession: null } : {},
        ),
    }),
    {
      name: 'reas-attendance-config',
      version: 7,
      migrate: (persistedState) => {
        const saveSession = persistedState?.saveSession ?? true;
        const expired = isExpiredSession(persistedState?.lastSession);

        return {
          ...persistedState,
          modifiedSchedule: persistedState?.modifiedSchedule || DEFAULT_MODIFIED_SCHEDULE,
          dghCode: persistedState?.dghCode || DEFAULT_DGH_CODE,
          exportFilename: persistedState?.exportFilename || DEFAULT_EXPORT_FILENAME,
          saveSession,
          lastResult: saveSession && !expired ? persistedState?.lastResult || null : null,
          lastSession: saveSession && !expired ? persistedState?.lastSession || null : null,
        };
      },
      partialize: (state) => ({
        defaultScheduleType: state.defaultScheduleType,
        modifiedSchedule: state.modifiedSchedule,
        dghCode: state.dghCode,
        exportFilename: state.exportFilename,
        saveSession: state.saveSession,
        mapping: state.mapping,
        lastResult: state.saveSession ? state.lastResult : null,
        lastSession: state.saveSession ? state.lastSession : null,
      }),
    },
  ),
);
