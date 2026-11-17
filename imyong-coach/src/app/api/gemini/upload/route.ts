import { FileState } from "@google/genai";
import { formatBytes } from "@/lib/format";
import type { UploadEvent } from "@/lib/gemini/events";
import { createGeminiClient, getGeminiConfig } from "@/lib/gemini/server/config";
import { GeminiError, toGeminiError } from "@/lib/gemini/server/errors";
import { ndjsonResponse } from "@/lib/gemini/server/ndjson";
import { NO_KEY_MESSAGE, sleep } from "@/lib/gemini/server/util";

/**
 * POST /api/gemini/upload  (multipart: file)
 * 브라우저에서 압축한 분석용 영상을 Gemini Files API에 올리고, 처리(PROCESSING)가 끝나 ACTIVE가 될 때까지 기다립니다.
 * 진행 상황은 NDJSON으로 스트리밍합니다. API 키는 서버에서만 사용됩니다.
 */

const PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;
const POLL_INTERVAL_MS = 2000;

export async function POST(request: Request) {
  const config = getGeminiConfig();
  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get("file");
    if (value instanceof File && value.size > 0) file = value;
  } catch {
    /* 아래에서 오류 이벤트로 처리 */
  }

  return ndjsonResponse<UploadEvent>(request, async (send, signal) => {
    try {
      if (!file) throw new GeminiError("UPLOAD_FAILED", "업로드할 분석용 영상이 없습니다.");

      if (config.mock) {
        send({ type: "status", message: "모의 업로드 중 (GEMINI_MOCK=1)" });
        await sleep(800, signal);
        send({
          type: "done",
          file: {
            name: `files/mock-${Date.now()}`,
            uri: "mock://analysis.mp4",
            mimeType: file.type || "video/mp4",
            expiresAt: new Date(Date.now() + 47 * 3600_000).toISOString(),
          },
        });
        return;
      }
      if (!config.apiKey) throw new GeminiError("NO_API_KEY", NO_KEY_MESSAGE);

      const ai = createGeminiClient({ ...config, apiKey: config.apiKey });
      send({ type: "status", message: `Gemini로 업로드하는 중 (${formatBytes(file.size)})`, progress: 0.15 });
      let uploaded = await ai.files.upload({
        file,
        config: { mimeType: file.type || "video/mp4", displayName: file.name, abortSignal: signal },
      });
      const fileName = uploaded.name;
      if (!fileName) throw new GeminiError("UPLOAD_FAILED", "Gemini 업로드 응답에 파일 이름이 없습니다.");

      const started = Date.now();
      while (uploaded.state !== FileState.ACTIVE) {
        if (signal.aborted) return;
        if (uploaded.state === FileState.FAILED) {
          throw new GeminiError("UPLOAD_FAILED", `Gemini가 영상을 처리하지 못했습니다. ${uploaded.error?.message ?? ""}`.trim());
        }
        if (Date.now() - started > PROCESSING_TIMEOUT_MS) {
          throw new GeminiError("UPLOAD_FAILED", "Gemini의 영상 처리가 너무 오래 걸립니다. 잠시 후 다시 시도하세요.");
        }
        const waited = (Date.now() - started) / 1000;
        send({
          type: "status",
          message: `Gemini가 영상을 준비하는 중… ${Math.round(waited)}초`,
          progress: 0.4 + 0.55 * Math.min(1, waited / 90),
        });
        await sleep(POLL_INTERVAL_MS, signal);
        uploaded = await ai.files.get({ name: fileName, config: { abortSignal: signal } });
      }

      send({
        type: "done",
        file: {
          name: fileName,
          uri: uploaded.uri ?? "",
          mimeType: uploaded.mimeType ?? file.type ?? "video/mp4",
          expiresAt: uploaded.expirationTime ?? null,
        },
      });
    } catch (err) {
      if (signal.aborted) return;
      const e = toGeminiError(err, config.model, "upload");
      console.error("[api/gemini/upload]", e.code, err);
      send({ type: "error", code: e.code === "UNKNOWN" ? "UPLOAD_FAILED" : e.code, message: e.message });
    }
  });
}
