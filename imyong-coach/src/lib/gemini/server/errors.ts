import "server-only";
import { ApiError } from "@google/genai";
import type { GeminiErrorCode } from "@/lib/gemini/events";

export class GeminiError extends Error {
  constructor(
    public code: GeminiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Gemini/SDK 오류를 사용자가 바로 조치할 수 있는 한국어 메시지로 바꿉니다.
 * context: 업로드 중 오류인지, 분석 중 오류인지 (같은 404라도 의미가 다름)
 */
export function toGeminiError(err: unknown, model: string, context: "upload" | "analyze"): GeminiError {
  if (err instanceof GeminiError) return err;
  const raw = err instanceof Error ? err.message : String(err);
  const status = err instanceof ApiError ? err.status : undefined;
  const text = raw.toLowerCase();

  if (text.includes("api key not valid") || text.includes("api_key_invalid") || status === 401) {
    return new GeminiError("INVALID_KEY", "Gemini API 키가 올바르지 않습니다. .env.local의 GEMINI_API_KEY를 확인하세요.");
  }
  if (status === 429 || text.includes("resource_exhausted") || text.includes("quota")) {
    return new GeminiError(
      "RATE_LIMIT",
      "Gemini 사용 한도를 초과했습니다. 잠시 후 다시 시도하거나, 무료 등급이라면 Google AI Studio에서 결제를 연결하세요.",
    );
  }
  if ((status === 404 || status === 400) && (text.includes("models/") || text.includes("is not found for api version") || text.includes("not supported for generatecontent"))) {
    return new GeminiError(
      "MODEL_NOT_FOUND",
      `모델 '${model}'을(를) 사용할 수 없습니다. 서비스가 종료되었거나 이름이 바뀌었을 수 있으니 .env.local의 GEMINI_MODEL을 최신 Pro 모델로 바꿔 주세요.`,
    );
  }
  if (context === "upload" && status !== undefined && status < 500 && status !== 403) {
    return new GeminiError("UPLOAD_FAILED", `Gemini 업로드에 실패했습니다 (HTTP ${status}). ${raw.slice(0, 200)}`);
  }
  if (context === "analyze" && (status === 403 || status === 404) && (text.includes("file") || text.includes("permission"))) {
    return new GeminiError("FILE_EXPIRED", "업로드한 영상이 만료되었거나 접근할 수 없습니다. 다시 업로드합니다.");
  }
  if (status === 403) {
    return new GeminiError("INVALID_KEY", "이 API 키로는 Gemini API를 사용할 권한이 없습니다. 키의 프로젝트 설정을 확인하세요.");
  }
  if (status !== undefined && status >= 500) {
    return new GeminiError("SERVER_BUSY", "Gemini 서버가 혼잡하거나 일시적인 오류가 발생했습니다. 잠시 후 다시 시도하세요.");
  }
  if (status === 400) {
    return new GeminiError("BAD_REQUEST", `Gemini가 요청을 거부했습니다: ${raw.slice(0, 300)}`);
  }
  if (text.includes("fetch failed") || text.includes("enotfound") || text.includes("econnrefused") || text.includes("network")) {
    return new GeminiError("SERVER_BUSY", "Gemini 서버에 연결하지 못했습니다. 인터넷 연결을 확인하세요.");
  }
  return new GeminiError("UNKNOWN", raw.slice(0, 400) || "알 수 없는 오류가 발생했습니다.");
}

/** 스키마가 너무 복잡하거나 지원하지 않는 기능이 있어 거부된 경우인지 */
export function isSchemaRejection(err: unknown): boolean {
  const status = err instanceof ApiError ? err.status : undefined;
  const text = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return status === 400 && (text.includes("schema") || text.includes("too many states") || text.includes("response_json_schema"));
}
