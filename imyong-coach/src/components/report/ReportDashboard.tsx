"use client";

import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { MODE_META } from "@/lib/constants";
import { SAMPLE_MODE, SAMPLE_REPORT } from "@/lib/mock/sampleReport";
import { useSessionStore } from "@/lib/store";
import { AlternativeList } from "@/components/report/AlternativeList";
import { PromptSummary } from "@/components/report/PromptSummary";
import { ScoreOverview } from "@/components/report/ScoreOverview";
import { SegmentFeedbackList } from "@/components/report/SegmentFeedbackList";
import { VideoPanel } from "@/components/report/VideoPanel";
import { VideoSeekProvider } from "@/components/report/VideoSeekContext";

export function ReportDashboard() {
  const video = useSessionStore((s) => s.video);
  const sessionMode = useSessionStore((s) => s.mode);
  const promptText = useSessionStore((s) => s.promptText);
  const promptImage = useSessionStore((s) => s.promptImage);
  const realReport = useSessionStore((s) => s.report);

  // 실제 분석 결과가 없으면 1단계 레이아웃 확인용 샘플을 보여 줍니다.
  const isSample = realReport === null;
  const report = realReport ?? SAMPLE_REPORT;
  const reportMode = isSample ? SAMPLE_MODE : sessionMode;

  return (
    <VideoSeekProvider hasVideo={video !== null}>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            <ArrowLeft className="size-4" aria-hidden /> 입력으로
          </Link>
          <h1 className="text-xl font-bold tracking-tight">분석 리포트</h1>
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
            {MODE_META[reportMode].label}
          </span>
        </div>

        {isSample && (
          <p className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              지금 오른쪽 리포트는 <b>레이아웃 확인용 샘플 데이터</b>입니다. 실제 AI 분석은 다음 단계에서
              연결됩니다. {video && "타임스탬프를 눌러 영상 이동은 지금도 확인할 수 있어요."}
            </span>
          </p>
        )}

        {/* 2단 레이아웃: 왼쪽 영상(고정) · 오른쪽 리포트(스크롤) */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <VideoPanel video={video} />
            <PromptSummary mode={sessionMode} text={promptText} image={promptImage} />
          </aside>

          <div className="min-w-0 space-y-6">
            <ScoreOverview report={report} mode={reportMode} />
            <SegmentFeedbackList segments={report.segments} />
            <AlternativeList alternatives={report.alternatives} mode={reportMode} />
          </div>
        </div>
      </div>
    </VideoSeekProvider>
  );
}
