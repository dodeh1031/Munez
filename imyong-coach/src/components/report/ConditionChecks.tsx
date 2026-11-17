import { ListChecks } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { TimestampButton } from "@/components/report/TimestampButton";
import { CONDITION_STATUS_META } from "@/lib/constants";
import type { ConditionCheck } from "@/lib/schema/report";

export function ConditionChecks({ checks }: { checks: ConditionCheck[] }) {
  const met = checks.filter((c) => c.status === "met").length;
  return (
    <Card>
      <CardHeader
        icon={ListChecks}
        title="수업 조건 반영"
        description={
          checks.length > 0
            ? `제시된 조건 ${checks.length}개 중 ${met}개 충족`
            : "입력한 수업 조건이 없어 조건별 점검을 하지 않았습니다."
        }
      />
      {checks.length > 0 && (
        <ol className="divide-y divide-slate-100">
          {checks.map((check, i) => {
            const meta = CONDITION_STATUS_META[check.status];
            return (
              <li key={i} className="flex gap-3 px-5 py-3.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{check.condition}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${meta.className}`}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-start gap-2">
                    <TimestampButton start={check.at} />
                    <p className="min-w-0 flex-1 text-sm leading-relaxed text-slate-600">{check.evidence}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
