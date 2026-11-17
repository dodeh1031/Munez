import { getVideo } from "@/lib/history/db";
import { useHistoryStore } from "@/lib/history/store";
import { useSessionStore } from "@/lib/store";

/** 저장된 기록을 리포트 화면에서 볼 수 있게 엽니다. */
export async function openRecord(id: string): Promise<boolean> {
  await useHistoryStore.getState().load();
  const record = useHistoryStore.getState().records.find((r) => r.id === id);
  if (!record) return false;
  let videoUrl: string | null = null;
  if (record.hasVideo) {
    const blob = await getVideo(id).catch(() => null);
    if (blob) videoUrl = URL.createObjectURL(blob);
  }
  useSessionStore.getState().setViewing({ record, videoUrl, originalUrl: null, originalName: null });
  return true;
}

export function closeRecord() {
  useSessionStore.getState().setViewing(null);
}

/** 원본 영상을 연결해 저장된 분석용 영상(초당 1장) 대신 부드럽게 재생 */
export function attachOriginalVideo(file: File) {
  const viewing = useSessionStore.getState().viewing;
  if (!viewing) return;
  useSessionStore.getState().setViewing({
    ...viewing,
    originalUrl: URL.createObjectURL(file),
    originalName: file.name,
  });
}
