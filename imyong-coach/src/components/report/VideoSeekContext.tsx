"use client";

import { createContext, useCallback, useContext, useMemo, useRef, type RefObject } from "react";

interface VideoSeekValue {
  videoRef: RefObject<HTMLVideoElement | null>;
  hasVideo: boolean;
  seekTo: (seconds: number) => void;
}

const VideoSeekContext = createContext<VideoSeekValue | null>(null);

/** 왼쪽 영상 플레이어와 오른쪽 리포트(타임스탬프)를 연결합니다. */
export function VideoSeekProvider({ hasVideo, children }: { hasVideo: boolean; children: React.ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const seekTo = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seconds;
    void video.play().catch(() => {});
    // 1단(모바일) 레이아웃에서는 영상이 화면 밖일 수 있으므로 영상 위치로 스크롤
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      video.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const value = useMemo(() => ({ videoRef, hasVideo, seekTo }), [hasVideo, seekTo]);
  return <VideoSeekContext.Provider value={value}>{children}</VideoSeekContext.Provider>;
}

export function useVideoSeek() {
  const ctx = useContext(VideoSeekContext);
  if (!ctx) throw new Error("useVideoSeek must be used within VideoSeekProvider");
  return ctx;
}
