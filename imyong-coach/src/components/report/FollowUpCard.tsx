"use client";

import clsx from "clsx";
import { ArrowDown, ArrowUp, FolderOpen, History } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { TimestampButton } from "@/components/report/TimestampButton";
import { FOLLOW_UP_STATUS_META } from "@/lib/constants";
import { useHistoryStore } from "@/lib/history/store";
import { openRecord } from "@/lib/history/viewer";
import { FOLLOW_UP_STATUSES, type FollowUp } from "@/lib/schema/report";

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "지난" : d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
};

export function followUpCounts(followUp: FollowUp) {
  return Object.fromEntries(
    FOLLOW_UP_STATUSES.map((s) => [s, followUp.items.filter((i) => i.status === s).length]),
  ) as Record<(typeof FOLLOW_UP_STATUSES)[number], number>;
}

function ScoreChange({ before, after }: { before: number; after: number }) {
  const diff = after - before;
  return (
    <span className="inline-flex items-center gap-1">
      {before}점 → <b className="text-slate-900">{after}점</b>
      {diff !== 0 && (
        <span className={clsx("inline-flex items-center font-medium", diff > 0 ? "text-emerald-700" : "text-rose-600")}>
          {diff > 0 ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
          {diff > 0 ? "+" : ""}
          {diff}
        </span>
      )}
    </span>
  );
}

/** 지난 피드백 반영 확인 결과 (리포트 탭·인쇄) */
export function FollowUpCard({ followUp, currentOverall }: { followUp: FollowUp; currentOverall: number }) {
  const counts = followUpCounts(followUp);
  const baseExists = useHistoryStore((s) => s.records.some((r) => r.id === followUp.base.recordId));

  return (
    <Card>
      <CardHeader
        icon={History}
        title="지난 피드백 반영 확인"
        description={`${fmtDate(followUp.base.createdAt)} 연습에서 받은 피드백 ${followUp.items.length}개가 이번 영상에서 고쳐졌는지 확인했어요.`}
        action={
          baseExists ? (
            <button
              type="button"
              onClick={() => void openRecord(followUp.base.recordId)}
              className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 print:hidden"
            >
              <FolderOpen className="size-3.5" aria-hidden /> 지난 기록 열기
            </button>
          ) : undefined
        }
      />
      <div className="space-y-3 border-b border-slate-100 px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
          <span>
            종합 점수 <ScoreChange before={followUp.base.overall} after={currentOverall} />
          </span>
          <span className="flex flex-wrap gap-1.5">
            {FOLLOW_UP_STATUSES.map((s) =>
              counts[s] ? (
                <span key={s} className={clsx("rounded-full px-2 py-0.5 text-xs font-medium ring-1", FOLLOW_UP_STATUS_META[s].className)}>
                  {FOLLOW_UP_STATUS_META[s].label} {counts[s]}
                </span>
              ) : null,
            )}
          </span>
        </div>
        {followUp.summary && <p className="text-sm leading-relaxed text-slate-700">{followUp.summary}</p>}
      </div>
      <ol className="divide-y divide-slate-100">
        {followUp.items.map((item, i) => {
          const meta = FOLLOW_UP_STATUS_META[item.status];
          return (
            <li key={item.id} className="flex gap-3 px-5 py-3.5">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={clsx("rounded-full px-2 py-0.5 text-xs font-medium ring-1", meta.className)}>{meta.label}</span>
                  <span className="text-xs text-slate-400">{item.source}</span>
                </div>
                <p className="mt-1 text-sm font-medium text-slate-800">{item.point}</p>
                <div className="mt-1.5 flex flex-wrap items-start gap-2">
                  <TimestampButton start={item.at} />
                  <p className="min-w-0 flex-1 text-sm leading-relaxed text-slate-600">{item.evidence}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/** 종합 탭 위쪽 요약 한 줄 (누르면 '지난 피드백' 탭으로) */
export function FollowUpBanner({ followUp, onOpen }: { followUp: FollowUp; onOpen: () => void }) {
  const counts = followUpCounts(followUp);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-left text-sm hover:bg-indigo-50"
    >
      <History className="size-4 shrink-0 text-indigo-600" aria-hidden />
      <span className="font-medium text-slate-800">
        지난 피드백 {followUp.items.length}개 중 개선 {counts.improved} · 일부 {counts.partly} · 아직 {counts.not_yet}
        {counts.not_observed ? ` · 판단 불가 ${counts.not_observed}` : ""}
      </span>
      <span className="ml-auto text-xs font-medium text-indigo-700">자세히 보기 →</span>
    </button>
  );
}
