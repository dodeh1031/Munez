import { create } from "zustand";
import { buildHistoryFile, parseHistoryFileWithDeletions } from "@/lib/history/files";
import { mergeTombstones, planMerge, pruneTombstones, syncSignature } from "@/lib/history/merge";
import { useHistoryStore } from "@/lib/history/store";
import { loadTombstones, saveTombstones } from "@/lib/history/tombstones";
import type { HistoryRecord, Tombstone } from "@/lib/history/types";
import { kvDelete, kvGet, kvSet } from "@/lib/kv";

/**
 * 폴더 동기화 (크롬·엣지의 File System Access API)
 *
 * 연결한 폴더(예: Google Drive 데스크톱 앱의 '내 드라이브/임용 2차 연습')에 기록 파일을 두고
 * ① 폴더의 기록 파일을 읽어 이 컴퓨터 기록과 합치고 ② 합친 결과를 다시 폴더에 씁니다.
 * 드라이브 앱이 그 파일을 다른 컴퓨터로 옮겨 주므로, 학교·집 양쪽에서 같은 폴더를 연결하면 기록이 맞춰집니다.
 *
 *  - 영상은 옮기지 않습니다 (용량). 리포트·점수·자기 채점·시간 조건만.
 *  - 폴더 안의 imyong-history*.json 파일을 모두 읽습니다 ('전체 백업' 파일을 넣어 두어도 합쳐짐, 드라이브 충돌 사본도 포함).
 *  - 쓰는 파일은 imyong-history-sync.json 하나이며, 내용이 바뀔 때만 씁니다.
 *  - 폴더 사용 허용은 브라우저가 관리합니다. 허용된 동안에는 분석·자기 채점·삭제 뒤 자동으로 동기화합니다.
 */

export const SYNC_FILE_NAME = "imyong-history-sync.json";
const HANDLE_KEY = "sync-folder";
const LAST_KEY = "imyong-coach:folder-sync-last";
const AUTO_SYNC_DELAY_MS = 1500;
const isHistoryFileName = (name: string) => /^imyong-history.*\.json$/i.test(name);

type ReadWrite = { mode: "readwrite" };
/** 표준 타입에 아직 없는 권한 메서드 (크롬·엣지에 있음) */
interface FolderHandle extends FileSystemDirectoryHandle {
  queryPermission?: (descriptor: ReadWrite) => Promise<PermissionState>;
  requestPermission?: (descriptor: ReadWrite) => Promise<PermissionState>;
}
type DirectoryPicker = (options?: { id?: string; mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;

function getPicker(): DirectoryPicker | undefined {
  if (typeof window === "undefined" || !window.isSecureContext) return undefined;
  return (window as unknown as { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker;
}

export interface FolderSyncResult {
  at: string;
  added: number;
  updated: number;
  removed: number;
  /** 동기화 뒤 이 컴퓨터의 기록 수 */
  total: number;
  /** 폴더의 파일을 새로 썼는지 (바뀐 게 없으면 쓰지 않음) */
  wrote: boolean;
}

export type FolderSyncStatus =
  | "loading"
  | "unsupported"
  | "disconnected"
  | "needs-permission"
  | "ready"
  | "syncing"
  | "error";

interface FolderSyncState {
  status: FolderSyncStatus;
  folderName: string | null;
  last: FolderSyncResult | null;
  error: string | null;
  /** 허용을 기다리는 동안 이 컴퓨터에서 바뀐 기록이 있음 */
  pending: boolean;
}

export const useFolderSync = create<FolderSyncState>()(() => ({
  status: "loading",
  folderName: null,
  last: null,
  error: null,
  pending: false,
}));

const setState = useFolderSync.setState;

let handle: FolderHandle | null = null;
let initPromise: Promise<void> | null = null;
let running: Promise<FolderSyncResult | null> | null = null;
let rerun = false;
let autoTimer: ReturnType<typeof setTimeout> | null = null;

class FolderSyncError extends Error {}

function loadLast(): FolderSyncResult | null {
  try {
    const raw = JSON.parse(localStorage.getItem(LAST_KEY) ?? "null");
    return raw && typeof raw.at === "string" ? (raw as FolderSyncResult) : null;
  } catch {
    return null;
  }
}

function saveLast(result: FolderSyncResult | null) {
  try {
    if (result) localStorage.setItem(LAST_KEY, JSON.stringify(result));
    else localStorage.removeItem(LAST_KEY);
  } catch {
    /* 무시 */
  }
}

async function permission(h: FolderHandle, request: boolean): Promise<PermissionState> {
  const rw: ReadWrite = { mode: "readwrite" };
  if (!h.queryPermission) return "granted";
  let state = await h.queryPermission(rw);
  if (state !== "granted" && request && h.requestPermission) state = await h.requestPermission(rw);
  return state;
}

/** 앱을 열 때 한 번: 연결해 둔 폴더를 불러오고, 허용돼 있으면 바로 동기화 */
export function initFolderSync(): Promise<void> {
  initPromise ??= (async () => {
    if (!getPicker()) {
      setState({ status: "unsupported" });
      return;
    }
    watchHistory();
    const last = loadLast();
    const saved = await kvGet<FolderHandle>(HANDLE_KEY).catch(() => undefined);
    if (!saved) {
      setState({ status: "disconnected", last: null });
      return;
    }
    handle = saved;
    const state = await permission(saved, false).catch(() => "prompt" as const);
    setState({ folderName: saved.name, last, status: state === "granted" ? "ready" : "needs-permission" });
    if (state === "granted") void syncFolder();
  })();
  return initPromise;
}

/** 폴더 고르기 (버튼 클릭에서 호출해야 함) */
export async function connectFolder(): Promise<void> {
  const pick = getPicker();
  if (!pick) return;
  let picked: FileSystemDirectoryHandle;
  try {
    picked = await pick({ id: "imyong-sync", mode: "readwrite" });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return; // 창을 닫음
    setState({ status: "error", error: describeError(err) });
    return;
  }
  handle = picked as FolderHandle;
  // 저장에 실패해도 이번 방문 동안은 동작
  await kvSet(HANDLE_KEY, picked).catch((err) => console.warn("[folder-sync] 폴더 연결 정보 저장 실패", err));
  saveLast(null);
  setState({ folderName: picked.name, last: null, error: null, status: "ready" });
  await syncFolder({ interactive: true });
}

/** 연결한 폴더 (영상 저장 창을 그 폴더에서 열 때 사용, 없으면 null) */
export function getSyncFolderHandle(): FileSystemDirectoryHandle | null {
  return handle;
}

/** 연결 끊기 (이 컴퓨터의 기록과 폴더의 파일은 그대로) */
export async function disconnectFolder(): Promise<void> {
  handle = null;
  if (autoTimer) clearTimeout(autoTimer);
  await kvDelete(HANDLE_KEY).catch(() => undefined);
  saveLast(null);
  setState({ status: "disconnected", folderName: null, last: null, error: null, pending: false });
}

/**
 * 지금 동기화. interactive(버튼 클릭)면 필요할 때 허용 창을 띄웁니다.
 * 이미 동기화 중이면 끝난 뒤 한 번 더 실행합니다.
 */
export function syncFolder(options: { interactive?: boolean } = {}): Promise<FolderSyncResult | null> {
  if (!handle) return Promise.resolve(null);
  if (running) {
    rerun = true;
    return running;
  }
  running = (async () => {
    let result: FolderSyncResult | null = null;
    let interactive = options.interactive ?? false;
    do {
      rerun = false;
      result = await syncOnce(interactive);
      interactive = false;
    } while (rerun && handle);
    return result;
  })().finally(() => {
    running = null;
  });
  return running;
}

async function syncOnce(interactive: boolean): Promise<FolderSyncResult | null> {
  const h = handle;
  if (!h) return null;
  try {
    if ((await permission(h, interactive)) !== "granted") {
      setState({ status: "needs-permission" });
      return null;
    }
    setState({ status: "syncing", error: null });

    const history = useHistoryStore.getState();
    await history.load();
    if (useHistoryStore.getState().status !== "ready") {
      throw new FolderSyncError("이 컴퓨터의 기록을 불러오지 못해 동기화를 멈췄어요. 새로고침한 뒤 다시 시도하세요.");
    }

    // ① 폴더의 기록 파일 읽기 → ② 합치기
    const folder = await readFolder(h);
    const allTombstones = mergeTombstones(loadTombstones(), folder.deleted);
    const plan = planMerge(useHistoryStore.getState().records, folder.records, { tombstones: allTombstones });
    await useHistoryStore.getState().applyMerge(plan);
    const merged = useHistoryStore.getState().records;
    const tombstones = pruneTombstones(merged, allTombstones);
    saveTombstones(tombstones);

    // ③ 합친 결과를 폴더에 쓰기 (내용이 바뀌었을 때만)
    const wrote = syncSignature(merged, tombstones) !== folder.mainSignature;
    if (wrote) await writeTextFile(h, SYNC_FILE_NAME, buildHistoryFile(merged, tombstones));

    const result: FolderSyncResult = {
      at: new Date().toISOString(),
      added: plan.add.length,
      updated: plan.update.length,
      removed: plan.remove.length,
      total: merged.length,
      wrote,
    };
    saveLast(result);
    setState({ status: "ready", last: result, error: null, pending: false });
    return result;
  } catch (err) {
    if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError")) {
      setState({ status: "needs-permission" });
      return null;
    }
    console.warn("[folder-sync]", err);
    setState({ status: "error", error: describeError(err) });
    return null;
  }
}

async function readFolder(h: FolderHandle): Promise<{
  records: HistoryRecord[];
  deleted: Tombstone[];
  /** 동기화 파일의 현재 내용 요약 (없으면 null) */
  mainSignature: string | null;
}> {
  const records: HistoryRecord[] = [];
  const deleted: Tombstone[] = [];
  let mainSignature: string | null = null;
  // TS 기본 설정(lib.dom.asynciterable 제외)에는 values()가 없어 형태만 지정
  const entries = (h as unknown as { values(): AsyncIterable<FileSystemHandle> }).values();
  for await (const entry of entries) {
    if (entry.kind !== "file" || !isHistoryFileName(entry.name)) continue;
    const isMain = entry.name === SYNC_FILE_NAME;
    try {
      const text = await (await (entry as FileSystemFileHandle).getFile()).text();
      const parsed = parseHistoryFileWithDeletions(text);
      records.push(...parsed.records);
      deleted.push(...parsed.deleted);
      if (isMain) mainSignature = syncSignature(parsed.records, parsed.deleted);
    } catch (err) {
      // 다른 파일은 건너뛰지만, 동기화 파일을 못 읽으면 덮어쓰지 않도록 멈춤
      if (!isMain) continue;
      console.warn("[folder-sync] 동기화 파일 읽기 실패", err);
      throw new FolderSyncError(
        `폴더의 ${SYNC_FILE_NAME} 파일을 읽지 못했어요. 드라이브가 아직 파일을 받는 중일 수 있으니 잠시 후 다시 시도하세요. ` +
          "계속 이러면 그 파일의 이름을 바꾸거나 지운 뒤 다시 동기화하세요 (이 컴퓨터의 기록은 그대로 있어요).",
      );
    }
  }
  return { records, deleted, mainSignature };
}

async function writeTextFile(h: FolderHandle, name: string, text: string) {
  const file = await h.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  await writable.write(new Blob([text], { type: "application/json" }));
  await writable.close();
}

function describeError(err: unknown): string {
  if (err instanceof FolderSyncError) return err.message;
  if (err instanceof DOMException) {
    if (err.name === "NotFoundError") {
      return "연결한 폴더를 찾을 수 없어요. 폴더를 옮기거나 지웠다면 '다른 폴더로 바꾸기'로 다시 연결하세요.";
    }
    if (err.name === "NoModificationAllowedError" || err.name === "InvalidModificationError") {
      return "폴더에 파일을 쓸 수 없어요. 읽기 전용 폴더인지, 드라이브 앱이 실행 중인지 확인하세요.";
    }
    if (err.name === "QuotaExceededError") return "저장 공간이 부족해 폴더에 파일을 쓰지 못했어요.";
  }
  return `동기화하지 못했어요: ${err instanceof Error ? err.message : String(err)}`;
}

/** 이 컴퓨터에서 기록이 바뀌면(분석 저장·자기 채점·삭제·불러오기) 잠시 뒤 자동 동기화 */
let watching = false;
function watchHistory() {
  if (watching) return;
  watching = true;
  useHistoryStore.subscribe((s, prev) => {
    if (s.localRevision === prev.localRevision || !handle) return;
    const { status } = useFolderSync.getState();
    if (status === "needs-permission") {
      setState({ pending: true });
      return;
    }
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = setTimeout(() => void syncFolder(), AUTO_SYNC_DELAY_MS);
  });
}

/** 화면 표시용 */
export const fmtSyncTime = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

export function syncSummary(r: FolderSyncResult): string {
  const parts = [
    r.added && `새 기록 ${r.added}개`,
    r.updated && `바뀐 기록 ${r.updated}개`,
    r.removed && `지운 기록 ${r.removed}개`,
  ].filter(Boolean);
  return parts.length ? `${parts.join(", ")} 반영` : r.wrote ? "이 컴퓨터 기록을 폴더에 저장" : "바뀐 내용 없음";
}
