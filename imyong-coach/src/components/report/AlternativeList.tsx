import { ArrowDown, Quote, WandSparkles } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { TimestampButton } from "@/components/report/TimestampButton";
import { MODE_META } from "@/lib/constants";
import type { Alternative, EvalMode } from "@/lib/schema/report";

export function AlternativeList({ alternatives, mode }: { alternatives: Alternative[]; mode: EvalMode }) {
  const altLabel = MODE_META[mode].alternativeLabel;
  return (
    <Card>
      <CardHeader
        icon={WandSparkles}
        title="만능틀 탈피 제안"
        description={`상투적인 표현을 문제 조건과 학생 특성에 맞춘 ${altLabel}으로 바꿔 보세요.`}
      />
      <ul className="grid gap-4 p-5">
        {alternatives.map((alt, i) => (
          <li key={`${alt.at}-${i}`} className="rounded-xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-400">제안 {i + 1}</span>
              <TimestampButton start={alt.at} />
            </div>
            <div className="rounded-lg bg-rose-50 px-3.5 py-2.5">
              <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-rose-600">
                <Quote className="size-3" aria-hidden /> 기존 표현
              </p>
              <p className="text-sm text-rose-900">“{alt.original}”</p>
            </div>
            <div className="flex justify-center py-1.5 text-slate-300">
              <ArrowDown className="size-4" aria-hidden />
            </div>
            <div className="rounded-lg bg-emerald-50 px-3.5 py-2.5">
              <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-emerald-700">
                <WandSparkles className="size-3" aria-hidden /> {altLabel}
              </p>
              <p className="text-sm font-medium text-emerald-950">“{alt.alternative}”</p>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              <span className="font-medium text-slate-700">왜 바꿔야 할까요? </span>
              {alt.problem}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
