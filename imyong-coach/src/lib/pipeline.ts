import { preprocessVideo } from "@/lib/ffmpeg/preprocess";
import { GeminiClientError, analyzeWithGemini, uploadToGemini } from "@/lib/gemini/api";
import type { AnalysisMeta, GeminiErrorCode } from "@/lib/gemini/events";
import { newRecord } from "@/lib/history/files";
import { useHistoryStore } from "@/lib/history/store";
import type { AnalysisReport } from "@/lib/schema/report";
import { hasLimits, limitsForMode, sameLimits, type TimeLimits } from "@/lib/timeLimits";
import {
  useSessionStore,
  type AnalyzedInput,
  type ProcessedMedia,
  type SelectedVideo,
  type UploadedMedia,
} from "@/lib/store";

/**
 * 분석 파이프라인: ① 전처리(ffmpeg.wasm, 브라우저) → ② Gemini 업로드 → ③ 멀티모달 분석
 * - 모듈 스코프에서 실행되므로 페이지를 이동해도 계속 진행됩니다.
 * - 같은 원본이면 ①을, 같은 분석용 영상이 만료 전이면 ②를 건너뜁니다.
 */

let controller: AbortController | null = null;

/** 리포트 작성 진행률 추정용 (응답 JSON의 대략적인 길이 = 기본 분량 + 발화 기록 분량(영상 1초당 약 8자)) */
const BASE_CHARS = { demo: 9000, interview: 13000 } as const;
const expectedChars = (mode: keyof typeof BASE_CHARS, durationSec: number | null) =>
  BASE_CHARS[mode] + Math.round((durationSec ?? 300) * 8);
/** 업로드 파일 만료가 이보다 가까우면 새로 올림 */
const EXPIRY_MARGIN_MS = 30 * 60 * 1000;

export function isAnalysisRunning() {
  return controller !== null;
}

/** 지금 입력이 마지막 분석 때와 같아서 다시 분석할 필요가 없는지 */
export function isSameAsLastAnalysis(): boolean {
  const s = useSessionStore.getState();
  const last = s.analyzedInput;
  return Boolean(
    s.report &&
      last &&
      s.processed &&
      last.processedFile === s.processed.file &&
      last.mode === s.mode &&
      last.promptText === s.promptText &&
      last.image === (s.promptImage?.file ?? null) &&
      sameLimits(last.timeLimits, limitsForMode(s.timeLimits, s.mode)) &&
      last.model === s.modelChoice,
  );
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

const set = (patch: Parameters<ReturnType<typeof useSessionStore.getState>["setPipeline"]>[0]) =>
  useSessionStore.getState().setPipeline(patch);

async function run(video: SelectedVideo, ac: AbortController) {
  const { signal } = ac;
  // 분석 시작 시점의 입력을 고정 (진행 중에 입력을 바꿔도 이번 분석에는 영향 없음)
  const snapshot = useSessionStore.getState();
  const mode = snapshot.mode;
  const promptText = snapshot.promptText;
  const image = snapshot.promptImage?.file ?? null;
  const timeLimits = limitsForMode(snapshot.timeLimits, mode);
  const model = snapshot.modelChoice;
  // 저장된 기록을 보고 있었다면 닫고 이번 분석 진행 상황을 보여 줌
  snapshot.setViewing(null);

  set({
    status: "running",
    step: "preprocess",
    progress: 0,
    detail: "준비 중",
    error: null,
    errorCode: null,
    startedAt: Date.now(),
    finishedAt: null,
  });

  try {
    // ① 전처리
    const media = await ensureProcessed(video, signal);
    if (signal.aborted) return;

    // ② 업로드 → ③ 분석 (업로드 파일이 만료됐다고 하면 한 번 새로 올려 재시도)
    let uploaded = await ensureUploaded(media, signal, false);
    let result;
    try {
      result = await analyze(uploaded, { mode, promptText, image, timeLimits, model, durationSec: video.durationSec ?? media.durationSec }, signal);
    } catch (err) {
      if (!(err instanceof GeminiClientError && err.code === "FILE_EXPIRED")) throw err;
      uploaded = await ensureUploaded(media, signal, true);
      result = await analyze(uploaded, { mode, promptText, image, timeLimits, model, durationSec: video.durationSec ?? media.durationSec }, signal);
    }
    if (signal.aborted) return;

    const input: AnalyzedInput = { mode, promptText, image, processedFile: media.file, timeLimits, model };
    useSessionStore.getState().setAnalysis({ ...result, input });
    set({ status: "complete", step: null, progress: 1, detail: null, finishedAt: Date.now() });
    void saveToHistory({
      mode,
      title: video.file.name,
      promptText,
      durationSec: video.durationSec ?? media.durationSec,
      timeLimits,
      report: result.report,
      meta: result.meta,
      video: media.file,
    });
  } catch (err) {
    const current = useSessionStore.getState();
    // 영상이 바뀌어 취소된 경우엔 setVideo가 이미 상태를 초기화함
    if (current.video?.file !== video.file) return;
    if (signal.aborted) {
      set({ status: "cancelled", step: null, detail: null, finishedAt: Date.now() });
      return;
    }
    const code: GeminiErrorCode = err instanceof GeminiClientError ? err.code : "UNKNOWN";
    // 키·한도 같은 예상된 오류는 화면에 안내하므로 경고로만, 예상 밖 오류는 에러로 기록
    (code === "UNKNOWN" ? console.error : console.warn)("[pipeline]", err);
    set({
      status: "error",
      error: err instanceof Error ? err.message : String(err),
      errorCode: code,
      finishedAt: Date.now(),
    });
  }
}

async function ensureProcessed(video: SelectedVideo, signal: AbortSignal): Promise<ProcessedMedia> {
  const cached = useSessionStore.getState().processed;
  if (cached && cached.sourceFile === video.file) return cached;

  const result = await preprocessVideo(
    { file: video.file, durationSec: video.durationSec, decodable: video.decodable },
    { signal, onProgress: (progress, detail) => set({ progress, detail }) },
  );
  if (signal.aborted) throw new DOMException("취소됨", "AbortError");
  useSessionStore.getState().setProcessed({ ...result, sourceFile: video.file, originalSize: video.file.size });
  const media = useSessionStore.getState().processed;
  if (!media) throw new Error("분석용 영상을 저장하지 못했습니다.");
  return media;
}

async function ensureUploaded(media: ProcessedMedia, signal: AbortSignal, force: boolean): Promise<UploadedMedia> {
  const cached = useSessionStore.getState().uploaded;
  const fresh =
    cached &&
    cached.processedFile === media.file &&
    (!cached.expiresAt || Date.parse(cached.expiresAt) - Date.now() > EXPIRY_MARGIN_MS);
  if (fresh && !force) return cached;

  set({ step: "upload", progress: 0.05, detail: "Gemini로 업로드하는 중" });
  const info = await uploadToGemini(media.file, {
    signal,
    onStatus: (message, progress) => set({ detail: message, ...(progress !== undefined ? { progress } : {}) }),
  });
  const uploaded: UploadedMedia = { ...info, processedFile: media.file };
  useSessionStore.getState().setUploaded(uploaded);
  return uploaded;
}

async function analyze(
  uploaded: UploadedMedia,
  input: {
    mode: AnalyzedInput["mode"];
    promptText: string;
    image: File | null;
    timeLimits: TimeLimits;
    model: string | null;
    durationSec: number | null;
  },
  signal: AbortSignal,
) {
  set({ step: "analyze", progress: 0.03, detail: "분석 요청을 보내는 중" });
  return analyzeWithGemini(
    {
      mode: input.mode,
      promptText: input.promptText,
      durationSec: input.durationSec,
      timeLimits: hasLimits(input.timeLimits) ? input.timeLimits : null,
      model: input.model,
      file: { uri: uploaded.uri, mimeType: uploaded.mimeType },
    },
    input.image,
    {
      signal,
      onStatus: (message) => set({ detail: message }),
      onProgress: (chars) =>
        set({
          progress: 0.1 + 0.85 * Math.min(1, chars / expectedChars(input.mode, input.durationSec)),
          detail: `AI가 리포트를 작성하는 중… ${chars.toLocaleString()}자`,
        }),
    },
  );
}

/** 분석 결과를 브라우저 기록(IndexedDB)에 저장. 영상까지 저장이 안 되면(용량 부족 등) 리포트만이라도 저장 */
async function saveToHistory(input: {
  mode: AnalyzedInput["mode"];
  title: string;
  promptText: string;
  durationSec: number | null;
  timeLimits: TimeLimits;
  report: AnalysisReport;
  meta: AnalysisMeta;
  video: File;
}) {
  const session = useSessionStore.getState();
  if (input.meta.mock) {
    session.setHistorySave({ status: "skipped", reason: "모의(mock) 결과는 기록에 저장하지 않습니다." });
    return;
  }
  session.setHistorySave({ status: "saving" });
  const { video, ...rest } = input;
  const self = useSessionStore.getState().selfScore;
  // 분석을 기다리는 동안 자기 채점을 했다면 함께 저장
  const record = newRecord({ ...rest, selfScore: self?.mode === rest.mode ? self : null });
  const history = useHistoryStore.getState();
  try {
    await history.add({ ...record, hasVideo: true }, video);
    useSessionStore.getState().setHistorySave({ status: "saved", id: record.id, withoutVideo: false });
  } catch (err) {
    console.warn("[history] 영상 포함 저장 실패, 리포트만 저장 시도", err);
    try {
      await history.add(record, null);
      useSessionStore.getState().setHistorySave({ status: "saved", id: record.id, withoutVideo: true });
    } catch (err2) {
      useSessionStore.getState().setHistorySave({
        status: "error",
        message: err2 instanceof Error ? err2.message : String(err2),
      });
    }
  }
}
