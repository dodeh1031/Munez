"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { AlternativeList } from "@/components/report/AlternativeList";
import { ConditionChecks } from "@/components/report/ConditionChecks";
import { PipelineStatus } from "@/components/report/PipelineStatus";
import { PromptSummary } from "@/components/report/PromptSummary";
import { QuestionEvalList } from "@/components/report/QuestionEvalList";
import { RubricTable } from "@/components/report/RubricTable";
import { ScoreOverview } from "@/components/report/ScoreOverview";
import { SegmentFeedbackList } from "@/components/report/SegmentFeedbackList";
import { SelfChecklist } from "@/components/report/SelfChecklist";
import { VideoPanel } from "@/components/report/VideoPanel";
import { VideoSeekProvider } from "@/components/report/VideoSeekContext";
import { MODE_META } from "@/lib/constants";
import { SAMPLE_REPORTS } from "@/lib/mock/sampleReport";
import { getRubric } from "@/lib/rubrics";
import type { AnalysisReport } from "@/lib/schema/report";
import { useSessionStore } from "@/lib/store";

export function ReportDashboard() {
  const video = useSessionStore((s) => s.video);
  const sessionMode = useSessionStore((s) => s.mode);
  const promptText = useSessionStore((s) => s.promptText);
  const promptImage = useSessionStore((s) => s.promptImage);
  const realReport = useSessionStore((s) => s.report);
  const processed = useSessionStore((s) => s.processed);

  // 실제 분석 결과가 없으면, 입력 화면에서 고른 모드의 샘플 리포트를 보여 줍니다.
  const isSample = realReport === null;
  const report = realReport ?? SAMPLE_REPORTS[sessionMode];

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
            {MODE_META[report.mode].label}
          </span>
        </div>

        {isSample && (
          <p className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              지금 보이는 리포트는 <b>{MODE_META[report.mode].label} 채점표 미리보기용 샘플 데이터</b>입니다.
              {video
                ? " 'AI 분석 시작'을 누르면 내 영상의 실제 분석 결과로 바뀝니다."
                : " 입력 화면에서 영상을 올리고 분석을 시작하세요."}
            </span>
          </p>
        )}

        {/* 2단 레이아웃: 왼쪽 영상(고정) · 오른쪽 리포트 */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <VideoPanel video={video} processed={processed} />
            <PromptSummary mode={sessionMode} text={promptText} image={promptImage} />
          </aside>

          <div className="min-w-0 space-y-4">
            <PipelineStatus />
            {/* 모드가 바뀌면 탭 상태를 초기화 */}
            <ReportTabs key={report.mode} report={report} />
          </div>
        </div>
      </div>
    </VideoSeekProvider>
  );
}

type TabId = "overview" | "questions" | "rubric" | "segments" | "alternatives" | "checklist";

function ReportTabs({ report }: { report: AnalysisReport }) {
  const [tab, setTab] = useState<TabId>("overview");
  const rubric = getRubric(report.mode);
  const altLabel = MODE_META[report.mode].alternativeLabel;

  const tabs: TabItem<TabId>[] =
    report.mode === "demo"
      ? [
          { id: "overview", label: "종합" },
          { id: "rubric", label: "채점표" },
          { id: "segments", label: "구간 피드백", count: report.segments.length },
          { id: "alternatives", label: altLabel, count: report.alternatives.length },
        ]
      : [
          { id: "overview", label: "종합" },
          { id: "questions", label: "문항별", count: report.questions.length },
          { id: "rubric", label: "채점표" },
          { id: "segments", label: "구간 피드백", count: report.segments.length },
          { id: "alternatives", label: altLabel, count: report.alternatives.length },
          { id: "checklist", label: "자기점검표" },
        ];

  return (
    <div className="min-w-0 space-y-4">
      <Tabs tabs={tabs} value={tab} onChange={setTab} label="리포트 항목" idPrefix="report" />
      <div role="tabpanel" id="report-panel" aria-labelledby={`report-tab-${tab}`} className="space-y-6">
        {tab === "overview" && (
          <>
            <ScoreOverview report={report} rubric={rubric} />
            {report.mode === "demo" && <ConditionChecks checks={report.conditionChecks} />}
          </>
        )}
        {tab === "questions" && report.mode === "interview" && <QuestionEvalList questions={report.questions} />}
        {tab === "rubric" && <RubricTable rubric={rubric} scores={report.scores} />}
        {tab === "segments" && <SegmentFeedbackList segments={report.segments} rubric={rubric} />}
        {tab === "alternatives" && <AlternativeList alternatives={report.alternatives} mode={report.mode} />}
        {tab === "checklist" && report.mode === "interview" && <SelfChecklist checklist={report.checklist} />}
      </div>
    </div>
  );
}
