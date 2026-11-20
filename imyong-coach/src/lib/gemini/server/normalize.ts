import "server-only";
import { formatSeconds } from "@/lib/format";
import { getRubric } from "@/lib/rubrics";
import { GeminiError } from "@/lib/gemini/server/errors";
import type { PreviousFeedback } from "@/lib/gemini/events";
import {
  FOLLOW_UP_STATUSES,
  buildResponseSchema,
  type AnalysisReport,
  type EvalMode,
  type FollowUp,
} from "@/lib/schema/report";

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

function normalize(raw: unknown, durationSec: number | null, followUpIds: string[]): unknown {
  const root = asObj(raw);
  if (!root) return raw;
  const ts = makeTs(durationSec);

  // 지난 피드백 반영 확인: 빠지거나 형식이 조금 달라도 리포트 전체를 버리지 않도록 보정
  if (followUpIds.length) {
    const fu = asObj(root.followUp) ?? {};
    const known = new Set(followUpIds);
    const seen = new Set<string>();
    fu.items = asArr(fu.items).flatMap((item) => {
      const i = asObj(item);
      if (!i || typeof i.id !== "string" || !known.has(i.id) || seen.has(i.id)) return [];
      seen.add(i.id);
      return [
        {
          id: i.id,
          status: (FOLLOW_UP_STATUSES as readonly unknown[]).includes(i.status) ? i.status : "not_observed",
          evidence: typeof i.evidence === "string" ? i.evidence : "",
          at: ts(i.at, true),
        },
      ];
    });
    if (typeof fu.summary !== "string") fu.summary = "";
    root.followUp = fu;
  } else {
    delete root.followUp;
  }

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

  for (const chunk of asArr(root.transcript)) {
    const c = asObj(chunk);
    if (!c) continue;
    c.start = ts(c.start, false);
    c.end = ts(c.end, false);
    if ((toSeconds(c.start) ?? 0) > (toSeconds(c.end) ?? 0)) [c.start, c.end] = [c.end, c.start];
    if (typeof c.text !== "string") c.text = "";
  }
  if (Array.isArray(root.transcript)) {
    root.transcript = root.transcript.filter((c) => typeof asObj(c)?.text === "string" && String(asObj(c)?.text).trim());
    (root.transcript as unknown[]).sort(bySeconds);
  }

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

export function toReport(
  raw: unknown,
  mode: EvalMode,
  durationSec: number | null,
  previous: PreviousFeedback | null = null,
): AnalysisReport {
  const rubric = getRubric(mode);
  const ids = previous?.items.map((p) => p.id) ?? [];
  const parsed = buildResponseSchema(rubric, ids).safeParse(normalize(raw, durationSec, ids));
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join(" / ");
    throw new GeminiError("BAD_RESPONSE", `AI 응답이 채점표 형식과 맞지 않습니다. 다시 시도해 주세요. (${issues})`);
  }
  const { followUp: answered, ...rest } = parsed.data as Record<string, unknown> & {
    followUp?: { items: { id: string; status: FollowUp["items"][number]["status"]; evidence: string; at: string }[]; summary: string };
  };
  return { mode, ...rest, ...(previous ? { followUp: buildFollowUp(previous, answered) } : {}) } as AnalysisReport;
}

/** 모델 판정 + 지난 피드백 문구·기준 기록 → 화면·기록용 followUp (판정이 빠진 항목은 '판단 불가') */
function buildFollowUp(
  previous: PreviousFeedback,
  answered: { items: { id: string; status: FollowUp["items"][number]["status"]; evidence: string; at: string }[]; summary: string } | undefined,
): FollowUp {
  const byId = new Map((answered?.items ?? []).map((i) => [i.id, i]));
  return {
    base: { recordId: previous.recordId, createdAt: previous.createdAt, overall: previous.overall },
    summary: answered?.summary ?? "",
    items: previous.items.map((p) => {
      const a = byId.get(p.id);
      return {
        id: p.id,
        source: p.source,
        point: p.text,
        status: a?.status ?? "not_observed",
        evidence: a?.evidence || "AI가 이 항목을 판정하지 않았어요.",
        at: a?.at ?? "",
      };
    }),
  };
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
