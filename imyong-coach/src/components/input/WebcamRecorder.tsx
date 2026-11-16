"use client";

import { Camera } from "lucide-react";

/**
 * 브라우저 웹캠 직접 녹화 (MediaRecorder API)
 * TODO(2단계): getUserMedia 미리보기 → 녹화/정지 → webm Blob → useSessionStore.setVideo({ source: "webcam" })
 */
export function WebcamRecorder() {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-900 px-6 text-center text-slate-300">
      <span className="grid size-12 place-items-center rounded-full bg-white/10">
        <Camera className="size-5" aria-hidden />
      </span>
      <span>
        <span className="block font-medium text-white">웹캠으로 바로 녹화</span>
        <span className="mt-1 block text-xs text-slate-400">2단계에서 연결됩니다 · 최대 15분 자동 정지</span>
      </span>
      <button
        type="button"
        disabled
        className="mt-1 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white/60"
      >
        카메라 켜기
      </button>
    </div>
  );
}
