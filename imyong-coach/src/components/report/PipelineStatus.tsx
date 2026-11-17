"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Check, CircleAlert, CircleCheck, Download, FileJson, LoaderCircle, RotateCcw, X } from "lucide-react";
import { asciiFileBase, formatBytes, formatSeconds } from "@/lib/format";
import { downloadHistoryFile, newRecord } from "@/lib/history/files";
import { useHistoryStore } from "@/lib/history/store";
import { cancelAnalysis, startAnalysis } from "@/lib/pipeline";
import { useSessionStore, type PipelineStep } from "@/lib/store";

const STEPS: { id: PipelineStep; label: string }[] = [
  { id: "preprocess", label: "영상 압축 (브라우저)" },
  { id: "upload", label: "Gemini 업로드" },
  { id: "analyze", label: "AI 분석" },
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

const n = (v: number | null | undefined) => (typeof v === "number" ? v.toLocaleString() : "-");

/** 이번 분석을 JSON(기록 백업 형식)으로 내보내기 — 다른 컴퓨터의 '기록 불러오기'로 가져올 수 있음 */
function exportCurrentReport() {
  const s = useSessionStore.getState();
  if (!s.report) return;
  const saved =
    s.historySave?.status === "saved"
      ? useHistoryStore.getState().records.find((r) => r.id === (s.historySave as { id: string }).id)
      : undefined;
  const record =
    saved ??
    newRecord({
      mode: s.report.mode,
      title: s.video?.file.name ?? "영상",
      promptText: s.analyzedInput?.promptText ?? s.promptText,
      durationSec: s.video?.durationSec ?? null,
      report: s.report,
      meta: s.analysisMeta,
    });
  downloadHistoryFile([record], `imyong-report-${record.mode}`);
}

function HistorySaveNote() {
  const save = useSessionStore((s) => s.historySave);
  if (!save) return null;
  if (save.status === "saving") return <p className="mt-1 text-xs text-slate-500">기록에 저장하는 중…</p>;
  if (save.status === "skipped") return <p className="mt-1 text-xs text-slate-500">{save.reason}</p>;
  if (save.status === "error") {
    return <p className="mt-1 text-xs text-rose-600">기록 저장에 실패했습니다: {save.message} (JSON 내보내기로 보관할 수 있어요)</p>;
  }
  return (
    <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-emerald-700">
      <Check className="size-3.5" aria-hidden /> 기록에 저장됨
      {save.withoutVideo && <span className="text-amber-700">(저장 공간이 부족해 영상은 빼고 저장)</span>}
      <Link href="/history" className="ml-1 font-medium text-indigo-600 hover:underline">
        기록 보기 →
      </Link>
    </p>
  );
}

export function PipelineStatus() {
  const pipeline = useSessionStore((s) => s.pipeline);
  const processed = useSessionStore((s) => s.processed);
  const meta = useSessionStore((s) => s.analysisMeta);
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
          "rounded-2xl border px-4 py-3.5",
          isError ? "border-rose-200 bg-rose-50 text-rose-800" : "border-slate-200 bg-white text-slate-700",
        )}
      >
        <div className="flex items-start gap-3">
          <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">{isError ? "분석 중 문제가 생겼어요" : "분석을 취소했어요"}</p>
            {pipeline.error && <p className="mt-1 break-words text-sm opacity-90">{pipeline.error}</p>}
          </div>
          {hasVideo && (
            <button
              type="button"
              onClick={startAnalysis}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            >
              <RotateCcw className="size-3.5" aria-hidden /> 다시 시도
            </button>
          )}
        </div>
        {pipeline.errorCode === "NO_API_KEY" && (
          <div className="mt-3 rounded-lg bg-white/80 px-3 py-2.5 text-xs text-slate-700 ring-1 ring-rose-100">
            <p className="font-medium">설정 방법</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4">
              <li>Google AI Studio(aistudio.google.com/apikey)에서 API 키를 발급받습니다.</li>
              <li>
                <code className="rounded bg-slate-100 px-1">imyong-coach/.env.local</code> 파일에{" "}
                <code className="rounded bg-slate-100 px-1">GEMINI_API_KEY=발급받은키</code> 를 적습니다.
              </li>
              <li>개발 서버(npm run dev)를 껐다 켠 뒤 다시 시도합니다.</li>
            </ol>
          </div>
        )}
      </div>
    );
  }

  if (pipeline.status === "complete") {
    const total = pipeline.startedAt && pipeline.finishedAt ? (pipeline.finishedAt - pipeline.startedAt) / 1000 : null;
    return (
      <div className={clsx("rounded-2xl border bg-white shadow-sm", meta?.mock ? "border-amber-200" : "border-emerald-200")}>
        <div className="flex flex-wrap items-start gap-3 px-4 py-3.5">
          <CircleCheck className={clsx("mt-0.5 size-5 shrink-0", meta?.mock ? "text-amber-500" : "text-emerald-500")} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{meta?.mock ? "모의 분석 완료 (실제 AI 분석 아님)" : "AI 분석 완료"}</p>
            <p className="mt-0.5 text-sm text-slate-600">
              {meta && !meta.mock && <>{meta.model} · </>}
              {total !== null && <>총 {formatSeconds(total)}</>}
              {meta?.usage && (
                <span className="text-slate-500">
                  {" "}
                  · 토큰 입력 {n(meta.usage.prompt)} / 출력 {n(meta.usage.output)}
                  {meta.usage.thoughts ? ` / 추론 ${n(meta.usage.thoughts)}` : ""}
                </span>
              )}
            </p>
            {meta?.mock && (
              <p className="mt-1 text-xs text-amber-700">
                GEMINI_MOCK=1 상태라 샘플 리포트를 표시했습니다. 실제 분석은 .env.local에서 GEMINI_MOCK을 지우고 API 키를 넣으세요.
              </p>
            )}
            {meta?.schemaFallback && (
              <p className="mt-1 text-xs text-slate-500">
                응답 형식 강제가 거부되어 지시문 방식으로 받았습니다. 결과는 같은 기준으로 검증했습니다.
              </p>
            )}
            <HistorySaveNote />
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            <button
              type="button"
              onClick={exportCurrentReport}
              title="다른 컴퓨터의 '기록 불러오기'로 가져올 수 있는 파일로 저장합니다"
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              <FileJson className="size-3.5" aria-hidden /> JSON 내보내기
            </button>
            <button
              type="button"
              onClick={startAnalysis}
              title="같은 영상으로 다시 분석합니다 (압축·업로드는 재사용, AI 분석 비용은 다시 발생)"
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              <RotateCcw className="size-3.5" aria-hidden /> 다시 분석
            </button>
          </div>
        </div>

        {processed && (
          <details className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
            <summary className="cursor-pointer select-none">분석용 영상 정보</summary>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                {formatBytes(processed.originalSize)} → <b className="text-slate-700">{formatBytes(processed.file.size)}</b>
              </span>
              <span>· {processed.width}×{processed.height} · 1fps · {processed.hasAudio ? "오디오 16kHz 모노" : "오디오 없음"}</span>
              <span>
                · {processed.method === "capture" ? "빠른 처리" : "호환 모드"} {formatSeconds(processed.elapsedMs / 1000)}
              </span>
              <a
                href={processed.url}
                download={`${asciiFileBase(processed.sourceFile.name, "video")}_analysis.mp4`}
                className="ml-auto inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline"
              >
                <Download className="size-3" aria-hidden /> 압축본 받기
              </a>
            </div>
            {processed.warnings.map((w) => (
              <p key={w} className="mt-1.5 text-amber-700">
                {w}
              </p>
            ))}
          </details>
        )}
      </div>
    );
  }

  // running
  const activeIndex = STEPS.findIndex((s) => s.id === pipeline.step);
  return (
    <div className="rounded-2xl border border-indigo-200 bg-white px-4 py-4 shadow-sm" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <LoaderCircle className="size-5 shrink-0 animate-spin text-indigo-500" aria-hidden />
        <p className="flex-1 font-semibold">분석 진행 중</p>
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
        {STEPS.map((step, i) => {
          const active = i === activeIndex;
          const done = activeIndex > i;
          return (
            <li key={step.id}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span
                  className={clsx(
                    "flex items-center gap-1.5",
                    active ? "font-medium text-slate-900" : done ? "text-slate-600" : "text-slate-400",
                  )}
                >
                  {done && <Check className="size-3.5 text-emerald-500" aria-hidden />}
                  {step.label}
                </span>
                {active && <span className="text-xs tabular-nums text-slate-500">{Math.round(pipeline.progress * 100)}%</span>}
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
      <p className="mt-3 text-xs text-slate-400">
        원본 영상은 브라우저 안에서 압축되고, Gemini에는 압축된 분석용 영상만 전송됩니다.
      </p>
    </div>
  );
}
