import "server-only";
import { GoogleGenAI, MediaResolution, ThinkingLevel } from "@google/genai";
import { MODEL_OPTIONS } from "@/lib/models";

const RESOLUTIONS: Record<string, MediaResolution> = {
  low: MediaResolution.MEDIA_RESOLUTION_LOW,
  medium: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
  high: MediaResolution.MEDIA_RESOLUTION_HIGH,
};

const THINKING_LEVELS: Record<string, ThinkingLevel> = {
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
  xhigh: ThinkingLevel.XHIGH,
};

/**
 * 기본 모델 — Gemini 4 Hydrogen (평소 연습용: 저렴, 근거를 지어낼 확률이 낮은 편)
 * 화면에서 분석마다 Neon 등으로 바꿀 수 있음. gemini-4-argon·gemini-2.5-pro는 목록에서 빠지거나 종료 중
 */
export const DEFAULT_MODEL = "gemini-4-hydrogen";

/** .env.local 설정값 (서버에서만 읽음 — API 키는 브라우저로 절대 전달되지 않음) */
export function getGeminiConfig() {
  const resolutionKey = (process.env.GEMINI_MEDIA_RESOLUTION ?? "low").trim().toLowerCase();
  return {
    apiKey: process.env.GEMINI_API_KEY?.trim() || null,
    model: process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL,
    /** 추론 깊이 (Gemini 3·4 계열): low | medium | high | xhigh. 비우면 모델 기본값 (Neon은 high) */
    thinkingLevel: THINKING_LEVELS[(process.env.GEMINI_THINKING_LEVEL ?? "").trim().toLowerCase()] ?? null,
    /** 영상 프레임당 토큰: low ≈ 64, medium ≈ 256. 15분 영상 기준 low가 토큰을 약 1/3로 줄임 */
    mediaResolution: RESOLUTIONS[resolutionKey] ?? MediaResolution.MEDIA_RESOLUTION_LOW,
    mediaResolutionLabel: RESOLUTIONS[resolutionKey] ? resolutionKey : "low",
    /** GEMINI_MOCK=1 : API 호출 없이 샘플 리포트로 화면 흐름만 테스트 */
    mock: process.env.GEMINI_MOCK === "1",
    /** (선택) 프록시·테스트 서버 주소. 비우면 Google 기본 주소 사용 */
    baseUrl: process.env.GEMINI_BASE_URL?.trim() || null,
  };
}

export type GeminiConfig = ReturnType<typeof getGeminiConfig>;

/** 화면에서 고른 모델이 허용 목록(또는 .env.local 모델)에 있으면 그 모델, 아니면 기본 모델 */
export function resolveModel(config: GeminiConfig, requested: string | null | undefined): string {
  if (requested && (requested === config.model || MODEL_OPTIONS.some((m) => m.id === requested))) return requested;
  return config.model;
}

export function createGeminiClient(config: GeminiConfig & { apiKey: string }) {
  return new GoogleGenAI({
    apiKey: config.apiKey,
    ...(config.baseUrl ? { httpOptions: { baseUrl: config.baseUrl } } : {}),
  });
}
