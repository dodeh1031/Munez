"use client";

import { useRef } from "react";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { MODE_META } from "@/lib/constants";
import { useSessionStore } from "@/lib/store";

export function PromptInput() {
  const mode = useSessionStore((s) => s.mode);
  const promptText = useSessionStore((s) => s.promptText);
  const setPromptText = useSessionStore((s) => s.setPromptText);
  const promptImage = useSessionStore((s) => s.promptImage);
  const setPromptImage = useSessionStore((s) => s.setPromptImage);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="prompt-text" className="mb-1.5 block text-sm font-medium text-slate-700">
          {mode === "demo" ? "수업 조건 · 학습목표" : "면접 문항"}
        </label>
        <textarea
          id="prompt-text"
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder={MODE_META[mode].promptPlaceholder}
          rows={8}
          className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm leading-relaxed placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        <p className="mt-1 text-right text-xs text-slate-400">{promptText.length.toLocaleString()}자</p>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-slate-700">
          문제지 이미지 <span className="font-normal text-slate-400">(선택)</span>
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setPromptImage(file);
            e.target.value = "";
          }}
        />
        {promptImage ? (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
              <Image src={promptImage.url} alt="첨부한 문제지" fill unoptimized className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{promptImage.file.name}</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-indigo-600 hover:underline"
              >
                다른 이미지로 교체
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPromptImage(null)}
              aria-label="문제지 이미지 삭제"
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 transition-colors hover:border-indigo-400 hover:bg-indigo-50/40 hover:text-indigo-700"
          >
            <ImagePlus className="size-4" aria-hidden />
            문제지 사진·캡처 첨부
          </button>
        )}
      </div>
    </div>
  );
}
