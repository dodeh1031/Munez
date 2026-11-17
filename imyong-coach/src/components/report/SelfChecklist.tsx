import clsx from "clsx";
import { CircleCheck, CircleMinus, CircleX, SquareCheckBig } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { TimestampButton } from "@/components/report/TimestampButton";
import { CHECK_STATUS_META } from "@/lib/constants";
import { INTERVIEW_CHECKLIST } from "@/lib/rubrics/interview";
import type { ChecklistResult } from "@/lib/schema/report";

const ICON = { pass: CircleCheck, fail: CircleX, na: CircleMinus } as const;

export function SelfChecklist({ checklist }: { checklist: Record<string, ChecklistResult> }) {
  const all = Object.values(checklist);
  const count = (s: ChecklistResult["status"]) => all.filter((r) => r.status === s).length;

  return (
    <Card>
      <CardHeader
        icon={SquareCheckBig}
        title="자기점검표"
        description={`지킴 ${count("pass")} · 보완 필요 ${count("fail")} · 영상에서 확인 불가 ${count("na")}`}
      />
      <div className="divide-y divide-slate-100">
        {INTERVIEW_CHECKLIST.map((group) => {
          const results = group.items.map((item) => ({ item, result: checklist[item.id] }));
          const allNa = results.every(({ result }) => !result || result.status === "na");
          return (
            <details key={group.id} open={!allNa} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 bg-slate-50/70 px-5 py-2.5 text-sm font-semibold">
                {group.label}
                {allNa && <span className="text-xs font-normal text-slate-400">영상에 해당 장면 없음</span>}
                <span className="ml-auto text-slate-400 transition-transform group-open:rotate-90" aria-hidden>
                  ›
                </span>
              </summary>
              <ul className="divide-y divide-slate-50">
                {results.map(({ item, result }) => {
                  const status = result?.status ?? "na";
                  const Icon = ICON[status];
                  const meta = CHECK_STATUS_META[status];
                  return (
                    <li key={item.id} className="flex items-start gap-2.5 px-5 py-2.5">
                      <Icon className={clsx("mt-0.5 size-4 shrink-0", meta.className)} aria-label={meta.label} />
                      <div className="min-w-0 flex-1">
                        <p className={clsx("text-sm", status === "na" ? "text-slate-400" : "text-slate-800")}>
                          {item.label}
                        </p>
                        {result?.note && <p className="mt-0.5 text-xs text-slate-500">{result.note}</p>}
                      </div>
                      {result && <TimestampButton start={result.at} />}
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </div>
    </Card>
  );
}
