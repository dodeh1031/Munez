import clsx from "clsx";
import { CircleAlert, CircleCheck, Timer, TriangleAlert } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { TimestampButton } from "@/components/report/TimestampButton";
import { formatSeconds, parseTimestamp } from "@/lib/format";
import { QUESTION_FORMAT_LABEL } from "@/lib/rubrics/interview";
import type { AnalysisReport, QuestionEval } from "@/lib/schema/report";
import { judgeUsage, koreanDuration, type TimeLimits, type UsageTone } from "@/lib/timeLimits";

/**
 * 시간 관리 — AI 판단과 별개로 코드가 계산한 사실(영상 길이, 문항별 소요 시간)을 제한 시간과 비교합니다.
 */
export function TimeUsageCard({
  report,
  durationSec,
  timeLimits,
}: {
  report: AnalysisReport;
  durationSec: number | null;
  timeLimits: TimeLimits | null | undefined;
}) {
  const note = timeLimits?.note.trim();
  return (
    <Card>
      <CardHeader icon={Timer} title="시간 관리" description="입력한 시간 조건과 실제 사용 시간 비교" />
      <div className="space-y-5 p-5">
        {report.mode === "demo" ? (
          <DemoTiming durationSec={durationSec} limitMin={timeLimits?.lessonMin ?? null} />
        ) : (
          <InterviewTiming questions={report.questions} durationSec={durationSec} limits={timeLimits} />
        )}
        {note && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="font-medium text-slate-700">조건 메모 </span>
            {note}
          </p>
        )}
      </div>
    </Card>
  );
}

function DemoTiming({ durationSec, limitMin }: { durationSec: number | null; limitMin: number | null }) {
  if (durationSec === null) return <p className="text-sm text-slate-500">영상 길이를 알 수 없어 시간을 비교할 수 없어요.</p>;
  if (!limitMin) {
    return (
      <>
        <p className="text-sm">
          실연 시간 <b className="tabular-nums">{formatSeconds(durationSec)}</b>
        </p>
        <NoLimitHint />
      </>
    );
  }
  return <UsageRow label="실연 시간" usedSec={durationSec} limitSec={limitMin * 60} />;
}

const qDuration = (q: QuestionEval) => Math.max(0, parseTimestamp(q.end) - parseTimestamp(q.start));

function InterviewTiming({
  questions,
  durationSec,
  limits,
}: {
  questions: QuestionEval[];
  durationSec: number | null;
  limits: TimeLimits | null | undefined;
}) {
  const groups = (["prepared", "instant"] as const)
    .map((format) => ({
      format,
      items: questions.filter((q) => q.format === format),
      limitMin: format === "prepared" ? (limits?.preparedMin ?? null) : (limits?.instantMin ?? null),
    }))
    .filter((g) => g.items.length > 0);
  const anyLimit = groups.some((g) => g.limitMin);

  return (
    <>
      {groups.map(({ format, items, limitMin }) => {
        const used = items.reduce((sum, q) => sum + qDuration(q), 0);
        const perQ = limitMin ? (limitMin * 60) / items.length : null;
        const scale = Math.max(perQ ?? 0, ...items.map(qDuration)) || 1;
        return (
          <section key={format} className="space-y-3">
            {limitMin ? (
              <UsageRow label={`${QUESTION_FORMAT_LABEL[format]} 답변 합계`} usedSec={used} limitSec={limitMin * 60} />
            ) : (
              <p className="text-sm">
                {QUESTION_FORMAT_LABEL[format]} 답변 합계 <b className="tabular-nums">{formatSeconds(used)}</b>
              </p>
            )}
            <ul className="space-y-2">
              {items.map((q) => {
                const d = qDuration(q);
                const over = perQ !== null && d > perQ * 1.15;
                return (
                  <li key={q.number} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-12 font-medium text-slate-700">문항 {q.number}</span>
                      <TimestampButton start={q.start} />
                    </span>
                    <span className="relative h-2 rounded-full bg-slate-100" aria-hidden>
                      <span
                        className={clsx("absolute inset-y-0 left-0 rounded-full", over ? "bg-amber-500" : "bg-[#2a78d6]")}
                        style={{ width: `${Math.min(100, (d / scale) * 100)}%` }}
                      />
                      {perQ !== null && (
                        <span
                          className="absolute -inset-y-1 w-px bg-slate-500"
                          style={{ left: `${Math.min(100, (perQ / scale) * 100)}%` }}
                          title="문항별 권장 시간"
                        />
                      )}
                    </span>
                    <span className="w-28 text-right tabular-nums text-slate-600">
                      {formatSeconds(d)}
                      {perQ !== null && <span className="text-slate-400"> / 권장 {formatSeconds(perQ)}</span>}
                      {over && <span className="sr-only"> (권장 시간 초과)</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {groups.length === 0 && <p className="text-sm text-slate-500">문항 구간 정보가 없어 문항별 시간을 계산할 수 없어요.</p>}
      <p className="text-xs text-slate-400">
        {durationSec !== null && <>전체 영상 {formatSeconds(durationSec)} · </>}
        문항 시간은 AI가 표시한 시작·끝 기준이라 몇 초 차이가 날 수 있어요.
        {anyLimit && " 세로선은 문항별 권장 시간(답변 시간 ÷ 문항 수)입니다."}
      </p>
      {!anyLimit && <NoLimitHint />}
    </>
  );
}

const TONE_STYLE: Record<UsageTone, { icon: typeof CircleCheck; chip: string; fill: string }> = {
  good: { icon: CircleCheck, chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", fill: "bg-[#2a78d6]" },
  warning: { icon: TriangleAlert, chip: "bg-amber-50 text-amber-800 ring-amber-200", fill: "bg-[#2a78d6]" },
  critical: { icon: CircleAlert, chip: "bg-rose-50 text-rose-700 ring-rose-200", fill: "bg-[#2a78d6]" },
};

/** 사용 시간 막대 (제한선 표시, 초과분은 빨간색) + 상태 라벨(아이콘+문구) */
function UsageRow({ label, usedSec, limitSec }: { label: string; usedSec: number; limitSec: number }) {
  const status = judgeUsage(usedSec, limitSec);
  const style = TONE_STYLE[status.tone];
  const Icon = style.icon;
  const total = Math.max(usedSec, limitSec);
  const within = Math.min(usedSec, limitSec);
  const over = Math.max(0, usedSec - limitSec);
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span>
          {label} <b className="tabular-nums">{formatSeconds(usedSec)}</b>
          <span className="text-slate-400"> / 제한 {koreanDuration(limitSec)}</span>
        </span>
        <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1", style.chip)}>
          <Icon className="size-3.5" aria-hidden /> {status.label}
        </span>
      </div>
      <div className="relative mt-2 flex h-2.5 gap-0.5" aria-hidden>
        <span className={clsx("h-full rounded-l-full", style.fill, over === 0 && "rounded-r-full")} style={{ width: `${(within / total) * 100}%` }} />
        {over > 0 && <span className="h-full rounded-r-full bg-rose-500" style={{ width: `${(over / total) * 100}%` }} />}
        {over === 0 && usedSec < limitSec && <span className="h-full flex-1 rounded-r-full bg-slate-100" />}
        <span className="absolute -inset-y-1 w-0.5 rounded bg-slate-700" style={{ left: `${(limitSec / total) * 100}%` }} title="제한 시간" />
      </div>
    </div>
  );
}

function NoLimitHint() {
  return (
    <p className="rounded-lg bg-indigo-50/60 px-3 py-2 text-xs text-indigo-800">
      입력 화면에서 시간 조건(제한 시간)을 넣고 분석하면 제한 시간 대비 사용 시간과 초과 여부를 보여 드려요.
    </p>
  );
}
