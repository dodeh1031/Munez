import { useHistoryStore } from "@/lib/history/store";
import type { SelfScore } from "@/lib/selfScore";
import { useSessionStore } from "@/lib/store";

/** 자기 채점 저장: 저장된 기록을 보는 중이면 그 기록에, 아니면 현재 세션(+이미 저장된 기록)에 */
export async function saveSelfScore(score: SelfScore): Promise<void> {
  const session = useSessionStore.getState();
  const history = useHistoryStore.getState();

  if (session.viewing) {
    const record = await history.update({ ...session.viewing.record, selfScore: score });
    useSessionStore.getState().setViewing({ ...session.viewing, record });
    return;
  }

  session.setSelfScore(score);
  const save = session.historySave;
  if (save?.status === "saved") {
    await history.load();
    const record = useHistoryStore.getState().records.find((r) => r.id === save.id);
    if (record && record.mode === score.mode) await history.update({ ...record, selfScore: score });
  }
}
