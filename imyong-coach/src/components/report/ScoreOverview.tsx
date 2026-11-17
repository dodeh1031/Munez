import { Gauge } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { SCORE_MAX, TONE_CLASS, areaAverage, overallScore, toneFor100, toneFor5, type Rubric } from "@/lib/rubrics";
import type { AnalysisReport } from "@/lib/schema/report";

export function ScoreOverview({ report, rubric }: { report: AnalysisReport; rubric: Rubric }) {
  const overall = overallScore(rubric, report.scores);
  const grade = toneFor100(overall);
  const tone = TONE_CLASS[grade.tone];
  const r = 52;
  const circumference = 2 * Math.PI * r;

  return (
    <Card>
      <CardHeader
        icon={Gauge}
        title="종합 평가"
        description={`${rubric.areas.length}개 영역 평균(5점 만점)을 100점으로 환산`}
      />
      <div className="grid items-center gap-5 p-5 sm:grid-cols-[auto_1fr]">
        <div className="relative mx-auto size-36" role="img" aria-label={`종합 점수 ${overall}점, ${grade.label}`}>
          <svg viewBox="0 0 120 120" className="size-full -rotate-90">
            <circle cx="60" cy="60" r={r} className="fill-none stroke-slate-100" strokeWidth="10" />
            <circle
              cx="60"
              cy="60"
              r={r}
              className={`fill-none ${tone.stroke}`}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - overall / 100)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold tabular-nums tracking-tight">{overall}</span>
            <span className={`text-sm font-semibold ${tone.text}`}>{grade.label}</span>
          </div>
        </div>
        <p className="leading-relaxed text-slate-700">{report.summary}</p>
      </div>

      <ul className="grid gap-3 border-t border-slate-100 px-5 py-4">
        {rubric.areas.map((area) => {
          const avg = areaAverage(area, report.scores);
          return (
            <li key={area.id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{area.label}</span>
                <span className="tabular-nums">
                  <span className="font-bold">{avg.toFixed(1)}</span>
                  <span className="text-slate-400"> / {SCORE_MAX}</span>
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${TONE_CLASS[toneFor5(avg)].bg}`}
                  style={{ width: `${(avg / SCORE_MAX) * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
