import type { EvalMode, RubricScores } from "@/lib/schema/report";
import { DEMO_RUBRIC } from "@/lib/rubrics/demo";
import { INTERVIEW_RUBRIC } from "@/lib/rubrics/interview";
import { SCORE_MAX, type Rubric, type RubricArea } from "@/lib/rubrics/types";

export * from "@/lib/rubrics/types";

const RUBRICS: Record<EvalMode, Rubric> = {
  demo: DEMO_RUBRIC,
  interview: INTERVIEW_RUBRIC,
};

export function getRubric(mode: EvalMode): Rubric {
  return RUBRICS[mode];
}

/** 영역 점수 = 세부 기준 점수의 평균 (1~5) */
export function areaAverage(area: RubricArea, scores: RubricScores): number {
  const values = area.criteria
    .map((c) => scores[area.id]?.[c.id]?.score)
    .filter((v): v is number => typeof v === "number");
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * 종합 점수(100점 환산) = 영역 점수 평균 ÷ 5 × 100
 * 채점기준표처럼 영역마다 같은 비중(1~5점)으로 계산하며, 모델의 산수에 맡기지 않습니다.
 */
export function overallScore(rubric: Rubric, scores: RubricScores): number {
  const avgs = rubric.areas.map((area) => areaAverage(area, scores));
  const mean = avgs.reduce((a, b) => a + b, 0) / avgs.length;
  return Math.round((mean / SCORE_MAX) * 100);
}

export type Tone = "excellent" | "good" | "fair" | "weak" | "poor";

export function toneFor100(score: number): { label: string; tone: Tone } {
  if (score >= 90) return { label: "매우 우수", tone: "excellent" };
  if (score >= 75) return { label: "우수", tone: "good" };
  if (score >= 60) return { label: "보통", tone: "fair" };
  if (score >= 45) return { label: "미흡", tone: "weak" };
  return { label: "매우 미흡", tone: "poor" };
}

/** 1~5점 → 색 톤 */
export function toneFor5(score: number): Tone {
  return toneFor100((score / SCORE_MAX) * 100).tone;
}

export const TONE_CLASS: Record<Tone, { text: string; bg: string; stroke: string }> = {
  excellent: { text: "text-emerald-600", bg: "bg-emerald-500", stroke: "stroke-emerald-500" },
  good: { text: "text-indigo-600", bg: "bg-indigo-500", stroke: "stroke-indigo-500" },
  fair: { text: "text-sky-600", bg: "bg-sky-500", stroke: "stroke-sky-500" },
  weak: { text: "text-amber-600", bg: "bg-amber-500", stroke: "stroke-amber-500" },
  poor: { text: "text-rose-600", bg: "bg-rose-500", stroke: "stroke-rose-500" },
};
