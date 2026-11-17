import {
  FinishReason,
  createPartFromBase64,
  createPartFromUri,
  createUserContent,
  type GenerateContentConfig,
  type GenerateContentResponseUsageMetadata,
  type Part,
} from "@google/genai";
import { analyzePayloadSchema, type AnalyzeEvent, type AnalyzePayload, type TokenUsage } from "@/lib/gemini/events";
import { createGeminiClient, getGeminiConfig } from "@/lib/gemini/server/config";
import { GeminiError, isSchemaRejection, toGeminiError } from "@/lib/gemini/server/errors";
import { ndjsonResponse } from "@/lib/gemini/server/ndjson";
import { parseModelJson, toReport } from "@/lib/gemini/server/normalize";
import { buildSystemInstruction, buildUserPrompt } from "@/lib/gemini/server/prompt";
import { toGeminiJsonSchema } from "@/lib/gemini/server/schema";
import { NO_KEY_MESSAGE, sleep } from "@/lib/gemini/server/util";
import { SAMPLE_REPORTS } from "@/lib/mock/sampleReport";
import { getRubric } from "@/lib/rubrics";
import { buildResponseSchema } from "@/lib/schema/report";

/**
 * POST /api/gemini/analyze  (multipart: payload(JSON), image?(문제지))
 * 업로드된 영상 + 문제지 + 채점표 지시문으로 Gemini 멀티모달 분석을 요청하고,
 * 채점표 스키마로 구조화된 JSON(Structured Output)을 받아 검증한 뒤 리포트로 돌려줍니다.
 */

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
  const config = getGeminiConfig();
  let payload: AnalyzePayload | null = null;
  let image: File | null = null;
  let badRequest = "분석 요청 형식이 올바르지 않습니다.";
  try {
    const form = await request.formData();
    payload = analyzePayloadSchema.parse(JSON.parse(String(form.get("payload"))));
    const img = form.get("image");
    if (img instanceof File && img.size > 0) {
      if (img.size > MAX_IMAGE_BYTES) {
        badRequest = "문제지 이미지가 너무 큽니다(15MB 이하로 줄여 주세요).";
        payload = null;
      } else {
        image = img;
      }
    }
  } catch {
    payload = null;
  }

  return ndjsonResponse<AnalyzeEvent>(request, async (send, signal) => {
    const started = Date.now();
    try {
      if (!payload) throw new GeminiError("BAD_REQUEST", badRequest);
      if (config.mock) return await runMock(payload, send, signal, started);
      if (!config.apiKey) throw new GeminiError("NO_API_KEY", NO_KEY_MESSAGE);

      const ai = createGeminiClient({ ...config, apiKey: config.apiKey });
      const parts: Part[] = [createPartFromUri(payload.file.uri, payload.file.mimeType)];
      if (image) {
        const data = Buffer.from(await image.arrayBuffer()).toString("base64");
        parts.push(createPartFromBase64(data, image.type || "image/jpeg"));
      }
      parts.push({
        text: buildUserPrompt({
          mode: payload.mode,
          promptText: payload.promptText,
          hasImage: image !== null,
          durationSec: payload.durationSec,
          timeLimits: payload.timeLimits,
        }),
      });

      const systemInstruction = buildSystemInstruction(payload.mode);
      const jsonSchema = toGeminiJsonSchema(buildResponseSchema(getRubric(payload.mode)));
      const baseConfig: GenerateContentConfig = {
        systemInstruction,
        responseMimeType: "application/json",
        mediaResolution: config.mediaResolution,
        maxOutputTokens: 65536,
        abortSignal: signal,
        // 2.5 계열은 낮은 temperature로 채점 일관성↑ (3 계열은 기본값 권장이라 지정하지 않음)
        ...(config.model.startsWith("gemini-2") ? { temperature: 0.4 } : {}),
      };
      const baseRequest = { model: config.model, contents: [createUserContent(parts)] };

      send({ type: "status", message: "AI가 영상을 보고 채점하는 중… (영상 길이에 따라 1~3분)" });
      let schemaFallback = false;
      let stream;
      try {
        stream = await ai.models.generateContentStream({
          ...baseRequest,
          config: { ...baseConfig, responseJsonSchema: jsonSchema },
        });
      } catch (err) {
        if (!isSchemaRejection(err)) throw err;
        // 스키마가 너무 복잡하다고 거부되면, 스키마를 지시문에 넣고 JSON 모드로 다시 요청 (응답은 동일하게 검증)
        console.warn("[api/gemini/analyze] responseJsonSchema rejected, falling back:", err);
        schemaFallback = true;
        send({ type: "status", message: "응답 형식을 지시문으로 전달해 다시 요청하는 중…" });
        stream = await ai.models.generateContentStream({
          ...baseRequest,
          config: {
            ...baseConfig,
            systemInstruction: `${systemInstruction}\n\n[응답 JSON 스키마 — 이 구조를 정확히 따르세요]\n${JSON.stringify(jsonSchema)}`,
          },
        });
      }

      let text = "";
      let usage: GenerateContentResponseUsageMetadata | undefined;
      let finishReason: FinishReason | undefined;
      let blockReason: string | undefined;
      let lastProgress = 0;
      for await (const chunk of stream) {
        if (signal.aborted) return;
        const piece = chunk.text;
        if (piece) {
          text += piece;
          if (Date.now() - lastProgress > 400) {
            send({ type: "progress", chars: text.length });
            lastProgress = Date.now();
          }
        }
        if (chunk.usageMetadata) usage = chunk.usageMetadata;
        const reason = chunk.candidates?.[0]?.finishReason;
        if (reason) finishReason = reason;
        if (chunk.promptFeedback?.blockReason) blockReason = String(chunk.promptFeedback.blockReason);
      }
      send({ type: "progress", chars: text.length });

      if (blockReason) throw new GeminiError("BLOCKED", `Gemini가 요청을 차단했습니다 (${blockReason}).`);
      if (finishReason === FinishReason.MAX_TOKENS) {
        throw new GeminiError("TRUNCATED", "AI 응답이 너무 길어 중간에 잘렸습니다. 다시 시도해 주세요.");
      }
      if (!text.trim()) {
        throw new GeminiError("BAD_RESPONSE", `AI가 빈 응답을 보냈습니다${finishReason ? ` (${finishReason})` : ""}. 다시 시도해 주세요.`);
      }

      const report = toReport(parseModelJson(text), payload.mode, payload.durationSec);
      send({
        type: "done",
        report,
        meta: {
          model: config.model,
          mock: false,
          elapsedMs: Date.now() - started,
          usage: toUsage(usage),
          schemaFallback,
        },
      });
    } catch (err) {
      if (signal.aborted) return;
      const e = toGeminiError(err, config.model, "analyze");
      console.error("[api/gemini/analyze]", e.code, err);
      send({ type: "error", code: e.code, message: e.message });
    }
  });
}

function toUsage(u: GenerateContentResponseUsageMetadata | undefined): TokenUsage | null {
  if (!u) return null;
  return {
    prompt: u.promptTokenCount ?? null,
    output: u.candidatesTokenCount ?? null,
    thoughts: u.thoughtsTokenCount ?? null,
    total: u.totalTokenCount ?? null,
  };
}

/** GEMINI_MOCK=1: API 호출 없이 샘플 리포트를 같은 검증 경로로 돌려줌 (화면 흐름 테스트용) */
async function runMock(payload: AnalyzePayload, send: (e: AnalyzeEvent) => void, signal: AbortSignal, started: number) {
  send({ type: "status", message: "모의 분석 중 (GEMINI_MOCK=1 — 실제 AI 분석이 아닙니다)" });
  const { mode: _mode, ...body } = structuredClone(SAMPLE_REPORTS[payload.mode]);
  void _mode;
  const text = JSON.stringify(body);
  for (let i = 1; i <= 8; i++) {
    await sleep(300, signal);
    if (signal.aborted) return;
    send({ type: "progress", chars: Math.round((text.length * i) / 8) });
  }
  const report = toReport(parseModelJson(text), payload.mode, null);
  send({
    type: "done",
    report,
    meta: { model: "mock", mock: true, elapsedMs: Date.now() - started, usage: null, schemaFallback: false },
  });
}
