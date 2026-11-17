import { create } from "zustand";
import type { PreprocessResult } from "@/lib/ffmpeg/preprocess";
import type { AnalysisMeta, GeminiErrorCode, UploadedFileInfo } from "@/lib/gemini/events";
import type { AnalysisReport, EvalMode } from "@/lib/schema/report";

/**
 * 브라우저 메모리 세션 스토어 (DB 없음)
 * - File 객체와 object URL을 들고 있으므로 클라이언트 컴포넌트에서만 import 하세요.
 * - 새로고침하면 초기화됩니다. (로컬 1인용 도구 전제)
 */

export type VideoSource = "upload" | "webcam";

export interface SelectedVideo {
  file: File;
  url: string;
  durationSec: number | null;
  source: VideoSource;
  /** 이 브라우저가 원본을 재생(디코딩)할 수 있는지 */
  decodable: boolean;
  width: number;
  height: number;
}

export interface SelectedImage {
  file: File;
  url: string;
}

/** 전처리된 분석용 영상 */
export interface ProcessedMedia extends PreprocessResult {
  url: string;
  /** 어떤 원본에서 만들었는지 (같은 영상 재분석 시 재사용) */
  sourceFile: File;
  originalSize: number;
}

/** Gemini에 올린 분석용 영상 (만료 전이면 재분석 때 재사용) */
export interface UploadedMedia extends UploadedFileInfo {
  processedFile: File;
}

/** 어떤 입력으로 분석했는지 — 같은 입력이면 다시 분석하지 않고 리포트만 보여 줌 */
export interface AnalyzedInput {
  mode: EvalMode;
  promptText: string;
  image: File | null;
  processedFile: File;
}

export type PipelineStep = "preprocess" | "upload" | "analyze";

export interface PipelineState {
  status: "idle" | "running" | "complete" | "error" | "cancelled";
  step: PipelineStep | null;
  /** 현재 단계 진행률 0~1 */
  progress: number;
  detail: string | null;
  error: string | null;
  errorCode: GeminiErrorCode | null;
  startedAt: number | null;
  finishedAt: number | null;
}

const IDLE_PIPELINE: PipelineState = {
  status: "idle",
  step: null,
  progress: 0,
  detail: null,
  error: null,
  errorCode: null,
  startedAt: null,
  finishedAt: null,
};

interface SessionState {
  mode: EvalMode;
  promptText: string;
  promptImage: SelectedImage | null;
  video: SelectedVideo | null;

  pipeline: PipelineState;
  processed: ProcessedMedia | null;
  uploaded: UploadedMedia | null;
  report: AnalysisReport | null;
  analysisMeta: AnalysisMeta | null;
  analyzedInput: AnalyzedInput | null;

  setMode: (mode: EvalMode) => void;
  setPromptText: (text: string) => void;
  setPromptImage: (file: File | null) => void;
  setVideo: (video: Omit<SelectedVideo, "url"> | null) => void;
  setPipeline: (patch: Partial<PipelineState>) => void;
  setProcessed: (media: Omit<ProcessedMedia, "url"> | null) => void;
  setUploaded: (uploaded: UploadedMedia | null) => void;
  setAnalysis: (result: { report: AnalysisReport; meta: AnalysisMeta; input: AnalyzedInput } | null) => void;
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  mode: "demo",
  promptText: "",
  promptImage: null,
  video: null,

  pipeline: IDLE_PIPELINE,
  processed: null,
  uploaded: null,
  report: null,
  analysisMeta: null,
  analyzedInput: null,

  setMode: (mode) => set({ mode }),
  setPromptText: (promptText) => set({ promptText }),

  setPromptImage: (file) => {
    const prev = get().promptImage;
    if (prev) URL.revokeObjectURL(prev.url);
    set({ promptImage: file ? { file, url: URL.createObjectURL(file) } : null });
  },

  setVideo: (video) => {
    const { video: prev, processed } = get();
    if (prev) URL.revokeObjectURL(prev.url);
    if (processed) URL.revokeObjectURL(processed.url);
    // 영상이 바뀌면 이전 전처리·분석 결과는 무효 (실행 중인 작업은 pipeline.ts가 감지해 취소)
    set({
      video: video ? { ...video, url: URL.createObjectURL(video.file) } : null,
      pipeline: IDLE_PIPELINE,
      processed: null,
      uploaded: null,
      report: null,
      analysisMeta: null,
      analyzedInput: null,
    });
  },

  setPipeline: (patch) => set((s) => ({ pipeline: { ...s.pipeline, ...patch } })),

  setProcessed: (media) => {
    const prev = get().processed;
    if (prev) URL.revokeObjectURL(prev.url);
    set({ processed: media ? { ...media, url: URL.createObjectURL(media.file) } : null });
  },

  setUploaded: (uploaded) => set({ uploaded }),

  setAnalysis: (result) =>
    set(
      result
        ? { report: result.report, analysisMeta: result.meta, analyzedInput: result.input }
        : { report: null, analysisMeta: null, analyzedInput: null },
    ),
}));
