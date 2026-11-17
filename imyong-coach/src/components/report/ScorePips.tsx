import clsx from "clsx";
import { SCORE_MAX, TONE_CLASS, toneFor5 } from "@/lib/rubrics";

/** 1~5점을 점 5개로 표시 (채점기준표의 1·2·3·4·5 칸) */
export function ScorePips({ score, size = "md" }: { score: number; size?: "sm" | "md" }) {
  const tone = TONE_CLASS[toneFor5(score)];
  return (
    <span className="inline-flex items-center gap-1.5" role="img" aria-label={`${SCORE_MAX}점 만점에 ${score}점`}>
      <span className="flex gap-0.5">
        {Array.from({ length: SCORE_MAX }, (_, i) => (
          <span
            key={i}
            className={clsx(
              "rounded-full",
              size === "sm" ? "size-1.5" : "size-2",
              i < score ? tone.bg : "bg-slate-200",
            )}
          />
        ))}
      </span>
      <span className={clsx("font-semibold tabular-nums", size === "sm" ? "text-xs" : "text-sm", tone.text)}>
        {score}
      </span>
    </span>
  );
}
