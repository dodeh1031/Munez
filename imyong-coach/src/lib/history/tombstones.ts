import { mergeTombstones } from "@/lib/history/merge";
import { tombstoneSchema, type Tombstone } from "@/lib/history/types";

/**
 * 지운 기록 목록 (이 브라우저의 localStorage)
 * 폴더 동기화 때 다른 컴퓨터에 남아 있는 같은 기록을 지우고, 지운 기록이 되살아나지 않게 합니다.
 */
const KEY = "imyong-coach:deleted";

export function loadTombstones(): Tombstone[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((t) => {
      const parsed = tombstoneSchema.safeParse(t);
      return parsed.success ? [parsed.data] : [];
    });
  } catch {
    return [];
  }
}

export function saveTombstones(list: Tombstone[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(mergeTombstones(list)));
  } catch {
    /* 저장 불가(사생활 보호 모드 등) — 동기화 때 삭제가 전달되지 않을 뿐 */
  }
}

export function addTombstone(id: string) {
  saveTombstones([...loadTombstones(), { id, deletedAt: new Date().toISOString() }]);
}

export function forgetTombstones(ids: string[]) {
  if (ids.length === 0) return;
  const drop = new Set(ids);
  saveTombstones(loadTombstones().filter((t) => !drop.has(t.id)));
}
