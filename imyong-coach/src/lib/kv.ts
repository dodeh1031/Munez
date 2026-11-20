/**
 * 브라우저 설정 저장소 (IndexedDB, 키-값)
 * localStorage에 넣을 수 없는 값(폴더 연결 정보 FileSystemDirectoryHandle 등)을 보관합니다.
 * 기록 DB(imyong-coach)와 따로 두어 기록 DB 버전을 올리지 않아도 되게 했습니다.
 */
const DB_NAME = "imyong-coach-settings";
const STORE = "kv";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("이 브라우저에서는 설정 저장(IndexedDB)을 사용할 수 없습니다."));
        return;
      }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("설정 저장소를 열지 못했습니다."));
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const kvGet = <T>(key: string) => run<T | undefined>("readonly", (s) => s.get(key));
export const kvSet = (key: string, value: unknown) => run("readwrite", (s) => s.put(value, key)).then(() => undefined);
export const kvDelete = (key: string) => run("readwrite", (s) => s.delete(key)).then(() => undefined);
