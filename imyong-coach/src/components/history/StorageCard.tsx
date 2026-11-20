"use client";

import { useEffect, useId, useState } from "react";
import { HardDrive, LoaderCircle, VideoOff } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatBytes } from "@/lib/format";
import { storageUsage, videoSizes } from "@/lib/history/db";
import type { HistoryRecord } from "@/lib/history/types";
import { removeStoredVideos } from "@/lib/history/viewer";

const KEEP_OPTIONS = [0, 3, 5, 10, 20] as const;

/** 저장된 분석용 영상 크기 (기록의 영상 보유 상태가 바뀔 때마다 다시 읽음) */
export function useVideoSizes(records: HistoryRecord[]): Map<string, number> | null {
  const [sizes, setSizes] = useState<Map<string, number> | null>(null);
  const key = records
    .filter((r) => r.hasVideo)
    .map((r) => r.id)
    .join(",");
  useEffect(() => {
    let alive = true;
    videoSizes()
      .then((s) => alive && setSizes(s))
      .catch(() => alive && setSizes(new Map()));
    return () => {
      alive = false;
    };
  }, [key]);
  return sizes;
}

/**
 * 저장 공간 정리: 최근 N개 기록의 분석용 영상만 남기고 나머지 영상을 지웁니다.
 * 리포트·점수·자기 채점·발화 기록은 그대로 남습니다.
 */
export function StorageCard({ records, sizes }: { records: HistoryRecord[]; sizes: Map<string, number> | null }) {
  const selectId = useId();
  const [keep, setKeep] = useState<number>(5);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => {
    let alive = true;
    void storageUsage().then((u) => alive && setUsage(u));
    return () => {
      alive = false;
    };
  }, [sizes]);

  if (!sizes) return null;

  const recordIds = new Set(records.map((r) => r.id));
  const withVideo = records
    .filter((r) => r.hasVideo && sizes.has(r.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  // 기록 없이 남은 영상(예전 오류 등)도 함께 정리
  const orphans = [...sizes.keys()].filter((id) => !recordIds.has(id));
  const total = [...sizes.values()].reduce((a, b) => a + b, 0);
  const targets = [...withVideo.slice(keep).map((r) => r.id), ...orphans];
  const targetBytes = targets.reduce((a, id) => a + (sizes.get(id) ?? 0), 0);

  async function cleanUp() {
    const keepText = keep === 0 ? "모든 기록의 영상을" : `최근 ${keep}개를 뺀 나머지 기록의 영상을`;
    if (
      !window.confirm(
        `${keepText} 지울까요? (영상 ${targets.length}개 · 약 ${formatBytes(targetBytes)})\n리포트·점수·자기 채점은 그대로 남아요. 지운 영상은 되돌릴 수 없어요.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await removeStoredVideos(targets);
      setMessage({
        tone: "ok",
        text: `영상 ${targets.length}개(약 ${formatBytes(targetBytes)})를 지웠어요. 브라우저가 공간을 실제로 돌려받기까지 조금 걸릴 수 있어요.`,
      });
    } catch (err) {
      setMessage({ tone: "error", text: `정리하지 못했어요: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start gap-4 px-5 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
          <HardDrive className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 basis-72">
          <h2 className="font-semibold tracking-tight">저장 공간</h2>
          <p className="mt-1 text-sm text-slate-600">
            분석용 영상 <b className="text-slate-900">{withVideo.length + orphans.length}개</b> · 약{" "}
            <b className="text-slate-900">{formatBytes(total)}</b>
            {usage && <span className="text-slate-500"> (이 앱의 브라우저 저장 공간 사용량 약 {formatBytes(usage.usage)})</span>}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            영상은 기록을 열었을 때 타임스탬프로 장면을 다시 보는 데 쓰여요. 지워도 리포트·점수·자기 채점·발화 기록은 남고,
            기록을 열어 원본 영상을 연결하면 다시 볼 수 있어요.
          </p>
          {message && (
            <p
              role={message.tone === "error" ? "alert" : "status"}
              className={message.tone === "error" ? "mt-2 text-sm text-rose-700" : "mt-2 text-sm text-emerald-700"}
            >
              {message.text}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={selectId} className="text-sm text-slate-600">
            최근
          </label>
          <select
            id={selectId}
            value={keep}
            onChange={(e) => setKeep(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
          >
            {KEEP_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}개
              </option>
            ))}
          </select>
          <span className="text-sm text-slate-600">기록의 영상만 남기기</span>
          <button
            type="button"
            disabled={busy || targets.length === 0}
            onClick={() => void cleanUp()}
            className="flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <VideoOff className="size-4" aria-hidden />}
            {targets.length ? `정리하기 (영상 ${targets.length}개 · 약 ${formatBytes(targetBytes)})` : "정리할 영상 없음"}
          </button>
        </div>
      </div>
    </Card>
  );
}
