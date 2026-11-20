"use client";

import { useEffect, useId, useMemo } from "react";
import { History } from "lucide-react";
import { buildPreviousFeedback, suggestPreviousRecord } from "@/lib/followUp";
import { useHistoryStore } from "@/lib/history/store";
import { getRubric, overallScore } from "@/lib/rubrics";
import { useSessionStore } from "@/lib/store";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const preview = (s: string, n = 28) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

/**
 * 지난 연습과 비교 (선택): 고른 기록의 핵심 피드백이 이번 영상에서 고쳐졌는지 AI가 함께 확인합니다.
 * 같은 모드에서 문제 문구가 거의 같은 가장 최근 기록을 자동으로 골라 두며, 직접 바꿀 수 있습니다.
 */
export function CompareWithPrevious() {
  const selectId = useId();
  const mode = useSessionStore((s) => s.mode);
  const promptText = useSessionStore((s) => s.promptText);
  const compareWith = useSessionStore((s) => s.compareWith);
  const touched = useSessionStore((s) => s.compareTouched);
  const setCompareWith = useSessionStore((s) => s.setCompareWith);
  // 지금 영상의 분석 결과(방금 저장한 기록)는 자기 자신이라 비교 대상에서 뺌
  const ownId = useSessionStore((s) => (s.historySave?.status === "saved" ? s.historySave.id : null));
  const records = useHistoryStore((s) => s.records);
  const status = useHistoryStore((s) => s.status);

  useEffect(() => {
    void useHistoryStore.getState().load();
  }, []);

  const options = useMemo(
    () =>
      records
        .filter((r) => r.mode === mode && r.id !== ownId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 30),
    [records, mode, ownId],
  );
  const selected = options.find((r) => r.id === compareWith) ?? null;

  // 고른 기록이 사라졌거나(삭제·모드 변경) 직접 고르지 않았으면 같은 문제 기록을 자동 제안
  useEffect(() => {
    if (status !== "ready") return;
    if (compareWith && !selected) {
      setCompareWith(null, false);
      return;
    }
    if (touched) return;
    const suggestion = suggestPreviousRecord(options, mode, promptText);
    if ((suggestion?.id ?? null) !== compareWith) setCompareWith(suggestion?.id ?? null, false);
  }, [status, options, mode, promptText, compareWith, selected, touched, setCompareWith]);

  const feedback = useMemo(() => (selected ? buildPreviousFeedback(selected) : null), [selected]);
  const rubric = getRubric(mode);

  return (
    <div className="space-y-2.5">
      <label htmlFor={selectId} className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
        <History className="size-4 text-indigo-600" aria-hidden />
        지난 연습과 비교 <span className="font-normal text-slate-400">(선택 · 지난 피드백이 고쳐졌는지 확인)</span>
      </label>

      {options.length === 0 ? (
        <p className="text-xs text-slate-500">
          {status === "ready"
            ? "이 모드의 분석 기록이 생기면, 같은 문제를 다시 연습할 때 지난 피드백이 고쳐졌는지 함께 확인할 수 있어요."
            : "기록을 불러오는 중…"}
        </p>
      ) : (
        <>
          <select
            id={selectId}
            value={compareWith ?? ""}
            onChange={(e) => setCompareWith(e.target.value || null, true)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">비교하지 않음</option>
            {options.map((r) => (
              <option key={r.id} value={r.id}>
                {fmtDate(r.createdAt)} · {overallScore(rubric, r.report.scores)}점 · {preview(r.promptText) || r.title}
              </option>
            ))}
          </select>

          {selected && !touched && (
            <p className="text-xs text-indigo-700">같은 문제로 연습한 기록을 찾아 골라 두었어요. 다른 기록을 고르거나 끌 수 있어요.</p>
          )}
          {selected &&
            (feedback ? (
              <details className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <summary className="cursor-pointer select-none font-medium text-slate-700">
                  확인할 지난 피드백 {feedback.items.length}개 보기
                </summary>
                <ol className="mt-2 list-decimal space-y-1 pl-4">
                  {feedback.items.map((item) => (
                    <li key={item.id}>
                      <span className="text-slate-400">[{item.source}]</span> {item.text}
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-slate-500">분석 비용이 조금(출력 몇백 토큰) 늘어요.</p>
              </details>
            ) : (
              <p className="text-xs text-slate-500">이 기록에는 확인할 만한 보완점이 없어 비교하지 않아요.</p>
            ))}
        </>
      )}
    </div>
  );
}
