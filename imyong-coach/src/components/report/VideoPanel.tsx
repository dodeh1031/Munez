"use client";

import { useLayoutEffect } from "react";
import Link from "next/link";
import { Film } from "lucide-react";
import { formatBytes, formatSeconds } from "@/lib/format";
import { fixInfiniteDuration } from "@/lib/video";
import { useVideoSeek } from "@/components/report/VideoSeekContext";

/** 왼쪽 플레이어에 띄울 영상 (현재 세션의 영상 또는 저장된 기록의 영상) */
export interface PlaybackMedia {
  /** 재생할 주소. null이면 unavailable 안내를 보여 줌 */
  url: string | null;
  name: string;
  size: number | null;
  durationSec: number | null;
  /** 파일 이름 옆 보조 설명 (예: 분석용 영상으로 재생 중) */
  note?: string;
  unavailable?: { title: string; detail: string };
}

export function VideoPanel({ media }: { media: PlaybackMedia | null }) {
  const { videoRef } = useVideoSeek();
  const url = media?.url ?? null;

  // cacheComponents 환경에서는 다른 페이지로 이동해도 이 화면이 <Activity>로 숨겨진 채 남습니다.
  // 숨겨질 때 영상이 뒤에서 계속 재생되지 않도록 정지합니다.
  useLayoutEffect(() => {
    const el = videoRef.current;
    return () => el?.pause();
  }, [videoRef, url]);

  if (!media) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl bg-slate-900 px-6 text-center text-slate-300">
        <Film className="size-8 text-slate-500" aria-hidden />
        <p className="text-sm">업로드한 연습 영상이 여기에서 재생됩니다.</p>
        <Link href="/" className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20">
          영상 올리러 가기
        </Link>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 text-center text-slate-300">
        <Film className="size-8 text-slate-500" aria-hidden />
        <p className="text-sm">{media.unavailable?.title ?? "재생할 영상이 없어요."}</p>
        {media.unavailable?.detail && <p className="text-xs text-slate-400">{media.unavailable.detail}</p>}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <video
        key={url}
        ref={videoRef}
        src={url}
        onLoadedMetadata={fixInfiniteDuration}
        controls
        playsInline
        preload="metadata"
        className="aspect-video w-full bg-black"
      />
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs text-slate-500">
        <span className="truncate font-medium text-slate-700">
          {media.name}
          {media.note && <span className="ml-1.5 font-normal text-amber-600">{media.note}</span>}
        </span>
        <span className="shrink-0">
          {media.size !== null && formatBytes(media.size)}
          {media.size !== null && media.durationSec !== null && " · "}
          {media.durationSec !== null && formatSeconds(media.durationSec)}
        </span>
      </div>
    </div>
  );
}
