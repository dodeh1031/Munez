"use client";

import { useEffect } from "react";
import { useSessionStore } from "@/lib/store";

/** 브라우저 창을 닫거나 새로고침하려 할 때 경고를 띄움 */
export function useBeforeUnload(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // 오래된 브라우저 호환
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);
}

/**
 * 작업을 잃을 수 있을 때 창 닫기·새로고침 경고
 *  - AI 분석이 진행 중일 때 (새로고침하면 처음부터 다시, 비용도 다시 발생)
 *  - 웹캠 녹화 원본을 아직 저장하지 않았을 때 (새로고침하면 사라짐)
 * 앱 안에서 화면을 옮기는 것은 괜찮습니다(작업이 계속됨).
 */
export function UnloadGuard() {
  const running = useSessionStore((s) => s.pipeline.status === "running");
  const unsavedRecording = useSessionStore((s) => s.video?.source === "webcam" && !s.videoSaved);
  useBeforeUnload(running || unsavedRecording);
  return null;
}
