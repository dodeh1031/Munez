"use client";

import Image from "next/image";
import { FileText, Timer } from "lucide-react";
import { MODE_META } from "@/lib/constants";
import type { EvalMode } from "@/lib/schema/report";
import type { SelectedImage } from "@/lib/store";
import { hasLimits, koreanDuration, type TimeLimits } from "@/lib/timeLimits";

export function PromptSummary({
  mode,
  text,
  image,
  timeLimits,
}: {
  mode: EvalMode;
  text: string;
  image: SelectedImage | null;
  timeLimits?: TimeLimits | null;
}) {
  const showTime = hasLimits(timeLimits);
  const empty = !text.trim() && !image && !showTime;
  const timeParts = timeLimits
    ? [
        timeLimits.lessonMin ? `실연 ${koreanDuration(timeLimits.lessonMin * 60)}` : null,
        timeLimits.preparedMin ? `구상형 ${koreanDuration(timeLimits.preparedMin * 60)}` : null,
        timeLimits.instantMin ? `즉답형 ${koreanDuration(timeLimits.instantMin * 60)}` : null,
      ].filter(Boolean)
    : [];
  return (
    <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm" open={!empty}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium">
        <FileText className="size-4 text-indigo-600" aria-hidden />
        {mode === "demo" ? "입력한 수업 조건" : "입력한 면접 문항"}
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-500">
          {MODE_META[mode].label}
        </span>
      </summary>
      <div className="space-y-3 border-t border-slate-100 px-4 py-3">
        {showTime && (
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
            <Timer className="size-3.5 text-indigo-600" aria-hidden />
            <span className="font-medium">시간 조건</span>
            {timeParts.length > 0 ? timeParts.join(" · ") : "메모만 입력"}
          </p>
        )}
        {empty ? (
          <p className="text-sm text-slate-400">입력한 문제가 없습니다. 영상만으로 분석합니다.</p>
        ) : (
          <>
            {text.trim() && (
              <p className="max-h-48 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {text}
              </p>
            )}
            {image && (
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-slate-100">
                <Image src={image.url} alt="첨부한 문제지" fill unoptimized className="object-contain" />
              </div>
            )}
          </>
        )}
      </div>
    </details>
  );
}
