import { Gauge } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { RUBRIC_META } from "@/lib/constants";
import {
  RUBRIC_KEYS,
  RUBRIC_MAX_SCORE,
  computeOverallScore,
  type AnalysisReport,
  type EvalMode,
} from "@/lib/schema/report";

function grade(score: number) {
  if (score >= 90) return { label: "매우 우수", color: "text-emerald-600", stroke: "stroke-emerald-500" };
  if (score >= 80) return { label: "우수", color: "text-indigo-600", stroke: "stroke-indigo-500" };
  if (score >= 70) return { label: "보통", color: "text-sky-600", stroke: "stroke-sky-500" };
  if (score >= 60) return { label: "노력 필요", color: "text-amber-600", stroke: "stroke-amber-500" };
  return { label: "많은 보완 필요", color: "text-rose-600", stroke: "stroke-rose-500" };
}

function barColor(ratio: number) {
  if (ratio >= 0.8) return "bg-emerald-500";
  if (ratio >= 0.64) return "bg-indigo-500";
  return "bg-amber-500";
}

export function ScoreOverview({ report, mode }: { report: AnalysisReport; mode: EvalMode }) {
  const overall = computeOverallScore(report);
  const g = grade(overall);
  const r = 52;
  const circumference = 2 * Math.PI * r;

  return (
    <Card>
      <CardHeader icon={Gauge} title="종합 평가" description={`4개 항목 × ${RUBRIC_MAX_SCORE}점 = 100점 환산`} />
      <div className="grid items-center gap-5 p-5 sm:grid-cols-[auto_1fr]">
        <div className="relative mx-auto size-36" role="img" aria-label={`종합 점수 ${overall}점, ${g.label}`}>
          <svg viewBox="0 0 120 120" className="size-full -rotate-90">
            <circle cx="60" cy="60" r={r} className="fill-none stroke-slate-100" strokeWidth="10" />
            <circle
              cx="60"
              cy="60"
              r={r}
              className={`fill-none ${g.stroke}`}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - overall / 100)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold tabular-nums tracking-tight">{overall}</span>
            <span className={`text-sm font-semibold ${g.color}`}>{g.label}</span>
          </div>
        </div>
        <p className="leading-relaxed text-slate-700">{report.summary}</p>
      </div>

      <ul className="divide-y divide-slate-100 border-t border-slate-100">
        {RUBRIC_KEYS.map((key) => {
          const item = report.rubric[key];
          const ratio = item.score / RUBRIC_MAX_SCORE;
          return (
            <li key={key} className="px-5 py-4">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-medium">{RUBRIC_META[key].label}</h3>
                  <p className="text-xs text-slate-500">{RUBRIC_META[key].description[mode]}</p>
                </div>
                <span className="shrink-0 tabular-nums">
                  <span className="text-lg font-bold">{item.score}</span>
                  <span className="text-sm text-slate-400"> / {RUBRIC_MAX_SCORE}</span>
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${barColor(ratio)}`} style={{ width: `${ratio * 100}%` }} />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.rationale}</p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
