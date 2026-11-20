import type { PreviousFeedback } from "@/lib/gemini/events";
import type { HistoryRecord } from "@/lib/history/types";
import { getRubric, overallScore } from "@/lib/rubrics";
import { INTERVIEW_CHECKLIST } from "@/lib/rubrics/interview";
import type { EvalMode } from "@/lib/schema/report";

/**
 * 지난 피드백 반영 확인
 *  - 같은 문제로 다시 연습할 때, 지난 기록의 핵심 피드백을 골라 AI에게 '이번에 고쳐졌는지' 묻습니다.
 *  - 지난 기록 찾기: 같은 모드에서 문제 문구가 거의 같은 가장 최근 기록을 자동 제안합니다(직접 바꿀 수 있음).
 */

const MAX_ITEMS = 8;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** 지난 기록에서 확인할 피드백 항목 고르기 (중요한 것부터, 최대 8개) */
export function buildPreviousFeedback(record: HistoryRecord): PreviousFeedback | null {
  const report = record.report;
  const rubric = getRubric(report.mode);
  const seen = new Set<string>();
  const buckets: { source: string; text: string }[][] = [];
  const bucket = (limit: number, list: { source: string; text: string }[]) => {
    const picked: { source: string; text: string }[] = [];
    for (const item of list) {
      const text = item.text.replace(/\s+/g, " ").trim();
      if (!text || seen.has(text) || picked.length >= limit) continue;
      seen.add(text);
      picked.push({ source: item.source, text });
    }
    buckets.push(picked);
  };

  // 1) 지난번 비교에서도 아직 고쳐지지 않은 항목 (이어서 확인)
  bucket(
    2,
    (report.followUp?.items ?? [])
      .filter((f) => f.status === "not_yet" || f.status === "partly")
      .map((f) => ({ source: f.status === "not_yet" ? "지난번에도 미반영" : "지난번에 일부 반영", text: f.point })),
  );
  // 2) 반드시 보완할 장면
  bucket(
    3,
    report.segments
      .filter((s) => s.sentiment === "critical")
      .map((s) => ({ source: `구간 피드백 ${s.start}`, text: `${s.title} — ${s.suggestion}` })),
  );
  // 3) 수업 조건 미충족 / 자기점검표 보완 필요
  if (report.mode === "demo") {
    bucket(
      2,
      report.conditionChecks
        .filter((c) => c.status !== "met")
        .map((c) => ({
          source: c.status === "missed" ? "수업 조건 미충족" : "수업 조건 부분 충족",
          text: `${c.condition} — ${c.evidence}`,
        })),
    );
  } else {
    const labels = new Map(INTERVIEW_CHECKLIST.flatMap((g) => g.items.map((i) => [i.id, i.label] as const)));
    bucket(
      2,
      Object.entries(report.checklist)
        .filter(([, r]) => r.status === "fail")
        .map(([id, r]) => ({ source: "자기점검표", text: `${labels.get(id) ?? id}${r.note ? ` — ${r.note}` : ""}` })),
    );
  }
  // 4) 낮은 점수(2점 이하) 세부 기준
  bucket(
    2,
    rubric.areas.flatMap((area) =>
      area.criteria
        .map((c) => ({ c, s: report.scores[area.id]?.[c.id] }))
        .filter(({ s }) => s && s.score <= 2)
        .sort((a, b) => (a.s?.score ?? 0) - (b.s?.score ?? 0))
        .map(({ c, s }) => ({ source: `채점 기준 · ${area.label}`, text: `${c.label}: ${s?.evidence ?? ""}` })),
    ),
  );
  // 5) 개선 권장 장면
  bucket(
    MAX_ITEMS,
    report.segments
      .filter((s) => s.sentiment === "improve")
      .map((s) => ({ source: `구간 피드백 ${s.start}`, text: `${s.title} — ${s.suggestion}` })),
  );
  // 6) 만능틀 표현
  bucket(
    2,
    report.alternatives.map((a) => ({
      source: `만능틀 표현 ${a.at}`,
      text: `"${a.original}" 같은 표현 대신 → ${a.alternative}`,
    })),
  );

  // 우선순위대로 채우되 만능틀 표현 자리는 하나쯤 남겨 둠
  const [carry, critical, conditions, lowScores, improve, alternatives] = buckets;
  const ordered = [...carry, ...critical, ...conditions, ...lowScores];
  const roomForImprove = Math.max(0, MAX_ITEMS - ordered.length - Math.min(1, alternatives.length));
  const items = [...ordered, ...improve.slice(0, roomForImprove), ...alternatives].slice(0, MAX_ITEMS);
  if (items.length === 0) return null;

  return {
    recordId: record.id,
    createdAt: record.createdAt,
    overall: overallScore(rubric, report.scores),
    items: items.map((item, i) => ({ id: `p${i + 1}`, source: clip(item.source, 80), text: clip(item.text, 380) })),
  };
}

/* ───────── 같은 문제로 연습한 지난 기록 찾기 ───────── */

const squash = (s: string) => s.replace(/\s+/g, "").toLowerCase();

function bigrams(s: string): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    map.set(g, (map.get(g) ?? 0) + 1);
  }
  return map;
}

/** 두 문장의 글자 짝 겹침 정도 (0~1) */
export function promptSimilarity(a: string, b: string): number {
  const x = squash(a);
  const y = squash(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const bx = bigrams(x);
  const by = bigrams(y);
  let overlap = 0;
  for (const [g, n] of bx) overlap += Math.min(n, by.get(g) ?? 0);
  const total = Math.max(1, x.length - 1 + (y.length - 1));
  return (2 * overlap) / total;
}

/** 같은 모드에서 문제 문구가 거의 같은(80% 이상) 가장 최근 기록 */
export function suggestPreviousRecord(records: HistoryRecord[], mode: EvalMode, promptText: string): HistoryRecord | null {
  if (squash(promptText).length < 8) return null;
  const sameMode = records.filter((r) => r.mode === mode).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return sameMode.find((r) => promptSimilarity(promptText, r.promptText) >= 0.8) ?? null;
}
