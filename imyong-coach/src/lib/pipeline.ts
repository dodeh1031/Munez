import { preprocessVideo } from "@/lib/ffmpeg/preprocess";
import { useSessionStore, type SelectedVideo } from "@/lib/store";

/**
 * 분석 파이프라인: ① 전처리(ffmpeg.wasm) → ② Gemini 업로드 → ③ 멀티모달 분석
 * 모듈 스코프에서 실행되므로 페이지를 이동해도 계속 진행됩니다.
 * 현재 2단계: ① 전처리까지 구현. ②③은 3단계에서 연결합니다.
 */

let controller: AbortController | null = null;

export function isAnalysisRunning() {
  return controller !== null;
}

export function startAnalysis() {
  const { video } = useSessionStore.getState();
  if (!video || controller) return;

  const ac = new AbortController();
  controller = ac;
  // 실행 중에 영상이 바뀌거나 삭제되면 취소
  const unsubscribe = useSessionStore.subscribe((s, prev) => {
    if (s.video !== prev.video) ac.abort();
  });

  void run(video, ac).finally(() => {
    unsubscribe();
    if (controller === ac) controller = null;
  });
}

export function cancelAnalysis() {
  controller?.abort();
}

async function run(video: SelectedVideo, ac: AbortController) {
  const store = useSessionStore.getState();
  store.setPipeline({
    status: "running",
    step: "preprocess",
    progress: 0,
    detail: "준비 중",
    error: null,
    startedAt: Date.now(),
    finishedAt: null,
  });

  try {
    // ① 전처리 — 같은 원본으로 이미 만든 분석용 영상이 있으면 재사용
    const cached = useSessionStore.getState().processed;
    if (!cached || cached.sourceFile !== video.file) {
      const result = await preprocessVideo(
        { file: video.file, durationSec: video.durationSec, decodable: video.decodable },
        {
          signal: ac.signal,
          onProgress: (progress, detail) => useSessionStore.getState().setPipeline({ progress, detail }),
        },
      );
      if (ac.signal.aborted) return;
      useSessionStore.getState().setProcessed({ ...result, sourceFile: video.file, originalSize: video.file.size });
    }

    // TODO(3단계): ② Gemini File API 업로드 → ③ 구조화 분석 → setReport()

    useSessionStore.getState().setPipeline({
      status: "complete",
      step: null,
      progress: 1,
      detail: null,
      finishedAt: Date.now(),
    });
  } catch (err) {
    const current = useSessionStore.getState();
    // 영상이 바뀌어 취소된 경우엔 setVideo가 이미 상태를 초기화함
    if (current.video?.file !== video.file) return;
    if (ac.signal.aborted) {
      current.setPipeline({ status: "cancelled", step: null, detail: null, finishedAt: Date.now() });
      return;
    }
    console.error("[pipeline]", err);
    current.setPipeline({
      status: "error",
      error: err instanceof Error ? err.message : String(err),
      finishedAt: Date.now(),
    });
  }
}
