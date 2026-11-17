"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Printer } from "lucide-react";
import { AlternativeList } from "@/components/report/AlternativeList";
import { ConditionChecks } from "@/components/report/ConditionChecks";
import { QuestionEvalList } from "@/components/report/QuestionEvalList";
import { RubricTable } from "@/components/report/RubricTable";
import { ScoreOverview } from "@/components/report/ScoreOverview";
import { SegmentFeedbackList } from "@/components/report/SegmentFeedbackList";
import { SelfChecklist } from "@/components/report/SelfChecklist";
import { SelfScorePanel } from "@/components/report/SelfScorePanel";
import { SpeechMetricsCard, TranscriptCard } from "@/components/report/SpeechMetricsCard";
import { TimeUsageCard } from "@/components/report/TimeUsageCard";
import { MODE_META } from "@/lib/constants";
import { getRubric } from "@/lib/rubrics";
import type { AnalysisReport } from "@/lib/schema/report";
import type { SelfScore } from "@/lib/selfScore";
import { hasLimits, koreanDuration, type TimeLimits } from "@/lib/timeLimits";

export interface PrintInfo {
  title: string;
  dateLabel: string;
  promptText: string;
  model: string | null;
  isSample: boolean;
}

/** PDF 파일 이름: "임용코치_수업실연_2026-11-17" (날짜가 없으면 인쇄하는 날) */
export interface PdfName {
  base: string;
  date: string | number | null;
}

function pdfFileName({ base, date }: PdfName): string {
  const d = new Date(date ?? Date.now());
  const p = (n: number) => String(n).padStart(2, "0");
  return `${base}_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 인쇄 모드: 브라우저가 인쇄를 시작하기 직전(beforeprint)에 인쇄용 화면을 그리고, 끝나면(afterprint) 치웁니다.
 * 버튼으로 인쇄하든 Ctrl+P로 인쇄하든 같은 결과가 나옵니다. 문서 제목은 PDF 파일 이름으로 쓰입니다.
 * (현재 시각은 렌더링 중이 아니라 인쇄를 시작할 때 읽음 — 프리렌더 안전)
 */
export function usePrintMode(pdfName: PdfName): boolean {
  const [printing, setPrinting] = useState(false);
  const nameRef = useRef(pdfName);
  useEffect(() => {
    nameRef.current = pdfName;
  }, [pdfName]);

  useEffect(() => {
    let previous = document.title;
    let active = false; // 인쇄 시작 이벤트가 겹쳐 와도 원래 제목을 한 번만 기억
    const before = () => {
      if (!active) previous = document.title;
      active = true;
      document.title = pdfFileName(nameRef.current);
      flushSync(() => setPrinting(true));
    };
    const after = () => {
      if (active) document.title = previous;
      active = false;
      setPrinting(false);
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);
  return printing;
}

/** 인쇄 · PDF 버튼 (옵션: 발화 기록 포함) */
export function PrintButton({
  includeTranscript,
  onIncludeTranscriptChange,
  hasTranscript,
}: {
  includeTranscript: boolean;
  onIncludeTranscriptChange: (v: boolean) => void;
  hasTranscript: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
      >
        <Printer className="size-4" aria-hidden /> 인쇄 · PDF
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-lg">
          <p className="font-semibold">리포트 인쇄 · PDF 저장</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            모든 탭 내용을 한 문서로 정리합니다. 인쇄 창의 &lsquo;대상&rsquo;에서 <b>PDF로 저장</b>을 고르면 PDF 파일이 됩니다.
          </p>
          {hasTranscript && (
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeTranscript}
                onChange={(e) => onIncludeTranscriptChange(e.target.checked)}
                className="mt-0.5 size-4 accent-indigo-600"
              />
              <span>
                발화 기록 포함 <span className="block text-xs text-slate-500">영상이 길면 페이지가 많이 늘어나요</span>
              </span>
            </label>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-slate-500 hover:bg-slate-50">
              닫기
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                // 메뉴가 닫힌 뒤 인쇄 창 열기
                requestAnimationFrame(() => window.print());
              }}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white hover:bg-indigo-700"
            >
              인쇄하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** 인쇄 전용 화면: 모든 탭 내용을 순서대로 펼침 (화면에는 보이지 않음) */
export function PrintableReport({
  report,
  info,
  durationSec,
  timeLimits,
  selfScore,
  aiAvailable,
  includeTranscript,
}: {
  report: AnalysisReport;
  info: PrintInfo;
  durationSec: number | null;
  timeLimits: TimeLimits | null | undefined;
  selfScore: SelfScore | null;
  aiAvailable: boolean;
  includeTranscript: boolean;
}) {
  const rubric = getRubric(report.mode);
  const showSelf = aiAvailable && selfScore?.mode === report.mode;
  const time = timeLimits && hasLimits(timeLimits)
    ? [
        timeLimits.lessonMin ? `실연 ${koreanDuration(timeLimits.lessonMin * 60)}` : null,
        timeLimits.preparedMin ? `구상형 ${koreanDuration(timeLimits.preparedMin * 60)}` : null,
        timeLimits.instantMin ? `즉답형 ${koreanDuration(timeLimits.instantMin * 60)}` : null,
        timeLimits.note.trim() || null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <div className="print-root hidden text-slate-900 print:block">
      <header className="mb-5 border-b-2 border-slate-800 pb-3">
        <p className="text-xs text-slate-500">임용 2차 AI 코치</p>
        <h1 className="text-2xl font-bold">
          {MODE_META[report.mode].label} 분석 리포트{info.isSample && " (샘플)"}
        </h1>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
          <dt className="text-slate-500">영상</dt>
          <dd>{info.title}</dd>
          <dt className="text-slate-500">분석 일시</dt>
          <dd>{info.dateLabel}</dd>
          {info.model && (
            <>
              <dt className="text-slate-500">AI 모델</dt>
              <dd>{info.model}</dd>
            </>
          )}
          {time && (
            <>
              <dt className="text-slate-500">시간 조건</dt>
              <dd>{time}</dd>
            </>
          )}
        </dl>
        {info.promptText.trim() && (
          <div className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-sm">
            <p className="text-xs font-medium text-slate-500">{report.mode === "demo" ? "수업 조건" : "면접 문항"}</p>
            <p className="whitespace-pre-wrap">{info.promptText}</p>
          </div>
        )}
      </header>

      <div className="space-y-4">
        <ScoreOverview report={report} rubric={rubric} />
        {report.mode === "demo" && <ConditionChecks checks={report.conditionChecks} />}
        <TimeUsageCard report={report} durationSec={durationSec} timeLimits={timeLimits} />
        {report.mode === "interview" && <QuestionEvalList questions={report.questions} />}
        <RubricTable rubric={rubric} scores={report.scores} />
        <SegmentFeedbackList segments={report.segments} rubric={rubric} />
        <AlternativeList alternatives={report.alternatives} mode={report.mode} />
        {report.mode === "interview" && <SelfChecklist checklist={report.checklist} />}
        <SpeechMetricsCard transcript={report.transcript} mode={report.mode} durationSec={durationSec} />
        {showSelf && <SelfScorePanel rubric={rubric} selfScore={selfScore} canScore aiScores={report.scores} />}
        {includeTranscript && <TranscriptCard transcript={report.transcript} />}
      </div>

      <footer className="mt-6 border-t border-slate-200 pt-2 text-xs text-slate-500">
        AI 분석 결과는 참고용 추정치입니다. 채점 기준: {rubric.source}
      </footer>
    </div>
  );
}
