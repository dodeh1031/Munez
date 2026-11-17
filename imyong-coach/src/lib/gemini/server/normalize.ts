import "server-only";
import { formatSeconds } from "@/lib/format";
import { getRubric } from "@/lib/rubrics";
import { GeminiError } from "@/lib/gemini/server/errors";
import { buildResponseSchema, type AnalysisReport, type EvalMode } from "@/lib/schema/report";

/**
 * 모델 응답(JSON) → 화면용 리포트
 * 1) 사소한 형식 차이는 고쳐 줍니다: "1:05"→"01:05", "1:02:03"→"62:03", 영상 길이 초과 → 끝으로, 점수 범위 보정
 * 2) 채점표 스키마로 엄격하게 검증합니다 (세부 기준 누락 등은 오류)
 */

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function toSeconds(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string" || !v.trim()) return null;
  const parts = v.trim().split(":").map(Number);
  if (parts.length > 3 || parts.some((n) => Number.isNaN(n))) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

function makeTs(durationSec: number | null) {
  const limit = durationSec ? Math.max(0, Math.floor(durationSec)) : null;
  return (v: unknown, allowEmpty: boolean): string => {
    const sec = toSeconds(v);
    if (sec === null) return allowEmpty ? "" : "00:00";
    return formatSeconds(limit !== null ? Math.min(sec, limit) : sec);
  };
}

const clampScore = (v: unknown) => Math.min(5, Math.max(1, Math.round(Number(v)) || 1));

function normalize(raw: unknown, durationSec: number | null): unknown {
  const root = asObj(raw);
  if (!root) return raw;
  const ts = makeTs(durationSec);

  const bySeconds = (a: unknown, b: unknown) =>
    (toSeconds(asObj(a)?.start) ?? 0) - (toSeconds(asObj(b)?.start) ?? 0);

  for (const seg of asArr(root.segments)) {
    const s = asObj(seg);
    if (!s) continue;
    s.start = ts(s.start, false);
    s.end = ts(s.end, false);
    if ((toSeconds(s.start) ?? 0) > (toSeconds(s.end) ?? 0)) [s.start, s.end] = [s.end, s.start];
  }
  if (Array.isArray(root.segments)) root.segments.sort(bySeconds);

  for (const alt of asArr(root.alternatives)) {
    const a = asObj(alt);
    if (a) a.at = ts(a.at, false);
  }
  for (const check of asArr(root.conditionChecks)) {
    const c = asObj(check);
    if (c) c.at = ts(c.at, true);
  }
  for (const q of asArr(root.questions)) {
    const o = asObj(q);
    if (!o) continue;
    o.start = ts(o.start, false);
    o.end = ts(o.end, false);
    const scores = asObj(o.scores);
    if (scores) for (const k of Object.keys(scores)) scores[k] = clampScore(scores[k]);
    o.keywordsCovered = asArr(o.keywordsCovered);
    o.keywordsMissed = asArr(o.keywordsMissed);
  }
  if (Array.isArray(root.questions)) root.questions.sort(bySeconds);

  const scores = asObj(root.scores);
  if (scores) {
    for (const area of Object.values(scores)) {
      const a = asObj(area);
      if (!a) continue;
      for (const crit of Object.values(a)) {
        const c = asObj(crit);
        if (!c) continue;
        c.score = clampScore(c.score);
        c.at = ts(c.at, true);
        if (typeof c.evidence !== "string") c.evidence = "";
      }
    }
  }
  const checklist = asObj(root.checklist);
  if (checklist) {
    for (const item of Object.values(checklist)) {
      const i = asObj(item);
      if (!i) continue;
      i.at = ts(i.at, true);
      if (typeof i.note !== "string") i.note = "";
    }
  }
  return root;
}

export function toReport(raw: unknown, mode: EvalMode, durationSec: number | null): AnalysisReport {
  const rubric = getRubric(mode);
  const parsed = buildResponseSchema(rubric).safeParse(normalize(raw, durationSec));
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join(" / ");
    throw new GeminiError("BAD_RESPONSE", `AI 응답이 채점표 형식과 맞지 않습니다. 다시 시도해 주세요. (${issues})`);
  }
  return { mode, ...parsed.data } as AnalysisReport;
}

/** 스트리밍으로 받은 텍스트에서 JSON을 꺼냅니다 (스키마 미적용 대비: ```json 코드블록도 허용) */
export function parseModelJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const body = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(body.slice(start, end + 1));
      } catch {
        /* 아래에서 오류 */
      }
    }
    throw new GeminiError("BAD_RESPONSE", "AI 응답을 JSON으로 읽지 못했습니다. 다시 시도해 주세요.");
  }
}
