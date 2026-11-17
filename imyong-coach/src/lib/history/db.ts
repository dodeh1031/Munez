import type { HistoryRecord } from "@/lib/history/types";

/**
 * 아주 작은 IndexedDB 래퍼 (브라우저 전용, 의존성 없음)
 *  - records: 리포트·메타데이터 (목록·그래프용, 가벼움)
 *  - videos : 분석용 압축 영상 Blob (id → Blob, 열 때만 읽음)
 */
const DB_NAME = "imyong-coach";
const DB_VERSION = 1;
const RECORDS = "records";
const VIDEOS = "videos";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("이 브라우저에서는 기록 저장(IndexedDB)을 사용할 수 없습니다."));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(RECORDS)) db.createObjectStore(RECORDS, { keyPath: "id" });
        if (!db.objectStoreNames.contains(VIDEOS)) db.createObjectStore(VIDEOS);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("기록 저장소를 열지 못했습니다."));
      req.onblocked = () => reject(new Error("다른 탭이 기록 저장소를 사용 중입니다. 다른 탭을 닫고 새로고침하세요."));
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("저장이 취소되었습니다 (저장 공간 부족일 수 있음)."));
  });
}

export async function listRecords(): Promise<HistoryRecord[]> {
  const db = await openDb();
  const all = await request(db.transaction(RECORDS, "readonly").objectStore(RECORDS).getAll());
  return (all as HistoryRecord[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function putRecord(record: HistoryRecord, video?: Blob | null): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([RECORDS, VIDEOS], "readwrite");
  tx.objectStore(RECORDS).put(record);
  if (video) tx.objectStore(VIDEOS).put(video, record.id);
  await done(tx);
}

export async function getVideo(id: string): Promise<Blob | null> {
  const db = await openDb();
  const blob = await request(db.transaction(VIDEOS, "readonly").objectStore(VIDEOS).get(id));
  return blob instanceof Blob ? blob : null;
}

export async function deleteRecord(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([RECORDS, VIDEOS], "readwrite");
  tx.objectStore(RECORDS).delete(id);
  tx.objectStore(VIDEOS).delete(id);
  await done(tx);
}

/** 브라우저가 저장 공간이 부족할 때 기록을 지우지 않도록 요청 (실패해도 무시) */
export async function requestPersistence(): Promise<void> {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) {
      await navigator.storage.persist?.();
    }
  } catch {
    /* 지원하지 않는 브라우저 */
  }
}

export async function storageUsage(): Promise<{ usage: number; quota: number } | null> {
  try {
    const est = await navigator.storage?.estimate?.();
    return est?.usage !== undefined && est.quota !== undefined ? { usage: est.usage, quota: est.quota } : null;
  } catch {
    return null;
  }
}
