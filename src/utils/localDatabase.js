const DB_NAME = 'reas-local-database-handle';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
const DIRECTORY_HANDLE_KEY = 'directory';
const INDEX_FILE = 'index.json';
const REPORTS_DIR = 'reportes';
const CONFIG_DIR = 'config';
const DATABASE_VERSION = 1;

function openHandleDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB no esta disponible en este navegador.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir IndexedDB.'));
  });
}

function runHandleTransaction(mode, callback) {
  return openHandleDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        let request;

        try {
          request = callback(store);
        } catch (error) {
          database.close();
          reject(error);
          return;
        }

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('No se pudo completar la accion.'));
        transaction.oncomplete = () => database.close();
        transaction.onerror = () => {
          database.close();
          reject(transaction.error ?? new Error('No se pudo completar la transaccion.'));
        };
      }),
  );
}

export function isLocalDatabaseSupported() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function saveLocalDatabaseHandle(handle) {
  await runHandleTransaction('readwrite', (store) =>
    store.put({
      key: DIRECTORY_HANDLE_KEY,
      handle,
      savedAt: new Date().toISOString(),
    }),
  );
}

export async function loadLocalDatabaseHandle() {
  const record = await runHandleTransaction('readonly', (store) => store.get(DIRECTORY_HANDLE_KEY));
  return record?.handle ?? null;
}

export async function clearLocalDatabaseHandle() {
  await runHandleTransaction('readwrite', (store) => store.delete(DIRECTORY_HANDLE_KEY));
}

export async function verifyDirectoryPermission(handle, requestWrite = false) {
  const options = { mode: requestWrite ? 'readwrite' : 'read' };
  if ((await handle.queryPermission(options)) === 'granted') return true;
  if (!requestWrite) return false;
  return (await handle.requestPermission(options)) === 'granted';
}

export async function pickLocalDatabaseDirectory() {
  if (!isLocalDatabaseSupported()) {
    throw new Error('La base local con carpeta requiere Chrome o Edge actualizado.');
  }

  const handle = await window.showDirectoryPicker({
    id: 'reas-local-database',
    mode: 'readwrite',
    startIn: 'documents',
  });
  const hasPermission = await verifyDirectoryPermission(handle, true);
  if (!hasPermission) {
    throw new Error('No se otorgo permiso para escribir en la carpeta seleccionada.');
  }
  await initializeLocalDatabase(handle);
  await saveLocalDatabaseHandle(handle);
  return handle;
}

async function readJsonFile(directoryHandle, fileName, fallback) {
  try {
    const fileHandle = await directoryHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(directoryHandle, fileName, data) {
  const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

async function ensureDirectory(directoryHandle, name) {
  return directoryHandle.getDirectoryHandle(name, { create: true });
}

export async function initializeLocalDatabase(handle) {
  await ensureDirectory(handle, CONFIG_DIR);
  await ensureDirectory(handle, REPORTS_DIR);
  const index = await readLocalDatabaseIndex(handle);
  await writeLocalDatabaseIndex(handle, {
    version: DATABASE_VERSION,
    createdAt: index.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reports: index.reports ?? [],
  });
}

export async function readLocalDatabaseIndex(handle) {
  return readJsonFile(handle, INDEX_FILE, {
    version: DATABASE_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    reports: [],
  });
}

async function writeLocalDatabaseIndex(handle, index) {
  await writeJsonFile(handle, INDEX_FILE, {
    version: DATABASE_VERSION,
    createdAt: index.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reports: index.reports ?? [],
  });
}

function sanitizeSegment(value = 'sin-dato') {
  return String(value || 'sin-dato')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .toLowerCase();
}

function selectedMonthLabel(result) {
  return (
    result?.metadata?.selectedMonth?.label ??
    result?.metadata?.selectedMonth?.key ??
    result?.metadata?.monthLabel ??
    'mes-no-identificado'
  );
}

export function buildLocalReportId(result, options = {}) {
  const dghCode = options.dghCode ?? result?.metadata?.dghCode ?? 'sin-dgh';
  const month = selectedMonthLabel(result);
  const fileName = options.exportFilename ?? result?.metadata?.fileName ?? 'reporte';
  return [dghCode, month, fileName].map(sanitizeSegment).filter(Boolean).join('__');
}

export function buildLocalReportEntry(result, options = {}) {
  const id = options.id ?? buildLocalReportId(result, options);
  const processedRows = Number(result?.metadata?.processedRows ?? result?.processedRows?.length ?? 0);
  const monthlyRows = (result?.monthlyResults ?? []).reduce(
    (total, monthResult) =>
      total + Number(monthResult?.metadata?.processedRows ?? monthResult?.processedRows?.length ?? 0),
    0,
  );
  return {
    id,
    fileName: `${id}.json`,
    title: options.exportFilename || result?.metadata?.fileName || 'Reporte ReAS',
    dghCode: options.dghCode ?? result?.metadata?.dghCode ?? '',
    month: selectedMonthLabel(result),
    originalFile: result?.metadata?.fileName ?? '',
    generatedAt: result?.metadata?.generatedAt ?? new Date().toISOString(),
    savedAt: new Date().toISOString(),
    processedRows: processedRows || monthlyRows,
    user: options.user
      ? {
          code: options.user.code,
          name: options.user.name,
          role: options.user.role,
        }
      : null,
  };
}

export async function listLocalReports(handle) {
  const index = await readLocalDatabaseIndex(handle);
  return [...(index.reports ?? [])].sort((a, b) =>
    String(b.savedAt ?? '').localeCompare(String(a.savedAt ?? '')),
  );
}

export async function saveLocalReport(handle, result, options = {}) {
  const hasPermission = await verifyDirectoryPermission(handle, true);
  if (!hasPermission) {
    throw new Error('No hay permiso para escribir en la carpeta de base local.');
  }

  await initializeLocalDatabase(handle);
  const reportsDirectory = await ensureDirectory(handle, REPORTS_DIR);
  const entry = buildLocalReportEntry(result, options);
  await writeJsonFile(reportsDirectory, entry.fileName, {
    version: DATABASE_VERSION,
    entry,
    result,
  });

  const index = await readLocalDatabaseIndex(handle);
  const reports = [
    entry,
    ...(index.reports ?? []).filter((report) => report.id !== entry.id),
  ];
  await writeLocalDatabaseIndex(handle, {
    ...index,
    reports,
  });
  return entry;
}

export async function loadLocalReport(handle, reportId) {
  const index = await readLocalDatabaseIndex(handle);
  const entry = (index.reports ?? []).find((report) => report.id === reportId);
  if (!entry) throw new Error('No se encontro el reporte en la base local.');

  const reportsDirectory = await ensureDirectory(handle, REPORTS_DIR);
  const record = await readJsonFile(reportsDirectory, entry.fileName, null);
  if (!record?.result) throw new Error('El archivo del reporte no se pudo leer.');
  return record;
}
