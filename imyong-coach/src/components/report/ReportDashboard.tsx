"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileJson, FolderOpen, History, Info, Video, X } from "lucide-react";
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
import { VideoPanel, type PlaybackMedia } from "@/components/report/VideoPanel";
import { VideoSeekProvider } from "@/components/report/VideoSeekContext";
import { MODE_META } from "@/lib/constants";
import { downloadHistoryFile } from "@/lib/history/files";
import { useHistoryStore } from "@/lib/history/store";
import { attachOriginalVideo, closeRecord } from "@/lib/history/viewer";
import { SAMPLE_REPORTS } from "@/lib/mock/sampleReport";
import { getRubric } from "@/lib/rubrics";
import type { AnalysisReport } from "@/lib/schema/report";
import { useSessionStore, type ViewingRecord } from "@/lib/store";

export function ReportDashboard() {
  const viewing = useSessionStore((s) => s.viewing);
  return viewing ? <SavedRecordDashboard viewing={viewing} /> : <SessionDashboard />;
}

/** 지금 작업 중인 분석 (진행 상황 + 결과, 결과가 없으면 샘플) */
function SessionDashboard() {
  const video = useSessionStore((s) => s.video);
  const sessionMode = useSessionStore((s) => s.mode);
  const promptText = useSessionStore((s) => s.promptText);
  const promptImage = useSessionStore((s) => s.promptImage);
  const realReport = useSessionStore((s) => s.report);
  const processed = useSessionStore((s) => s.processed);
  const historyCount = useHistoryStore((s) => s.records.length);

  useEffect(() => {
    void useHistoryStore.getState().load();
  }, []);

  // 실제 분석 결과가 없으면, 입력 화면에서 고른 모드의 샘플 리포트를 보여 줍니다.
  const isSample = realReport === null;
  const report = realReport ?? SAMPLE_REPORTS[sessionMode];

  // 브라우저가 원본을 재생하지 못하면(HEVC 등) 압축된 분석용 영상으로 재생
  const media: PlaybackMedia | null = video
    ? {
        url: video.decodable ? video.url : (processed?.url ?? null),
        name: video.file.name,
        size: video.file.size,
        durationSec: video.durationSec,
        note: video.decodable ? undefined : "(분석용 영상으로 재생 중)",
        unavailable: {
          title: "이 브라우저에서 원본을 재생할 수 없어요.",
          detail: "호환 모드 압축이 끝나면 분석용 영상으로 재생됩니다.",
        },
      }
    : null;

  const banner = isSample ? (
    <p className="mb-4 flex flex-wrap items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        지금 보이는 리포트는 <b>{MODE_META[report.mode].label} 채점표 미리보기용 샘플 데이터</b>입니다.
        {video
          ? " 'AI 분석 시작'을 누르면 내 영상의 실제 분석 결과로 바뀝니다."
          : " 입력 화면에서 영상을 올리고 분석을 시작하세요."}
      </span>
      {historyCount > 0 && (
        <Link href="/history" className="inline-flex shrink-0 items-center gap-1 font-medium text-amber-900 underline-offset-2 hover:underline">
          <History className="size-4" aria-hidden /> 저장된 기록 {historyCount}개 보기
        </Link>
      )}
    </p>
  ) : null;

  return (
    <DashboardShell
      report={report}
      tabsKey={report.mode}
      media={media}
      banner={banner}
      prompt={<PromptSummary mode={sessionMode} text={promptText} image={promptImage} />}
      status={<PipelineStatus />}
    />
  );
}

/** 기록 화면에서 연 저장된 분석 */
function SavedRecordDashboard({ viewing }: { viewing: ViewingRecord }) {
  const { record } = viewing;
  const fileInput = useRef<HTMLInputElement>(null);
  const url = viewing.originalUrl ?? viewing.videoUrl;
  const media: PlaybackMedia = {
    url,
    name: viewing.originalName ?? record.title,
    size: null,
    durationSec: record.durationSec,
    note: viewing.originalUrl ? "(연결한 원본 영상)" : viewing.videoUrl ? "(저장된 분석용 영상 · 초당 1장)" : undefined,
    unavailable: {
      title: "이 기록에는 저장된 영상이 없어요.",
      detail: "아래 '원본 영상 연결'로 그때 영상을 고르면 타임스탬프로 장면을 찾아갈 수 있어요.",
    },
  };
  const when = new Date(record.createdAt).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });

  const banner = (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-3 text-sm">
      <FolderOpen className="size-4 shrink-0 text-indigo-600" aria-hidden />
      <span className="min-w-0 flex-1 text-slate-700">
        <b>저장된 기록</b> · {when} · {record.title}
        {record.source === "imported" && <span className="ml-1.5 text-xs text-slate-500">(가져온 기록)</span>}
      </span>
      <input
        ref={fileInput}
        type="file"
        accept="video/*,.mov,.mp4,.webm"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) attachOriginalVideo(f);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          title="그때 분석한 원본 영상을 고르면 부드럽게 재생됩니다"
          className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
        >
          <Video className="size-3.5" aria-hidden /> 원본 영상 연결
        </button>
        <button
          type="button"
          onClick={() => downloadHistoryFile([record], `imyong-report-${record.mode}`)}
          className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
        >
          <FileJson className="size-3.5" aria-hidden /> JSON 내보내기
        </button>
        <Link
          href="/history"
          className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
        >
          <History className="size-3.5" aria-hidden /> 기록 목록
        </Link>
        <button
          type="button"
          onClick={closeRecord}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-white"
        >
          <X className="size-3.5" aria-hidden /> 닫기
        </button>
      </div>
    </div>
  );

  return (
    <DashboardShell
      report={record.report}
      tabsKey={`${record.mode}-${record.id}`}
      media={media}
      banner={banner}
      prompt={<PromptSummary mode={record.mode} text={record.promptText} image={null} />}
      status={null}
    />
  );
}

function DashboardShell({
  report,
  tabsKey,
  media,
  banner,
  prompt,
  status,
}: {
  report: AnalysisReport;
  tabsKey: string;
  media: PlaybackMedia | null;
  banner: React.ReactNode;
  prompt: React.ReactNode;
  status: React.ReactNode;
}) {
  return (
    <VideoSeekProvider hasVideo={Boolean(media?.url)}>
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

        {banner}

        {/* 2단 레이아웃: 왼쪽 영상(고정) · 오른쪽 리포트 */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <VideoPanel media={media} />
            {prompt}
          </aside>

          <div className="min-w-0 space-y-4">
            {status}
            {/* 모드나 기록이 바뀌면 탭 상태를 초기화 */}
            <ReportTabs key={tabsKey} report={report} />
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
