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

function isIgnoredInformationalEventuality(value = '') {
  const normalized = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/#/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  return /\bD.AS?\s+PENDIENTES?\b/.test(normalized) || /\bSALDO\b/.test(normalized);
}

function removeListToken(value = '', tokenToRemove = '') {
  return String(value ?? '')
    .split(';')
    .map((token) => token.trim())
    .filter((token) => token && token !== tokenToRemove)
    .join('; ');
}

function removeIgnoredItemsFromStoredAudit(result) {
  const eventuality = result?.audit?.eventuality ?? result?.eventualityAudit;
  const processedRows = (result?.processedRows ?? []).map((row) => ({
    ...row,
    'Tipos de eventualidad detectados': removeListToken(
      row['Tipos de eventualidad detectados'],
      'ver_viatico',
    ),
    'Tipos de eventualidad en asistencia': removeListToken(
      row['Tipos de eventualidad en asistencia'],
      'ver_viatico',
    ),
    'Eventualidad externa': removeListToken(row['Eventualidad externa'], 'Ver viatico'),
  }));
  if (!eventuality?.enabled) {
    return result ? { ...result, processedRows } : result;
  }
  const nonAuditTypes = ['vacacion', 'ver_viatico', 'feriado', 'ponche_irregular'];
  const items = (eventuality.items ?? []).filter((item) => {
    if (nonAuditTypes.includes(item.tipoExterno)) return false;
    if (isIgnoredInformationalEventuality(item.tipoExternoLabel)) return false;
    const attendanceTypes = item.tiposAsistencia ?? [];
    if (
      item.status === 'solo_asistencia' &&
      !item.tipoExterno &&
      attendanceTypes.length
    ) {
      return false;
    }
    return (
      !attendanceTypes.length ||
      attendanceTypes.some((type) => !nonAuditTypes.includes(type))
    );
  });
  const pendingItems = items.filter((item) => !item.resolved);
  const nextEventuality = {
    ...eventuality,
    items,
    pendingItems,
    stats: {
      ...(eventuality.stats ?? {}),
      total: items.length,
      pending: pendingItems.length,
    },
  };
  const hasDiscrepancies = Boolean(
    pendingItems.length ||
    result.audit.pendingEmployees?.length ||
    result.audit.general?.diferenciaMin,
  );
  return {
    ...result,
    processedRows,
    eventualityAudit: nextEventuality,
    audit: {
      ...result.audit,
      eventuality: nextEventuality,
      hasDiscrepancies,
    },
  };
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
      version: 13,
      migrate: (persistedState) => {
        const saveSession = persistedState?.saveSession ?? true;
        const expired = isExpiredSession(persistedState?.lastSession);

        return {
          ...persistedState,
          modifiedSchedule: persistedState?.modifiedSchedule || DEFAULT_MODIFIED_SCHEDULE,
          dghCode: persistedState?.dghCode || DEFAULT_DGH_CODE,
          exportFilename: persistedState?.exportFilename || DEFAULT_EXPORT_FILENAME,
          saveSession,
          lastResult:
            saveSession && !expired
              ? removeIgnoredItemsFromStoredAudit(persistedState?.lastResult || null)
              : null,
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
