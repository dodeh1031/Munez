import { z } from "zod";
import { areaAverage, overallScore, type Rubric } from "@/lib/rubrics";
import { evalModeSchema, type RubricScores } from "@/lib/schema/report";

/** 자기 채점: AI와 같은 채점표(세부 기준 1~5점)로 스스로 매긴 점수 */
export const selfScoreSchema = z.object({
  mode: evalModeSchema,
  scores: z.record(z.string(), z.record(z.string(), z.number().int().min(1).max(5))),
  memo: z.string().catch(""),
  savedAt: z.string(),
});
export type SelfScore = z.infer<typeof selfScoreSchema>;
export type SelfScoreMap = SelfScore["scores"];

/** 채점표 계산 함수(영역 평균·100점 환산)를 그대로 쓰기 위한 형태 변환 */
export function toRubricScores(scores: SelfScoreMap): RubricScores {
  return Object.fromEntries(
    Object.entries(scores).map(([area, crits]) => [
      area,
      Object.fromEntries(Object.entries(crits).map(([id, score]) => [id, { score, evidence: "", at: "" }])),
    ]),
  );
}

export function countScored(rubric: Rubric, scores: SelfScoreMap): { done: number; total: number } {
  const total = rubric.areas.reduce((n, a) => n + a.criteria.length, 0);
  const done = rubric.areas.reduce((n, a) => n + a.criteria.filter((c) => scores[a.id]?.[c.id]).length, 0);
  return { done, total };
}

export interface CriterionGap {
  areaId: string;
  areaLabel: string;
  criterionId: string;
  label: string;
  mine: number;
  ai: number;
  /** 내 점수 − AI 점수 (양수 = 내가 더 후하게 봄) */
  diff: number;
}

export function compareWithAi(rubric: Rubric, self: SelfScore, ai: RubricScores) {
  const mineScores = toRubricScores(self.scores);
  const rows: CriterionGap[] = rubric.areas.flatMap((area) =>
    area.criteria.flatMap((c) => {
      const mine = self.scores[area.id]?.[c.id];
      const aiScore = ai[area.id]?.[c.id]?.score;
      if (!mine || !aiScore) return [];
      return [{ areaId: area.id, areaLabel: area.label, criterionId: c.id, label: c.label, mine, ai: aiScore, diff: mine - aiScore }];
    }),
  );
  return {
    rows,
    areas: rubric.areas.map((area) => ({
      id: area.id,
      label: area.label,
      mine: areaAverage(area, mineScores),
      ai: areaAverage(area, ai),
    })),
    mineOverall: overallScore(rubric, mineScores),
    aiOverall: overallScore(rubric, ai),
    higher: rows.filter((r) => r.diff >= 1).sort((a, b) => b.diff - a.diff).slice(0, 3),
    lower: rows.filter((r) => r.diff <= -1).sort((a, b) => a.diff - b.diff).slice(0, 3),
  };
}

export function selfOverall(rubric: Rubric, self: SelfScore): number {
  return overallScore(rubric, toRubricScores(self.scores));
}
