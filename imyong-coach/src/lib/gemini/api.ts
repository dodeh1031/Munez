import type {
  AnalysisMeta,
  AnalyzeEvent,
  AnalyzePayload,
  GeminiErrorCode,
  UploadEvent,
  UploadedFileInfo,
} from "@/lib/gemini/events";
import type { AnalysisReport } from "@/lib/schema/report";

/** 브라우저 → 로컬 API 라우트 호출 (API 키는 서버에만 있음) */

export class GeminiClientError extends Error {
  constructor(
    public code: GeminiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** NDJSON 응답을 한 줄씩 읽어 이벤트로 전달 */
async function readNdjson<E>(response: Response, onEvent: (e: E) => void): Promise<void> {
  if (!response.body) throw new GeminiClientError("UNKNOWN", `서버 응답이 없습니다 (HTTP ${response.status}).`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) onEvent(JSON.parse(line) as E);
      }
      if (done) break;
    }
    if (buffer.trim()) onEvent(JSON.parse(buffer) as E);
  } catch (err) {
    await reader.cancel().catch(() => {}); // 오류 이벤트로 중단할 때 연결 정리
    throw err;
  }
}

async function post(url: string, body: FormData, signal: AbortSignal): Promise<Response> {
  const res = await fetch(url, { method: "POST", body, signal });
  if (!res.ok && !res.headers.get("content-type")?.includes("ndjson")) {
    throw new GeminiClientError("UNKNOWN", `로컬 서버 오류 (HTTP ${res.status}). 개발 서버 터미널의 로그를 확인하세요.`);
  }
  return res;
}

export async function uploadToGemini(
  file: File,
  opts: { signal: AbortSignal; onStatus: (message: string, progress?: number) => void },
): Promise<UploadedFileInfo> {
  const form = new FormData();
  form.append("file", file);
  const res = await post("/api/gemini/upload", form, opts.signal);
  let result: UploadedFileInfo | null = null;
  await readNdjson<UploadEvent>(res, (e) => {
    if (e.type === "status") opts.onStatus(e.message, e.progress);
    else if (e.type === "error") throw new GeminiClientError(e.code, e.message);
    else result = e.file;
  });
  if (!result) throw new GeminiClientError("UPLOAD_FAILED", "업로드 결과를 받지 못했습니다.");
  return result;
}

export async function analyzeWithGemini(
  payload: AnalyzePayload,
  image: File | null,
  opts: {
    signal: AbortSignal;
    onStatus: (message: string) => void;
    onProgress: (chars: number) => void;
  },
): Promise<{ report: AnalysisReport; meta: AnalysisMeta }> {
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  if (image) form.append("image", image);
  const res = await post("/api/gemini/analyze", form, opts.signal);
  let result: { report: AnalysisReport; meta: AnalysisMeta } | null = null;
  await readNdjson<AnalyzeEvent>(res, (e) => {
    if (e.type === "status") opts.onStatus(e.message);
    else if (e.type === "progress") opts.onProgress(e.chars);
    else if (e.type === "error") throw new GeminiClientError(e.code, e.message);
    else result = { report: e.report, meta: e.meta };
  });
  if (!result) throw new GeminiClientError("BAD_RESPONSE", "분석 결과를 받지 못했습니다. 다시 시도해 주세요.");
  return result;
}
