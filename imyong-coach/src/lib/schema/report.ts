import { z } from "zod";
import type { Rubric } from "@/lib/rubrics/types";
import {
  CHECKLIST_ITEM_IDS,
  CONCEPT_CRITERION_IDS,
  QUESTION_FORMAT_IDS,
  QUESTION_TYPE_IDS,
} from "@/lib/rubrics/interview";

/**
 * AI 분석 리포트 스키마
 *
 * - 화면용 TypeScript 타입 : 아래 정적 스키마(demoReportSchema / interviewReportSchema)에서 추론
 * - Gemini Structured Output : buildResponseSchema(rubric) → z.toJSONSchema() → responseJsonSchema (3단계)
 *   채점표(rubrics/*.ts)의 영역·세부 기준을 고정 키로 펼쳐서, 모든 기준이 빠짐없이 채점되도록 강제합니다.
 * - 응답 검증 : buildResponseSchema(rubric).parse(json) 후 mode를 붙여 AnalysisReport로 사용
 */

export const EVAL_MODES = ["interview", "demo"] as const;
export const evalModeSchema = z.enum(EVAL_MODES);
export type EvalMode = z.infer<typeof evalModeSchema>;

/* ───────────── 공통 조각 ───────────── */

const timestamp = z
  .string()
  .regex(/^\d{1,2}:\d{2}$/)
  .describe("영상 타임스탬프 (MM:SS, 예: 03:25)");

const optionalTimestamp = z
  .string()
  .regex(/^(\d{1,2}:\d{2})?$/)
  .describe("근거 장면의 타임스탬프 (MM:SS). 특정 장면이 없으면 빈 문자열");

const score5 = z.number().int().min(1).max(5).describe("1~5점 정수 (5 매우 우수 · 3 보통 · 1 매우 미흡)");

export const criterionScoreSchema = z.object({
  score: score5,
  evidence: z.string().describe("점수 근거. 영상에서 관찰한 구체적 발화·행동"),
  at: optionalTimestamp,
});
export type CriterionScore = z.infer<typeof criterionScoreSchema>;

const sentiment = z
  .enum(["strength", "improve", "critical"])
  .describe("strength=잘한 점, improve=개선 권장, critical=반드시 보완");

const makeSegmentSchema = (area: z.ZodType<string>) =>
  z.object({
    start: timestamp,
    end: timestamp,
    area: area.describe("관련 채점 영역 id"),
    sentiment,
    title: z.string().describe("한 줄 요약 (20자 내외)"),
    observation: z.string().describe("영상에서 관찰된 사실"),
    suggestion: z.string().describe("구체적인 개선 방법"),
  });

export const alternativeSchema = z.object({
  at: timestamp,
  original: z.string().describe("실제 발화한 만능틀·상투적 표현 인용"),
  problem: z.string().describe("만능틀로 판단한 이유"),
  alternative: z.string().describe("문제 조건·학생 특성에 맞춘 대체 발문(수업실연) 또는 대체 답변(면접)"),
});
export type Alternative = z.infer<typeof alternativeSchema>;

const summary = z.string().describe("총평 2~3문장");

/** 발화 기록: 수험생이 말한 내용을 시간순으로 그대로 받아 적은 것 (말하기 지표 계산의 바탕) */
export const transcriptChunkSchema = z.object({
  start: timestamp,
  end: timestamp,
  text: z.string().describe("들리는 그대로 받아 적은 발화 (군말·반복 포함, 요약 금지)"),
});
export type TranscriptChunk = z.infer<typeof transcriptChunkSchema>;
const transcript = z
  .array(transcriptChunkSchema)
  .describe("수험생 발화 전체를 시간순으로 빠짐없이 (한 항목은 한두 문장, 3초 이상 끊기면 새 항목)");

/* 수업실연 전용 */
export const conditionCheckSchema = z.object({
  condition: z.string().describe("문제지에 제시된 수업 조건 원문(요약)"),
  status: z.enum(["met", "partial", "missed"]).describe("met=충족, partial=부분 충족, missed=미충족"),
  at: optionalTimestamp,
  evidence: z.string().describe("판단 근거"),
});
export type ConditionCheck = z.infer<typeof conditionCheckSchema>;

/* 심층면접 전용 */
const questionEvalShape = {
  number: z.number().int().min(1).describe("문항 번호"),
  format: z.enum(QUESTION_FORMAT_IDS).describe("prepared=구상형, instant=즉답형"),
  type: z.enum(QUESTION_TYPE_IDS).describe("문제 유형 (type 1~10)"),
  start: timestamp,
  end: timestamp,
  question: z.string().describe("문항 요지"),
  scores: z.object({
    understanding: score5.describe("개념 이해: 정의·필요성·배경"),
    analysis: score5.describe("문제 분석"),
    solution: score5.describe("해결 방안의 구체성·실현 가능성"),
    commitment: score5.describe("개선 의지·역량"),
  }),
  keywordsCovered: z.array(z.string()).describe("답변에서 언급한 핵심 키워드"),
  keywordsMissed: z.array(z.string()).describe("언급했으면 좋았을 핵심 키워드"),
  feedback: z.string().describe("문항 총평과 보완 방법"),
};
export const questionEvalSchema = z.object(questionEvalShape);
export type QuestionEval = z.infer<typeof questionEvalSchema>;

export const checklistResultSchema = z.object({
  status: z.enum(["pass", "fail", "na"]).describe("pass=지킴, fail=보완 필요, na=영상에서 확인 불가"),
  at: optionalTimestamp,
  note: z.string().describe("관찰 메모. na이면 빈 문자열"),
});
export type ChecklistResult = z.infer<typeof checklistResultSchema>;

// 타입 정합성 확인용 (스키마의 키 목록과 rubrics/interview.ts의 id 목록이 어긋나면 컴파일 에러)
const _conceptKeysCheck: Record<(typeof CONCEPT_CRITERION_IDS)[number], unknown> = questionEvalShape.scores.shape;
void _conceptKeysCheck;

/* ───────────── 화면용 정적 스키마 · 타입 ───────────── */

const rubricScoresSchema = z.record(z.string(), z.record(z.string(), criterionScoreSchema));
/** scores[영역 id][세부 기준 id] */
export type RubricScores = z.infer<typeof rubricScoresSchema>;

const segmentSchema = makeSegmentSchema(z.string());
export type SegmentFeedback = z.infer<typeof segmentSchema>;

const reportBase = {
  summary,
  /** 예전 기록·샘플에는 없을 수 있음 */
  transcript: transcript.optional(),
  scores: rubricScoresSchema,
  segments: z.array(segmentSchema),
  alternatives: z.array(alternativeSchema),
};

export const demoReportSchema = z.object({
  mode: z.literal("demo"),
  ...reportBase,
  conditionChecks: z.array(conditionCheckSchema),
});

export const interviewReportSchema = z.object({
  mode: z.literal("interview"),
  ...reportBase,
  questions: z.array(questionEvalSchema),
  checklist: z.record(z.string(), checklistResultSchema),
});

export type DemoReport = z.infer<typeof demoReportSchema>;
export type InterviewReport = z.infer<typeof interviewReportSchema>;
export type AnalysisReport = DemoReport | InterviewReport;

/* ───────────── Gemini 응답 스키마 (모드별, 고정 키) ───────────── */

function fixedKeys<T extends z.ZodType>(ids: readonly string[], make: (id: string) => T) {
  return z.object(Object.fromEntries(ids.map((id) => [id, make(id)])) as Record<string, T>);
}

/**
 * 채점표로부터 Gemini에 강제할 응답 스키마를 만듭니다. (mode 필드는 코드에서 붙임)
 * 속성 순서 = 생성 순서이므로, 관찰(구간·문항) → 채점 → 제안 → 총평 순으로 배치해
 * 모델이 근거를 먼저 정리한 뒤 점수를 매기도록 유도합니다.
 */
export function buildResponseSchema(rubric: Rubric) {
  const areaIds = rubric.areas.map((a) => a.id) as [string, ...string[]];

  const scores = z.object(
    Object.fromEntries(
      rubric.areas.map((area) => [
        area.id,
        z
          .object(
            Object.fromEntries(
              area.criteria.map((c) => [c.id, criterionScoreSchema.describe(`${c.label}: ${c.description}`)]),
            ),
          )
          .describe(area.label),
      ]),
    ),
  );

  const segments = z.array(makeSegmentSchema(z.enum(areaIds))).describe("시간순 구간별 피드백");
  const alternatives = z.array(alternativeSchema).describe("만능틀 탈피 대체 제안");

  if (rubric.mode === "demo") {
    return z.object({
      transcript,
      segments,
      conditionChecks: z.array(conditionCheckSchema).describe("수업 조건별 반영 여부"),
      scores,
      alternatives,
      summary,
    });
  }

  return z.object({
    transcript,
    segments,
    questions: z.array(questionEvalSchema).describe("영상에 나온 문항별 평가 (시간순)"),
    scores,
    checklist: fixedKeys(CHECKLIST_ITEM_IDS, () => checklistResultSchema).describe("자기점검표"),
    alternatives,
    summary,
  });
}
