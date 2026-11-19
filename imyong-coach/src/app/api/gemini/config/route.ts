import { connection } from "next/server";
import type { GeminiClientConfig } from "@/lib/gemini/events";
import { getGeminiConfig } from "@/lib/gemini/server/config";
import { MODEL_OPTIONS } from "@/lib/models";

/**
 * GET /api/gemini/config — 입력 화면에 보여 줄 설정 (기본 모델, 고를 수 있는 모델, API 키 설정 여부)
 * API 키 값 자체는 절대 보내지 않습니다.
 */
export async function GET() {
  // 빌드 시점이 아니라 요청 시점의 .env.local 값을 읽도록 (Cache Components는 GET을 미리 렌더링할 수 있음)
  await connection();
  const config = getGeminiConfig();
  const options = MODEL_OPTIONS.some((m) => m.id === config.model)
    ? MODEL_OPTIONS
    : [
        ...MODEL_OPTIONS,
        { id: config.model, label: config.model, badge: ".env.local 설정", description: "GEMINI_MODEL에 적어 둔 모델" },
      ];
  const body: GeminiClientConfig = {
    defaultModel: config.model,
    hasApiKey: Boolean(config.apiKey),
    mock: config.mock,
    options,
  };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
