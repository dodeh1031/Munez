"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { CircleCheck, FileText, Sparkles, Timer, Video } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { ModeToggle } from "@/components/input/ModeToggle";
import { PromptInput } from "@/components/input/PromptInput";
import { TimeLimitInput } from "@/components/input/TimeLimitInput";
import { VideoInput } from "@/components/input/VideoInput";
import { MODE_META } from "@/lib/constants";
import { isSameAsLastAnalysis, startAnalysis } from "@/lib/pipeline";
import { hasLimits, limitsForMode, sameLimits } from "@/lib/timeLimits";
import { useSessionStore } from "@/lib/store";

export function AnalysisInputForm() {
  const router = useRouter();
  const mode = useSessionStore((s) => s.mode);
  const hasPrompt = useSessionStore((s) => s.promptText.trim().length > 0 || s.promptImage !== null);
  const hasVideo = useSessionStore((s) => s.video !== null);
  const hasTime = useSessionStore((s) => hasLimits(limitsForMode(s.timeLimits, s.mode)));
  const running = useSessionStore((s) => s.pipeline.status === "running");
  // 마지막 분석과 입력(모드·문제·영상)이 같으면 다시 분석하지 않고 리포트로 이동 (불필요한 API 비용 방지)
  const unchanged = useSessionStore(
    (s) =>
      Boolean(s.report && s.analyzedInput && s.processed) &&
      s.analyzedInput?.processedFile === s.processed?.file &&
      s.analyzedInput?.mode === s.mode &&
      s.analyzedInput?.promptText === s.promptText &&
      s.analyzedInput?.image === (s.promptImage?.file ?? null) &&
      sameLimits(s.analyzedInput?.timeLimits, limitsForMode(s.timeLimits, s.mode)),
  );

  function handleStart() {
    if (!isSameAsLastAnalysis()) startAnalysis(); // 이미 실행 중이면 무시됨
    router.push("/report");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader step={1} title="평가 모드" description="연습한 시험 유형을 고르면 분석 기준이 달라집니다." />
        <div className="p-5">
          <ModeToggle />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            step={2}
            title={mode === "demo" ? "수업 조건 입력" : "면접 문항 입력"}
            description="기출문제나 연습 문항, 문제지 사진, 시간 조건을 넣으세요."
          />
          <div className="space-y-5 p-5">
            <PromptInput />
            <div className="border-t border-slate-100 pt-4">
              <TimeLimitInput />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader step={3} title="연습 영상" description="파일을 올리거나 웹캠으로 바로 녹화하세요." />
          <div className="p-5">
            <VideoInput />
          </div>
        </Card>
      </div>

      <div className="sticky bottom-4 z-20">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Check done label={`${MODE_META[mode].label} 모드`} icon={Sparkles} />
            <Check done={hasPrompt} label={hasPrompt ? "문제 입력됨" : "문제 (선택)"} icon={FileText} optional />
            <Check done={hasTime} label={hasTime ? "시간 조건 입력됨" : "시간 조건 (선택)"} icon={Timer} optional />
            <Check done={hasVideo} label={hasVideo ? "영상 준비됨" : "영상 필요"} icon={Video} />
          </ul>
          <div className="flex items-center gap-2">
            <Link
              href="/report"
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              샘플 리포트 보기
            </Link>
            <button
              type="button"
              onClick={handleStart}
              disabled={!hasVideo}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Sparkles className={clsx("size-4", running && "animate-pulse")} aria-hidden />
              {running ? "진행 상황 보기" : unchanged ? "리포트 보기" : "AI 분석 시작"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Check({
  done,
  label,
  icon: Icon,
  optional,
}: {
  done: boolean;
  label: string;
  icon: typeof Sparkles;
  optional?: boolean;
}) {
  return (
    <li className={clsx("flex items-center gap-1.5", done ? "text-slate-700" : "text-slate-400")}>
      {done ? (
        <CircleCheck className="size-4 text-emerald-500" aria-hidden />
      ) : (
        <Icon className={clsx("size-4", !optional && "text-amber-500")} aria-hidden />
      )}
      {label}
    </li>
  );
}
