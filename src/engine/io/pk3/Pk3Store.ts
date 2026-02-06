export type StoredPk3 = {
  key: 'default';
  name: string;
  buffer: ArrayBuffer;
};

const DB_NAME = 'defragjs';
const STORE_NAME = 'pk3';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getDefaultPk3(): Promise<StoredPk3 | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get('default');
      request.onsuccess = () => {
        resolve((request.result as StoredPk3 | undefined) ?? null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

export async function saveDefaultPk3(file: File): Promise<StoredPk3 | null> {
  try {
    const buffer = await file.arrayBuffer();
    const record: StoredPk3 = { key: 'default', name: file.name, buffer };
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    return record;
  } catch {
    return null;
  }
}

export async function clearDefaultPk3(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete('default');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    return;
  }
}
