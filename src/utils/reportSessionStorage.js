const DB_NAME = 'reas-report-session';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';
const LATEST_KEY = 'latest';

function openSessionDatabase() {
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

function runStoreTransaction(mode, callback) {
  return openSessionDatabase().then(
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
        request.onerror = () => reject(request.error ?? new Error('No se pudo guardar la sesion.'));
        transaction.oncomplete = () => database.close();
        transaction.onerror = () => {
          database.close();
          reject(transaction.error ?? new Error('No se pudo completar la transaccion.'));
        };
      }),
  );
}

export function buildReportSessionMetadata(result) {
  return result
    ? {
        savedAt: new Date().toISOString(),
        processedRows: result.metadata?.processedRows ?? result.processedRows?.length ?? 0,
        generatedAt: result.metadata?.generatedAt,
        dghCode: result.metadata?.dghCode,
        selectedMonth: result.metadata?.selectedMonth,
        fileName: result.metadata?.fileName,
      }
    : null;
}

export async function saveReportSession(result) {
  const metadata = buildReportSessionMetadata(result);
  if (!metadata) {
    await clearReportSession();
    return null;
  }

  await runStoreTransaction('readwrite', (store) =>
    store.put({
      key: LATEST_KEY,
      metadata,
      result,
    }),
  );
  return metadata;
}

export async function loadReportSession() {
  const record = await runStoreTransaction('readonly', (store) => store.get(LATEST_KEY));
  return record?.result ? record : null;
}

export async function clearReportSession() {
  await runStoreTransaction('readwrite', (store) => store.delete(LATEST_KEY));
}
