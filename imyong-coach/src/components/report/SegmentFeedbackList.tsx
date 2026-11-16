import { Clock, Lightbulb } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { TimestampButton } from "@/components/report/TimestampButton";
import { RUBRIC_META, SENTIMENT_META } from "@/lib/constants";
import type { SegmentFeedback } from "@/lib/schema/report";

export function SegmentFeedbackList({ segments }: { segments: SegmentFeedback[] }) {
  return (
    <Card>
      <CardHeader
        icon={Clock}
        title="구간별 피드백"
        description="타임스탬프를 누르면 왼쪽 영상이 해당 장면으로 이동합니다."
      />
      <ol className="divide-y divide-slate-100">
        {segments.map((seg, i) => {
          const sentiment = SENTIMENT_META[seg.sentiment];
          return (
            <li key={`${seg.start}-${i}`} className="flex flex-col gap-3 px-5 py-4 sm:flex-row">
              <div className="sm:w-36 sm:shrink-0">
                <TimestampButton start={seg.start} end={seg.end} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${sentiment.className}`}>
                    {sentiment.label}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {RUBRIC_META[seg.category].label}
                  </span>
                </div>
                <h3 className="mt-1.5 font-medium">{seg.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{seg.observation}</p>
                <p className="mt-2 flex gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
                  {seg.suggestion}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
