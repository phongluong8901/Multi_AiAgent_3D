export function initDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('AiDesktopMateDb', 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('models')) {
        db.createObjectStore('models');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveVrmToCache(buffer: ArrayBuffer, name: string) {
  try {
    const db = await initDb();
    const tx = db.transaction('models', 'readwrite');
    tx.objectStore('models').put({ buffer, name }, 'currentModel');
  } catch {
    // Bỏ qua lỗi lưu cache
  }
}

export async function clearCachedVrm() {
  try {
    const db = await initDb();
    const tx = db.transaction('models', 'readwrite');
    tx.objectStore('models').delete('currentModel');
  } catch {
    // Bỏ qua lỗi xóa cache
  }
}

export async function loadCachedVrm(): Promise<{ buffer: ArrayBuffer; name: string } | null> {
  try {
    const db = await initDb();
    return new Promise((resolve) => {
      const tx = db.transaction('models', 'readonly');
      const req = tx.objectStore('models').get('currentModel');
      req.onsuccess = () => resolve((req.result as { buffer: ArrayBuffer; name: string }) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

