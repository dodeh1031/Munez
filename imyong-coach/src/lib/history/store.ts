import { create } from "zustand";
import * as db from "@/lib/history/db";
import { planMerge, type MergePlan } from "@/lib/history/merge";
import { addTombstone, forgetTombstones, loadTombstones } from "@/lib/history/tombstones";
import type { HistoryRecord } from "@/lib/history/types";

/** 저장된 분석 기록 목록 (IndexedDB의 records를 메모리에 올려 둠, createdAt 오름차순) */
interface HistoryState {
  records: HistoryRecord[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  /** 이 컴퓨터에서 기록을 바꾼 횟수 — 폴더 자동 동기화 신호 (동기화로 들어온 변경은 세지 않음) */
  localRevision: number;
  load: (force?: boolean) => Promise<void>;
  add: (record: HistoryRecord, video?: Blob | null) => Promise<void>;
  /** 백업 파일 불러오기: 없는 기록은 추가, 있는 기록은 파일 쪽이 더 최근에 고친 것이면 바꿈 */
  importRecords: (records: HistoryRecord[]) => Promise<{ added: number; updated: number; unchanged: number }>;
  /** 기록 내용만 바꿈 (저장된 영상은 그대로). 고친 시각을 남기고 저장된 기록을 돌려줌 */
  update: (record: HistoryRecord) => Promise<HistoryRecord>;
  remove: (id: string) => Promise<void>;
  /** 폴더 동기화 결과 반영 */
  applyMerge: (plan: MergePlan) => Promise<void>;
  /** 분석용 영상만 지움 (리포트·점수는 그대로). 영상은 동기화 대상이 아니라 동기화 신호도 보내지 않음 */
  removeVideos: (ids: string[]) => Promise<void>;
}

let loading: Promise<void> | null = null;

const byDate = (a: HistoryRecord, b: HistoryRecord) => a.createdAt.localeCompare(b.createdAt);

function withPlan(records: HistoryRecord[], plan: MergePlan): HistoryRecord[] {
  const removed = new Set(plan.remove);
  const changed = new Map([...plan.add, ...plan.update].map((r) => [r.id, r]));
  const kept = records.filter((r) => !removed.has(r.id) && !changed.has(r.id));
  return [...kept, ...changed.values()].sort(byDate);
}

export const useHistoryStore = create<HistoryState>()((set, get) => ({
  records: [],
  status: "idle",
  error: null,
  localRevision: 0,

  load: (force = false) => {
    if (loading) return loading; // 이미 읽는 중이면 그 결과를 함께 기다림
    if (!force && get().status === "ready") return Promise.resolve();
    set({ status: "loading", error: null });
    loading = db
      .listRecords()
      .then((records) => set({ records, status: "ready" }))
      .catch((err) => set({ status: "error", error: err instanceof Error ? err.message : String(err) }))
      .finally(() => {
        loading = null;
      });
    return loading;
  },

  add: async (record, video) => {
    await db.putRecord(record, video);
    void db.requestPersistence();
    set((s) => ({
      records: [...s.records.filter((r) => r.id !== record.id), record].sort(byDate),
      localRevision: s.localRevision + 1,
    }));
  },

  importRecords: async (records) => {
    await get().load();
    const plan = planMerge(get().records, records);
    // 이 컴퓨터에서 지웠던 기록을 직접 불러오면 되살림: 삭제 표시를 지우고 '방금 고침'으로 남겨 동기화에서도 유지
    const deleted = new Set(loadTombstones().map((t) => t.id));
    const restored = plan.add.filter((r) => deleted.has(r.id)).map((r) => r.id);
    if (restored.length) {
      const now = new Date().toISOString();
      plan.add = plan.add.map((r) => (deleted.has(r.id) ? { ...r, updatedAt: now } : r));
    }
    await db.applyChanges([...plan.add, ...plan.update], []);
    forgetTombstones(restored);
    if (plan.add.length || plan.update.length) {
      set((s) => ({ records: withPlan(s.records, plan), localRevision: s.localRevision + 1 }));
    }
    return { added: plan.add.length, updated: plan.update.length, unchanged: plan.unchanged };
  },

  update: async (record) => {
    const next = { ...record, updatedAt: new Date().toISOString() };
    await db.putRecord(next);
    set((s) => ({
      records: s.records.map((r) => (r.id === next.id ? next : r)),
      localRevision: s.localRevision + 1,
    }));
    return next;
  },

  remove: async (id) => {
    await db.deleteRecord(id);
    addTombstone(id);
    set((s) => ({ records: s.records.filter((r) => r.id !== id), localRevision: s.localRevision + 1 }));
  },

  removeVideos: async (ids) => {
    const drop = new Set(ids);
    const changed = get()
      .records.filter((r) => drop.has(r.id) && r.hasVideo)
      .map((r) => ({ ...r, hasVideo: false }));
    await db.clearVideos(ids, changed);
    set((s) => ({ records: s.records.map((r) => (drop.has(r.id) ? { ...r, hasVideo: false } : r)) }));
  },

  applyMerge: async (plan) => {
    await db.applyChanges([...plan.add, ...plan.update], plan.remove);
    if (plan.add.length || plan.update.length || plan.remove.length) {
      set((s) => ({ records: withPlan(s.records, plan) }));
    }
  },
}));
