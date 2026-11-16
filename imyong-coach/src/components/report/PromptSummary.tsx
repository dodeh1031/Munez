"use client";

import Image from "next/image";
import { FileText } from "lucide-react";
import { MODE_META } from "@/lib/constants";
import type { EvalMode } from "@/lib/schema/report";
import type { SelectedImage } from "@/lib/store";

export function PromptSummary({
  mode,
  text,
  image,
}: {
  mode: EvalMode;
  text: string;
  image: SelectedImage | null;
}) {
  const empty = !text.trim() && !image;
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
