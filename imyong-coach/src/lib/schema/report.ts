import { z } from "zod";

/**
 * AI 분석 리포트 스키마 — 단일 진실 공급원(Single Source of Truth)
 *
 * - 화면(TypeScript 타입)        : z.infer<typeof analysisReportSchema>
 * - Gemini Structured Output     : z.toJSONSchema(analysisReportSchema) → responseJsonSchema (3단계)
 * - 응답 런타임 검증              : analysisReportSchema.parse(json)       (3단계)
 *
 * 한 곳만 고치면 UI·프롬프트·검증이 함께 바뀌도록 설계했습니다.
 */

export const EVAL_MODES = ["interview", "demo"] as const;
export const evalModeSchema = z.enum(EVAL_MODES);
export type EvalMode = z.infer<typeof evalModeSchema>;

/** 루브릭 4개 항목 (각 25점 × 4 = 100점 만점) */
export const RUBRIC_KEYS = ["content", "method", "delivery", "time"] as const;
export const rubricKeySchema = z.enum(RUBRIC_KEYS);
export type RubricKey = z.infer<typeof rubricKeySchema>;
export const RUBRIC_MAX_SCORE = 25;

const timestampSchema = z
  .string()
  .regex(/^\d{1,2}:\d{2}$/)
  .describe("영상 타임스탬프 (MM:SS 형식, 예: 03:25)");

const rubricItemSchema = z.object({
  score: z
    .number()
    .int()
    .min(0)
    .max(RUBRIC_MAX_SCORE)
    .describe(`0~${RUBRIC_MAX_SCORE}점 정수`),
  rationale: z
    .string()
    .describe("점수 근거. 영상 속 구체적 장면과 타임스탬프를 인용"),
});

export const segmentFeedbackSchema = z.object({
  start: timestampSchema,
  end: timestampSchema,
  category: rubricKeySchema.describe("해당 피드백이 속한 루브릭 항목"),
  sentiment: z
    .enum(["strength", "improve", "critical"])
    .describe("strength=잘한 점, improve=개선 권장, critical=반드시 보완"),
  title: z.string().describe("한 줄 요약 (20자 내외)"),
  observation: z.string().describe("영상에서 관찰된 사실"),
  suggestion: z.string().describe("구체적인 개선 방법"),
});
export type SegmentFeedback = z.infer<typeof segmentFeedbackSchema>;

export const alternativeSchema = z.object({
  at: timestampSchema,
  original: z.string().describe("실제 발화한 만능틀·상투적 표현 인용"),
  problem: z.string().describe("만능틀로 판단한 이유"),
  alternative: z
    .string()
    .describe("문제 조건·학생 특성에 맞춘 대체 발문(수업실연) 또는 대체 답변(면접)"),
});
export type Alternative = z.infer<typeof alternativeSchema>;

export const analysisReportSchema = z.object({
  summary: z.string().describe("총평 2~3문장"),
  rubric: z.object({
    content: rubricItemSchema,
    method: rubricItemSchema,
    delivery: rubricItemSchema,
    time: rubricItemSchema,
  }),
  segments: z.array(segmentFeedbackSchema).describe("시간순 구간별 피드백"),
  alternatives: z.array(alternativeSchema).describe("만능틀 탈피 대체 제안"),
});
export type AnalysisReport = z.infer<typeof analysisReportSchema>;

/** 종합 점수(100점 환산)는 모델의 산수에 맡기지 않고 코드에서 계산합니다. */
export function computeOverallScore(report: AnalysisReport): number {
  const total = RUBRIC_KEYS.reduce((sum, key) => sum + report.rubric[key].score, 0);
  return Math.round((total / (RUBRIC_MAX_SCORE * RUBRIC_KEYS.length)) * 100);
}
