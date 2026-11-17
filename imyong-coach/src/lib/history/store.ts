import { create } from "zustand";
import * as db from "@/lib/history/db";
import type { HistoryRecord } from "@/lib/history/types";

/** 저장된 분석 기록 목록 (IndexedDB의 records를 메모리에 올려 둠, createdAt 오름차순) */
interface HistoryState {
  records: HistoryRecord[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  load: (force?: boolean) => Promise<void>;
  add: (record: HistoryRecord, video?: Blob | null) => Promise<void>;
  addMany: (records: HistoryRecord[]) => Promise<{ added: number; skipped: number }>;
  remove: (id: string) => Promise<void>;
}

const byDate = (a: HistoryRecord, b: HistoryRecord) => a.createdAt.localeCompare(b.createdAt);

export const useHistoryStore = create<HistoryState>()((set, get) => ({
  records: [],
  status: "idle",
  error: null,

  load: async (force = false) => {
    if (!force && (get().status === "loading" || get().status === "ready")) return;
    set({ status: "loading", error: null });
    try {
      set({ records: await db.listRecords(), status: "ready" });
    } catch (err) {
      set({ status: "error", error: err instanceof Error ? err.message : String(err) });
    }
  },

  add: async (record, video) => {
    await db.putRecord(record, video);
    void db.requestPersistence();
    set((s) => ({ records: [...s.records.filter((r) => r.id !== record.id), record].sort(byDate) }));
  },

  addMany: async (records) => {
    await get().load();
    const existing = new Set(get().records.map((r) => r.id));
    const fresh = records.filter((r) => !existing.has(r.id));
    for (const r of fresh) await db.putRecord(r);
    set((s) => ({ records: [...s.records, ...fresh].sort(byDate) }));
    return { added: fresh.length, skipped: records.length - fresh.length };
  },

  remove: async (id) => {
    await db.deleteRecord(id);
    set((s) => ({ records: s.records.filter((r) => r.id !== id) }));
  },
}));
