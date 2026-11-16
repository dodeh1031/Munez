"use client";

import { useLayoutEffect } from "react";
import Link from "next/link";
import { Film } from "lucide-react";
import { formatBytes, formatSeconds } from "@/lib/format";
import type { SelectedVideo } from "@/lib/store";
import { useVideoSeek } from "@/components/report/VideoSeekContext";

export function VideoPanel({ video }: { video: SelectedVideo | null }) {
  const { videoRef } = useVideoSeek();

  // cacheComponents 환경에서는 다른 페이지로 이동해도 이 화면이 <Activity>로 숨겨진 채 남습니다.
  // 숨겨질 때 영상이 뒤에서 계속 재생되지 않도록 정지합니다.
  useLayoutEffect(() => {
    const el = videoRef.current;
    return () => el?.pause();
  }, [videoRef, video]);

  if (!video) {
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

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <video
        ref={videoRef}
        src={video.url}
        controls
        playsInline
        preload="metadata"
        className="aspect-video w-full bg-black"
      />
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs text-slate-500">
        <span className="truncate font-medium text-slate-700">{video.file.name}</span>
        <span className="shrink-0">
          {formatBytes(video.file.size)}
          {video.durationSec !== null && ` · ${formatSeconds(video.durationSec)}`}
        </span>
      </div>
    </div>
  );
}
