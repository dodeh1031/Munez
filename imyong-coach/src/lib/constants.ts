import type { EvalMode } from "@/lib/schema/report";

export const MAX_VIDEO_SECONDS = 15 * 60;

export const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
export const ACCEPTED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm"];

export const MODE_META: Record<
  EvalMode,
  { label: string; sublabel: string; description: string; promptPlaceholder: string; alternativeLabel: string }
> = {
  interview: {
    label: "심층면접",
    sublabel: "구상형 · 즉답형",
    description: "공고문 5개 영역과 태도·전달력을 채점하고, 문항별 평가와 자기점검표를 제공합니다.",
    promptPlaceholder:
      "예) [구상형 1번] 통합학급 담임교사가 특수교육대상학생의 문제행동 때문에 협력을 꺼립니다. 특수교사로서 협력을 이끌어 낼 방안을 2가지 말하시오.",
    alternativeLabel: "대체 답변",
  },
  demo: {
    label: "수업실연",
    sublabel: "수업조건 반영",
    description: "교사의 기본 자세·수업 운영 능력·특수교과의 수업 3개 영역과 수업 조건 반영 여부를 채점합니다.",
    promptPlaceholder:
      "예) 기본교육과정 국어, 초등 3~4학년군 / 학습목표: 상황에 맞는 인사말을 할 수 있다.\n[조건] ① AAC를 활용할 것 ② 모둠 활동을 포함할 것 ③ 행동지원 전략을 1가지 이상 제시할 것",
    alternativeLabel: "대체 발문",
  },
};

export const SENTIMENT_META = {
  strength: { label: "잘한 점", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  improve: { label: "개선 권장", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  critical: { label: "반드시 보완", className: "bg-rose-50 text-rose-700 ring-rose-200" },
} as const;

export const CONDITION_STATUS_META = {
  met: { label: "충족", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  partial: { label: "부분 충족", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  missed: { label: "미충족", className: "bg-rose-50 text-rose-700 ring-rose-200" },
} as const;

/** 지난 피드백 반영 판정 */
export const FOLLOW_UP_STATUS_META = {
  improved: { label: "개선됨", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  partly: { label: "일부 개선", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  not_yet: { label: "아직", className: "bg-rose-50 text-rose-700 ring-rose-200" },
  not_observed: { label: "판단 불가", className: "bg-slate-50 text-slate-600 ring-slate-200" },
} as const;

export const CHECK_STATUS_META = {
  pass: { label: "지킴", className: "text-emerald-600" },
  fail: { label: "보완 필요", className: "text-rose-600" },
  na: { label: "확인 불가", className: "text-slate-400" },
} as const;
