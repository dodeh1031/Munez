import { Check, MessagesSquare, Plus } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { ScorePips } from "@/components/report/ScorePips";
import { TimestampButton } from "@/components/report/TimestampButton";
import {
  CONCEPT_CRITERIA,
  CONCEPT_CRITERION_IDS,
  QUESTION_FORMAT_LABEL,
  QUESTION_TYPES,
} from "@/lib/rubrics/interview";
import type { QuestionEval } from "@/lib/schema/report";

export function QuestionEvalList({ questions }: { questions: QuestionEval[] }) {
  return (
    <Card>
      <CardHeader
        icon={MessagesSquare}
        title="문항별 평가"
        description="문제 개념별 채점 항목(개념 이해·문제 분석·해결 방안·의지)으로 문항마다 1~5점"
      />
      <ol className="grid gap-4 p-5">
        {questions.map((q) => {
          const type = QUESTION_TYPES[q.type];
          return (
            <li key={q.number} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">문항 {q.number}</span>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  {QUESTION_FORMAT_LABEL[q.format]}
                </span>
                <span
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                  title={`유형별 기준: ${type.focus.join(" · ")}`}
                >
                  type {type.no} · {type.label}
                </span>
                <TimestampButton start={q.start} end={q.end} className="ml-auto" />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{q.question}</p>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-slate-50 px-3 py-2.5">
                {CONCEPT_CRITERION_IDS.map((id) => (
                  <div key={id} className="flex items-center justify-between gap-2" title={CONCEPT_CRITERIA[id].description}>
                    <dt className="text-xs text-slate-600">{CONCEPT_CRITERIA[id].label}</dt>
                    <dd>
                      <ScorePips score={q.scores[id]} size="sm" />
                    </dd>
                  </div>
                ))}
              </dl>

              {(q.keywordsCovered.length > 0 || q.keywordsMissed.length > 0) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {q.keywordsCovered.map((k) => (
                    <span
                      key={`c-${k}`}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
                    >
                      <Check className="size-3" aria-hidden />
                      {k}
                    </span>
                  ))}
                  {q.keywordsMissed.map((k) => (
                    <span
                      key={`m-${k}`}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-rose-300 px-2 py-0.5 text-xs text-rose-600"
                    >
                      <Plus className="size-3" aria-hidden />
                      {k}
                    </span>
                  ))}
                </div>
              )}

              <p className="mt-3 text-sm leading-relaxed text-slate-600">{q.feedback}</p>
            </li>
          );
        })}
      </ol>
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1 text-emerald-700">
          <Check className="size-3" aria-hidden /> 언급한 키워드
        </span>
        <span className="mx-2 text-slate-300">·</span>
        <span className="inline-flex items-center gap-1 text-rose-600">
          <Plus className="size-3" aria-hidden /> 보충하면 좋을 키워드
        </span>
      </p>
    </Card>
  );
}
