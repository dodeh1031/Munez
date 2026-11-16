import { create } from "zustand";
import type { AnalysisReport, EvalMode } from "@/lib/schema/report";

/**
 * 브라우저 메모리 세션 스토어 (DB 없음)
 * - File 객체와 object URL을 들고 있으므로 클라이언트 컴포넌트에서만 import 하세요.
 * - 새로고침하면 초기화됩니다. (로컬 1인용 도구 전제)
 */

export type VideoSource = "upload" | "webcam";

/** 2~3단계 파이프라인 진행 상태 */
export type AnalysisStatus =
  | "idle"
  | "preprocessing" // ffmpeg.wasm 압축/오디오 분리
  | "uploading" // Gemini File API 업로드
  | "analyzing" // 멀티모달 분석
  | "done"
  | "error";

export interface SelectedVideo {
  file: File;
  url: string;
  durationSec: number | null;
  source: VideoSource;
}

export interface SelectedImage {
  file: File;
  url: string;
}

interface SessionState {
  mode: EvalMode;
  promptText: string;
  promptImage: SelectedImage | null;
  video: SelectedVideo | null;

  status: AnalysisStatus;
  progress: number; // 0~1
  report: AnalysisReport | null;
  error: string | null;

  setMode: (mode: EvalMode) => void;
  setPromptText: (text: string) => void;
  setPromptImage: (file: File | null) => void;
  setVideo: (video: Omit<SelectedVideo, "url"> | null) => void;
  resetAnalysis: () => void;
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  mode: "demo",
  promptText: "",
  promptImage: null,
  video: null,

  status: "idle",
  progress: 0,
  report: null,
  error: null,

  setMode: (mode) => set({ mode }),
  setPromptText: (promptText) => set({ promptText }),

  setPromptImage: (file) => {
    const prev = get().promptImage;
    if (prev) URL.revokeObjectURL(prev.url);
    set({ promptImage: file ? { file, url: URL.createObjectURL(file) } : null });
  },

  setVideo: (video) => {
    const prev = get().video;
    if (prev) URL.revokeObjectURL(prev.url);
    set({
      video: video ? { ...video, url: URL.createObjectURL(video.file) } : null,
      // 영상이 바뀌면 이전 분석 결과는 무효
      status: "idle",
      progress: 0,
      report: null,
      error: null,
    });
  },

  resetAnalysis: () => set({ status: "idle", progress: 0, report: null, error: null }),
}));
