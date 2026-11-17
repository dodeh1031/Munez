import type { EvalMode } from "@/lib/schema/report";

/**
 * 채점표 = 데이터.
 * 영역(area) → 세부 기준(criterion) 구조로 정의하면
 * 화면(채점표 표), Gemini 응답 스키마, (3단계) 프롬프트가 모두 여기서 만들어집니다.
 * 문구를 고치거나 기준을 추가할 때는 rubrics/*.ts 만 수정하면 됩니다.
 */
export interface RubricCriterion {
  id: string;
  label: string;
  description: string;
}

export interface RubricArea {
  id: string;
  label: string;
  description: string;
  criteria: RubricCriterion[];
}

export interface Rubric {
  mode: EvalMode;
  title: string;
  /** 화면 하단에 표시하는 기준 출처 */
  source: string;
  areas: RubricArea[];
}

/** 세부 기준 5점 척도 (채점기준표의 1~5점) */
export const SCORE_MIN = 1;
export const SCORE_MAX = 5;

export const SCORE_SCALE: { score: number; label: string; description: string }[] = [
  { score: 5, label: "매우 우수", description: "기준을 완전히 충족하고 모범 사례로 삼을 만함" },
  { score: 4, label: "우수", description: "대부분 충족, 사소한 보완만 필요" },
  { score: 3, label: "보통", description: "부분적으로 충족, 구체성·일관성 부족" },
  { score: 2, label: "미흡", description: "시도는 보이나 불충분" },
  { score: 1, label: "매우 미흡", description: "드러나지 않거나 부적절함" },
];
