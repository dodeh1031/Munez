import type { EvalMode, RubricKey } from "@/lib/schema/report";

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
    description: "질문 의도 파악, 답변의 논리·구체성, 시선과 발성을 분석합니다.",
    promptPlaceholder:
      "예) [구상형 1번] 통합학급 담임교사가 특수교육대상학생의 문제행동 때문에 협력을 꺼립니다. 특수교사로서 협력을 이끌어 낼 방안을 2가지 말하시오.",
    alternativeLabel: "대체 답변",
  },
  demo: {
    label: "수업실연",
    sublabel: "수업조건 반영",
    description: "수업조건 반영, 발문·활동 구성, 판서·동선, 단계별 시간 배분을 분석합니다.",
    promptPlaceholder:
      "예) 기본교육과정 국어, 초등 3~4학년군 / 학습목표: 상황에 맞는 인사말을 할 수 있다.\n[조건] ① AAC를 활용할 것 ② 모둠 활동을 포함할 것 ③ 행동지원 전략을 1가지 이상 제시할 것",
    alternativeLabel: "대체 발문",
  },
};

export const RUBRIC_META: Record<RubricKey, { label: string; description: Record<EvalMode, string> }> = {
  content: {
    label: "내용 충실성",
    description: {
      interview: "질문 의도 파악, 교육관·전문성의 깊이, 근거의 타당성",
      demo: "수업조건·성취기준 반영, 내용의 정확성",
    },
  },
  method: {
    label: "교수·학습 방법 구체성",
    description: {
      interview: "실천 방안의 구체성과 현장 적용 가능성",
      demo: "발문·활동·개별화 전략의 구체성",
    },
  },
  delivery: {
    label: "시선 · 태도 · 발성",
    description: {
      interview: "면접관 응시, 자세, 목소리 크기·속도, 자신감",
      demo: "가상 학생 응시, 동선·판서, 발성·억양",
    },
  },
  time: {
    label: "시간 관리",
    description: {
      interview: "문항별 시간 배분, 답변 길이의 적절성",
      demo: "도입–전개–정리 단계별 시간 배분",
    },
  },
};

export const SENTIMENT_META = {
  strength: { label: "잘한 점", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  improve: { label: "개선 권장", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  critical: { label: "반드시 보완", className: "bg-rose-50 text-rose-700 ring-rose-200" },
} as const;
