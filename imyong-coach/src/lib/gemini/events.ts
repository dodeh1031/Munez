import { z } from "zod";
import { evalModeSchema, type AnalysisReport } from "@/lib/schema/report";
import { timeLimitsSchema } from "@/lib/timeLimits";

/**
 * 브라우저 ↔ API 라우트 사이의 스트리밍(NDJSON) 이벤트 타입.
 * 한 줄에 JSON 객체 하나씩 보내 진행 상황을 실시간으로 전달합니다.
 */

export type GeminiErrorCode =
  | "NO_API_KEY"
  | "INVALID_KEY"
  | "MODEL_NOT_FOUND"
  | "RATE_LIMIT"
  | "SERVER_BUSY"
  | "FILE_EXPIRED"
  | "UPLOAD_FAILED"
  | "BAD_REQUEST"
  | "BAD_RESPONSE"
  | "TRUNCATED"
  | "BLOCKED"
  | "UNKNOWN";

export interface UploadedFileInfo {
  /** files/xxxx */
  name: string;
  uri: string;
  mimeType: string;
  /** ISO 시각. Gemini Files API는 업로드 후 일정 시간(약 48시간) 뒤 자동 삭제 */
  expiresAt: string | null;
}

export interface TokenUsage {
  prompt: number | null;
  output: number | null;
  thoughts: number | null;
  total: number | null;
}

export interface AnalysisMeta {
  model: string;
  mock: boolean;
  elapsedMs: number;
  usage: TokenUsage | null;
  /** 스키마 강제가 거부되어 프롬프트 지시만으로 JSON을 받은 경우 */
  schemaFallback: boolean;
}

export type ErrorEvent = { type: "error"; code: GeminiErrorCode; message: string };
/** progress: 0~1 (알 수 있을 때만) */
export type StatusEvent = { type: "status"; message: string; progress?: number };

export type UploadEvent = StatusEvent | ErrorEvent | { type: "done"; file: UploadedFileInfo };

export type AnalyzeEvent =
  | StatusEvent
  | ErrorEvent
  | { type: "progress"; chars: number }
  | { type: "done"; report: AnalysisReport; meta: AnalysisMeta };

/* ───────────── 분석 요청 본문 (브라우저가 만들고 서버가 검증) ───────────── */

export const analyzePayloadSchema = z.object({
  mode: evalModeSchema,
  promptText: z.string().max(20000),
  durationSec: z.number().positive().nullable(),
  timeLimits: timeLimitsSchema.nullable(),
  file: z.object({ uri: z.string().min(1), mimeType: z.string().min(1) }),
});
export type AnalyzePayload = z.infer<typeof analyzePayloadSchema>;
