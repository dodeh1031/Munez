import type { TokenUsage } from "@/lib/gemini/events";

/**
 * 화면에서 고를 수 있는 분석 모델 (브라우저·서버 공용)
 * 새 모델이 나오면 이 목록만 고치면 됩니다. (.env.local의 GEMINI_MODEL도 항상 선택지에 포함)
 */
export interface ModelOption {
  id: string;
  label: string;
  badge: string;
  description: string;
  /** 토큰 100만 개당 가격(USD, 유료 등급). 예상 비용 표시에만 씀 — 가격이 바뀌면 여기만 고치세요 */
  pricing?: { input: number; output: number };
}

/** pricing 값의 기준 시점 (화면 안내용) */
export const PRICING_AS_OF = "2026년 11월";

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "gemini-4-hydrogen",
    label: "Hydrogen",
    badge: "평소 연습",
    description: "저렴하고 근거를 지어낼 확률이 낮은 편",
    pricing: { input: 1.5, output: 7.5 },
  },
  {
    id: "gemini-4-neon",
    label: "Neon",
    badge: "정밀 점검",
    description: "더 깊이 분석 · Hydrogen보다 비용 약 2배",
    pricing: { input: 3, output: 15 },
  },
];

/** 모델 id → 화면 표시 이름 (목록에 없으면 id 그대로) */
export function modelLabel(id: string | null | undefined): string {
  if (!id) return "";
  return MODEL_OPTIONS.find((m) => m.id === id)?.label ?? id;
}

/**
 * 분석 1회 예상 비용(USD). 가격을 모르는 모델이거나 토큰 정보가 없으면 null
 * 추론(thinking) 토큰은 출력 가격으로 계산합니다. 실제 청구액은 Google AI Studio에서 확인하세요.
 */
export function estimateCostUsd(model: string | null | undefined, usage: TokenUsage | null | undefined): number | null {
  const price = MODEL_OPTIONS.find((m) => m.id === model)?.pricing;
  if (!price || !usage || usage.prompt === null) return null;
  const output = (usage.output ?? 0) + (usage.thoughts ?? 0);
  return (usage.prompt * price.input + output * price.output) / 1_000_000;
}

export function formatUsd(value: number): string {
  return value < 0.01 ? "$0.01 미만" : "$" + value.toFixed(2);
}

export const COST_NOTE =
  PRICING_AS_OF +
  " 공개 가격(유료 등급)으로 계산한 참고값이에요. 무료 등급이면 청구되지 않고, 실제 청구액은 Google AI Studio에서 확인하세요.";
