import { ClipboardList } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { ScorePips } from "@/components/report/ScorePips";
import { TimestampButton } from "@/components/report/TimestampButton";
import { SCORE_MAX, SCORE_SCALE, TONE_CLASS, areaAverage, toneFor5, type Rubric } from "@/lib/rubrics";
import type { RubricScores } from "@/lib/schema/report";

/** 채점기준표 형태: 영역 → 세부 기준(1~5점) + 근거 장면 */
export function RubricTable({ rubric, scores }: { rubric: Rubric; scores: RubricScores }) {
  return (
    <Card>
      <CardHeader
        icon={ClipboardList}
        title={rubric.title}
        description="세부 기준마다 1~5점 · 영역 점수는 세부 기준 평균"
      />

      <div className="divide-y divide-slate-100">
        {rubric.areas.map((area) => {
          const avg = areaAverage(area, scores);
          return (
            <details key={area.id} open className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 bg-slate-50/70 px-5 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{area.label}</span>
                  <span className="block text-xs text-slate-500">{area.description}</span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  <span className={`text-lg font-bold ${TONE_CLASS[toneFor5(avg)].text}`}>{avg.toFixed(1)}</span>
                  <span className="text-sm text-slate-400"> / {SCORE_MAX}</span>
                </span>
                <span className="text-slate-400 transition-transform group-open:rotate-90" aria-hidden>
                  ›
                </span>
              </summary>

              <ul className="divide-y divide-slate-100">
                {area.criteria.map((criterion) => {
                  const result = scores[area.id]?.[criterion.id];
                  return (
                    <li key={criterion.id} className="px-5 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-sm font-medium">{criterion.label}</h3>
                          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{criterion.description}</p>
                        </div>
                        <div className="shrink-0 pt-0.5">
                          {result ? <ScorePips score={result.score} /> : <span className="text-xs text-slate-400">미채점</span>}
                        </div>
                      </div>
                      {result?.evidence && (
                        <div className="mt-2 flex flex-wrap items-start gap-2 rounded-lg bg-slate-50 px-3 py-2">
                          <TimestampButton start={result.at} />
                          <p className="min-w-0 flex-1 text-sm leading-relaxed text-slate-700">{result.evidence}</p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </div>

      <div className="border-t border-slate-100 px-5 py-3">
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {SCORE_SCALE.map((s) => (
            <div key={s.score} className="flex gap-1" title={s.description}>
              <dt className="font-semibold tabular-nums text-slate-700">{s.score}</dt>
              <dd>{s.label}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-1.5 text-xs text-slate-400">기준 참고: {rubric.source}</p>
      </div>
    </Card>
  );
}
