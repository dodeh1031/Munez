import type { HistoryRecord, Tombstone } from "@/lib/history/types";

/**
 * 두 컴퓨터의 기록 합치기 (순수 함수 — 저장은 store/folderSync가 함)
 *  - 같은 기록(id)이 양쪽에 있으면 더 최근에 고친 쪽(updatedAt, 없으면 createdAt)을 남김
 *  - 삭제 표시(tombstone)가 그 기록의 마지막 수정보다 나중이면 삭제가 이김
 */

const time = (iso: string | undefined) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? 0 : t;
};

/** 기록을 마지막으로 고친 시각 (ms) */
export const recordTime = (r: HistoryRecord) => Math.max(time(r.createdAt), time(r.updatedAt));

export interface MergePlan {
  /** 이 컴퓨터에 없어서 새로 넣을 기록 */
  add: HistoryRecord[];
  /** 이 컴퓨터에 있지만 상대 쪽이 더 최근이라 바꿀 기록 (영상 보유 여부는 이 컴퓨터 값 유지) */
  update: HistoryRecord[];
  /** 다른 컴퓨터에서 지워서 이 컴퓨터에서도 지울 기록 id */
  remove: string[];
  /** 이미 같거나 이 컴퓨터 쪽이 더 최근이라 그대로 둔 기록 수 */
  unchanged: number;
}

/** 같은 id가 여러 번 나오면 가장 최근 것만 남김 (여러 파일을 한꺼번에 읽을 때) */
export function newestById(records: HistoryRecord[]): Map<string, HistoryRecord> {
  const map = new Map<string, HistoryRecord>();
  for (const r of records) {
    const prev = map.get(r.id);
    if (!prev || recordTime(r) > recordTime(prev)) map.set(r.id, r);
  }
  return map;
}

/** 삭제 표시 합치기 (같은 id는 더 늦은 삭제 시각) */
export function mergeTombstones(...lists: Tombstone[][]): Tombstone[] {
  const map = new Map<string, Tombstone>();
  for (const list of lists) {
    for (const t of list) {
      const prev = map.get(t.id);
      if (!prev || time(t.deletedAt) > time(prev.deletedAt)) map.set(t.id, t);
    }
  }
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** 삭제 뒤에 다시 살아난(더 최근에 고친) 기록의 삭제 표시는 지움 */
export function pruneTombstones(records: HistoryRecord[], tombstones: Tombstone[]): Tombstone[] {
  const alive = new Map(records.map((r) => [r.id, recordTime(r)]));
  return tombstones.filter((t) => !(alive.has(t.id) && alive.get(t.id)! > time(t.deletedAt)));
}

export function planMerge(
  local: HistoryRecord[],
  incoming: HistoryRecord[],
  options: { tombstones?: Tombstone[] } = {},
): MergePlan {
  const deletedAt = new Map(mergeTombstones(options.tombstones ?? []).map((t) => [t.id, time(t.deletedAt)]));
  const localById = new Map(local.map((r) => [r.id, r]));
  const incomingById = newestById(incoming);
  const plan: MergePlan = { add: [], update: [], remove: [], unchanged: 0 };

  for (const id of new Set([...localById.keys(), ...incomingById.keys()])) {
    const cur = localById.get(id);
    const inc = incomingById.get(id);
    const incIsNewer = Boolean(inc && (!cur || recordTime(inc) > recordTime(cur)));
    const best = incIsNewer ? inc! : cur!;

    const removedAt = deletedAt.get(id);
    if (removedAt !== undefined && removedAt >= recordTime(best)) {
      if (cur) plan.remove.push(id);
      continue;
    }
    if (!inc) continue;
    if (!cur) plan.add.push({ ...inc, hasVideo: false, source: "imported" });
    else if (incIsNewer) plan.update.push({ ...inc, hasVideo: cur.hasVideo, source: cur.source });
    else plan.unchanged++;
  }
  return plan;
}

/** 동기화 파일 내용이 바뀌었는지 판단하는 요약 (기록별 마지막 수정 시각 + 삭제 표시) */
export function syncSignature(records: HistoryRecord[], tombstones: Tombstone[]): string {
  const recs = records.map((r) => `${r.id}@${recordTime(r)}`).sort();
  const dels = mergeTombstones(tombstones).map((t) => `${t.id}@${time(t.deletedAt)}`);
  return JSON.stringify([recs, dels]);
}
