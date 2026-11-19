import "server-only";
import { GoogleGenAI, MediaResolution, ThinkingLevel } from "@google/genai";

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
 * 기본 모델 — Gemini 4 Neon (2026-11-18 출시, 영상·구조화 출력 지원)
 * gemini-4-argon은 Gemini 앱·AI Studio 추천 목록에서 빠졌고, gemini-2.5-pro는 서비스 종료 중
 */
export const DEFAULT_MODEL = "gemini-4-neon";

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

export function createGeminiClient(config: GeminiConfig & { apiKey: string }) {
  return new GoogleGenAI({
    apiKey: config.apiKey,
    ...(config.baseUrl ? { httpOptions: { baseUrl: config.baseUrl } } : {}),
  });
}
