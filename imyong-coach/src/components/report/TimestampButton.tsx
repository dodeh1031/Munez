"use client";

import clsx from "clsx";
import { CirclePlay } from "lucide-react";
import { parseTimestamp } from "@/lib/format";
import { useVideoSeek } from "@/components/report/VideoSeekContext";

export function TimestampButton({ start, end, className }: { start: string; end?: string; className?: string }) {
  const { hasVideo, seekTo } = useVideoSeek();
  return (
    <button
      type="button"
      onClick={() => seekTo(parseTimestamp(start))}
      disabled={!hasVideo}
      title={hasVideo ? `${start} 장면으로 이동` : "영상을 업로드하면 해당 장면으로 이동할 수 있어요"}
      className={clsx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-xs font-medium tabular-nums ring-1 transition-colors",
        hasVideo
          ? "bg-indigo-50 text-indigo-700 ring-indigo-200 hover:bg-indigo-100"
          : "cursor-not-allowed bg-slate-50 text-slate-400 ring-slate-200",
        className,
      )}
    >
      <CirclePlay className="size-3.5" aria-hidden />
      {start}
      {end && <span className="opacity-60">– {end}</span>}
    </button>
  );
}
