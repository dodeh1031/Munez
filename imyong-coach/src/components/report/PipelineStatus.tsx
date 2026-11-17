"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { CircleAlert, CircleCheck, Download, LoaderCircle, RotateCcw, X } from "lucide-react";
import { formatBytes, formatSeconds } from "@/lib/format";
import { cancelAnalysis, startAnalysis } from "@/lib/pipeline";
import { useSessionStore, type PipelineStep } from "@/lib/store";

const STEPS: { id: PipelineStep; label: string; ready: boolean }[] = [
  { id: "preprocess", label: "영상 압축 (브라우저)", ready: true },
  { id: "upload", label: "Gemini 업로드", ready: false },
  { id: "analyze", label: "AI 분석", ready: false },
];

/** 1초마다 갱신되는 경과 시간 (렌더 중에는 현재 시각을 읽지 않음 — 프리렌더 안전) */
function useElapsed(startedAt: number | null, running: boolean) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  return startedAt && now ? Math.max(0, (now - startedAt) / 1000) : 0;
}

export function PipelineStatus() {
  const pipeline = useSessionStore((s) => s.pipeline);
  const processed = useSessionStore((s) => s.processed);
  const hasVideo = useSessionStore((s) => s.video !== null);
  const running = pipeline.status === "running";
  const elapsed = useElapsed(pipeline.startedAt, running);

  if (pipeline.status === "idle") return null;

  if (pipeline.status === "error" || pipeline.status === "cancelled") {
    const isError = pipeline.status === "error";
    return (
      <div
        role={isError ? "alert" : "status"}
        className={clsx(
          "flex items-start gap-3 rounded-2xl border px-4 py-3.5",
          isError ? "border-rose-200 bg-rose-50 text-rose-800" : "border-slate-200 bg-white text-slate-700",
        )}
      >
        <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">{isError ? "영상 처리 중 문제가 생겼어요" : "분석을 취소했어요"}</p>
          {pipeline.error && <p className="mt-1 break-all text-xs opacity-80">{pipeline.error}</p>}
        </div>
        {hasVideo && (
          <button
            type="button"
            onClick={startAnalysis}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-sm font-medium shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
          >
            <RotateCcw className="size-3.5" aria-hidden /> 다시 시도
          </button>
        )}
      </div>
    );
  }

  if (pipeline.status === "complete" && processed) {
    const reduction = 1 - processed.file.size / processed.originalSize;
    return (
      <div className="rounded-2xl border border-emerald-200 bg-white shadow-sm">
        <div className="flex items-start gap-3 px-4 py-3.5">
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-500" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">분석용 영상 준비 완료</p>
            <p className="mt-0.5 text-sm text-slate-600">
              {formatBytes(processed.originalSize)} → <b>{formatBytes(processed.file.size)}</b>
              {reduction > 0 && <span className="text-emerald-600"> ({Math.round(reduction * 100)}% 감소)</span>}
              <span className="text-slate-400"> · </span>
              {processed.width}×{processed.height} · 1fps · {processed.hasAudio ? "오디오 16kHz 모노" : "오디오 없음"}
              <span className="text-slate-400"> · </span>
              {processed.method === "capture" ? "빠른 처리" : "호환 모드"}{" "}
              {formatSeconds(processed.elapsedMs / 1000)}
            </p>
            {processed.warnings.map((w) => (
              <p key={w} className="mt-1.5 text-xs text-amber-700">
                {w}
              </p>
            ))}
          </div>
          <a
            href={processed.url}
            download={processed.file.name}
            className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            <Download className="size-3.5" aria-hidden /> 압축본
          </a>
        </div>
        <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
          다음 단계에서 이 파일을 Gemini로 보내 분석합니다. 지금 아래 리포트는 샘플입니다.
        </p>
      </div>
    );
  }

  // running
  return (
    <div className="rounded-2xl border border-indigo-200 bg-white px-4 py-4 shadow-sm" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <LoaderCircle className="size-5 shrink-0 animate-spin text-indigo-500" aria-hidden />
        <p className="flex-1 font-semibold">분석 준비 중</p>
        <span className="font-mono text-xs tabular-nums text-slate-500">{formatSeconds(elapsed)}</span>
        <button
          type="button"
          onClick={cancelAnalysis}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
        >
          <X className="size-3.5" aria-hidden /> 취소
        </button>
      </div>
      <ol className="mt-3 space-y-2.5">
        {STEPS.map((step) => {
          const active = pipeline.step === step.id;
          return (
            <li key={step.id}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className={clsx(active ? "font-medium text-slate-900" : "text-slate-400")}>{step.label}</span>
                <span className="text-xs tabular-nums text-slate-500">
                  {active ? `${Math.round(pipeline.progress * 100)}%` : !step.ready ? "3단계에서 연결" : ""}
                </span>
              </div>
              {active && (
                <>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-[width] duration-300"
                      style={{ width: `${pipeline.progress * 100}%` }}
                    />
                  </div>
                  {pipeline.detail && <p className="mt-1 text-xs text-slate-500">{pipeline.detail}</p>}
                </>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs text-slate-400">원본 영상은 이 컴퓨터 밖으로 나가지 않고 브라우저 안에서 압축됩니다.</p>
    </div>
  );
}
