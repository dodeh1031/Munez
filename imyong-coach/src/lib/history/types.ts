import { z } from "zod";
import type { AnalysisMeta } from "@/lib/gemini/events";
import { selfScoreSchema, type SelfScore } from "@/lib/selfScore";
import { timeLimitsSchema, type TimeLimits } from "@/lib/timeLimits";
import {
  demoReportSchema,
  evalModeSchema,
  interviewReportSchema,
  type AnalysisReport,
  type EvalMode,
} from "@/lib/schema/report";

/**
 * 분석 기록 1회분.
 * 브라우저 IndexedDB에 저장되며(컴퓨터마다 따로), JSON 백업 파일로 다른 컴퓨터에 옮길 수 있습니다.
 * 분석용 압축 영상은 별도 저장소(videos)에 같은 id로 저장합니다.
 */
export interface HistoryRecord {
  id: string;
  version: 1;
  /** 분석 완료 시각 (ISO) */
  createdAt: string;
  /** 마지막으로 내용을 고친 시각 (ISO, 자기 채점 등). 없으면 createdAt — 컴퓨터끼리 합칠 때 더 최근 것을 남기는 기준 */
  updatedAt?: string;
  mode: EvalMode;
  /** 원본 영상 파일 이름 */
  title: string;
  promptText: string;
  durationSec: number | null;
  /** 분석에 쓴 시간 조건 (예전 기록에는 없을 수 있음) */
  timeLimits?: TimeLimits | null;
  report: AnalysisReport;
  meta: AnalysisMeta | null;
  /** 자기 채점 (하지 않았으면 없음) */
  selfScore?: SelfScore | null;
  /** 분석용 압축 영상이 이 브라우저에 저장되어 있는지 */
  hasVideo: boolean;
  source: "local" | "imported";
}

const reportSchema = z.union([demoReportSchema, interviewReportSchema]);

/** 불러오기 검증용 (영상은 백업 파일에 포함되지 않음) */
export const historyRecordSchema = z
  .object({
    id: z.string().min(1),
    version: z.literal(1).catch(1),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1).optional().catch(undefined),
    mode: evalModeSchema,
    title: z.string().catch("이름 없는 영상"),
    promptText: z.string().catch(""),
    durationSec: z.number().nullable().catch(null),
    timeLimits: timeLimitsSchema.nullable().optional().catch(null),
    report: reportSchema,
    meta: z.any().nullable().catch(null),
    selfScore: selfScoreSchema.nullable().optional().catch(null),
  })
  .refine((r) => r.report.mode === r.mode, { message: "mode와 report.mode가 다릅니다" });

export const HISTORY_FILE_APP = "imyong-coach";

/** 삭제 표시: 다른 컴퓨터와 동기화할 때 지운 기록이 되살아나지 않도록 남겨 둠 */
export interface Tombstone {
  id: string;
  /** 지운 시각 (ISO) */
  deletedAt: string;
}

export const tombstoneSchema = z.object({ id: z.string().min(1), deletedAt: z.string().min(1) });

export const historyFileSchema = z.object({
  app: z.literal(HISTORY_FILE_APP),
  kind: z.literal("history"),
  version: z.literal(1),
  exportedAt: z.string(),
  records: z.array(z.unknown()),
  /** 폴더 동기화 파일에만 있음 */
  deleted: z.array(z.unknown()).optional(),
});

/** 3단계에서 만든 '리포트 저장' 파일 형식 (하위 호환용) */
export const legacyReportFileSchema = z.object({
  savedAt: z.string(),
  video: z.string().nullable().optional(),
  promptText: z.string().optional(),
  meta: z.any().optional(),
  report: reportSchema,
});
