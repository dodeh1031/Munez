"use client";

import { useState } from "react";
import clsx from "clsx";
import { ArrowDown, ArrowUp, Info, PenLine, Scale } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { TimestampButton } from "@/components/report/TimestampButton";
import { SCORE_SCALE, type Rubric } from "@/lib/rubrics";
import type { RubricScores } from "@/lib/schema/report";
import { compareWithAi, countScored, selfOverall, type SelfScore, type SelfScoreMap } from "@/lib/selfScore";
import { saveSelfScore } from "@/lib/selfScoreActions";

// 두 계열 비교: 검증된 팔레트 1·2번(파랑=AI, 주황=나), 범례 + 숫자 직접 표기
const AI_COLOR = "#2a78d6";
const ME_COLOR = "#eb6834";

/** 자기 채점 탭: 채점 → (AI 결과가 있으면) 비교 */
export function SelfScorePanel({
  rubric,
  selfScore,
  canScore,
  aiScores,
}: {
  rubric: Rubric;
  selfScore: SelfScore | null;
  canScore: boolean;
  /** 실제 AI 결과가 있을 때만 (샘플이면 null) */
  aiScores: RubricScores | null;
}) {
  const current = selfScore?.mode === rubric.mode ? selfScore : null;
  const [editing, setEditing] = useState(false);

  if (!canScore) {
    return (
      <Card className="px-5 py-8 text-center text-sm text-slate-500">
        영상을 올리면 같은 채점표로 스스로 채점하고 AI 점수와 비교할 수 있어요.
      </Card>
    );
  }
  if (!current || editing) {
    return <SelfScoreForm rubric={rubric} initial={current} aiReady={aiScores !== null} onDone={() => setEditing(false)} />;
  }
  if (!aiScores) {
    return (
      <Card>
        <CardHeader icon={PenLine} title="자기 채점" description="저장했어요" />
        <div className="space-y-3 px-5 py-5 text-sm">
          <p>
            내 종합 점수 <b className="text-lg">{selfOverall(rubric, current)}</b>점
          </p>
          <p className="text-slate-500">AI 분석이 끝나면 항목별로 비교해 드려요.</p>
          <button type="button" onClick={() => setEditing(true)} className="text-sm font-medium text-indigo-600 hover:underline">
            다시 채점하기
          </button>
        </div>
      </Card>
    );
  }
  return <SelfScoreComparison rubric={rubric} self={current} ai={aiScores} onEdit={() => setEditing(true)} />;
}

function SelfScoreForm({
  rubric,
  initial,
  aiReady,
  onDone,
}: {
  rubric: Rubric;
  initial: SelfScore | null;
  aiReady: boolean;
  onDone: () => void;
}) {
  const [scores, setScores] = useState<SelfScoreMap>(() => structuredClone(initial?.scores ?? {}));
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { done, total } = countScored(rubric, scores);

  function set(areaId: string, critId: string, value: number) {
    setScores((s) => ({ ...s, [areaId]: { ...s[areaId], [critId]: value } }));
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await saveSelfScore({ mode: rubric.mode, scores, memo: memo.trim(), savedAt: new Date().toISOString() });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader icon={PenLine} title="자기 채점" description={`${rubric.title}로 내 영상을 스스로 채점해요 · ${done}/${total}`} />
      <p className="mx-5 mt-4 flex gap-2 rounded-lg bg-indigo-50/70 px-3 py-2.5 text-xs leading-relaxed text-indigo-900">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        {aiReady
          ? "AI 결과를 이미 봤다면, 영상을 다시 보며 솔직하게 채점해 보세요. 차이가 큰 항목이 기준을 맞춰 볼 지점이에요."
          : "AI 점수를 보기 전에 채점하면 내 판단과 AI 판단을 더 정확히 비교할 수 있어요."}
      </p>
      <dl className="flex flex-wrap gap-x-3 gap-y-1 px-5 pt-3 text-xs text-slate-500">
        {SCORE_SCALE.map((s) => (
          <div key={s.score} className="flex gap-1">
            <dt className="font-semibold text-slate-700">{s.score}</dt>
            <dd>{s.label}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
        {rubric.areas.map((area) => (
          <fieldset key={area.id} className="px-5 py-4">
            <legend className="mb-2 font-semibold">{area.label}</legend>
            <div className="space-y-3">
              {area.criteria.map((c) => {
                const value = scores[area.id]?.[c.id];
                return (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="text-sm font-medium">{c.label}</p>
                      <p className="text-xs text-slate-500">{c.description}</p>
                    </div>
                    <div role="radiogroup" aria-label={c.label} className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <label
                          key={n}
                          className={clsx(
                            "grid size-9 cursor-pointer place-items-center rounded-lg text-sm font-semibold ring-1 transition-colors",
                            "has-focus-visible:ring-2 has-focus-visible:ring-indigo-500",
                            value === n ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
                          )}
                        >
                          <input
                            type="radio"
                            name={`${area.id}.${c.id}`}
                            value={n}
                            checked={value === n}
                            onChange={() => set(area.id, c.id, n)}
                            className="sr-only"
                          />
                          {n}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="space-y-3 border-t border-slate-100 px-5 py-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">스스로 느낀 점 (선택)</span>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
            placeholder="예) 2번 문항에서 시간이 부족했다. 도입이 길었던 것 같다."
            className="w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </label>
        {error && <p className="text-sm text-rose-600">저장하지 못했어요: {error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={done < total || saving}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? "저장 중…" : aiReady ? "저장하고 AI와 비교하기" : "자기 채점 저장"}
          </button>
          {done < total && <span className="text-xs text-slate-500">{total - done}개 항목이 남았어요</span>}
          {initial && (
            <button type="button" onClick={onDone} className="text-sm text-slate-500 hover:underline">
              취소
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

function SelfScoreComparison({
  rubric,
  self,
  ai,
  onEdit,
}: {
  rubric: Rubric;
  self: SelfScore;
  ai: RubricScores;
  onEdit: () => void;
}) {
  const cmp = compareWithAi(rubric, self, ai);
  const gap = cmp.mineOverall - cmp.aiOverall;
  const pos = (v: number) => `${((v - 1) / 4) * 100}%`;

  return (
    <Card>
      <CardHeader
        icon={Scale}
        title="자기 채점 vs AI"
        description="같은 채점표로 매긴 점수 비교"
        action={
          <button type="button" onClick={onEdit} className="shrink-0 text-xs font-medium text-indigo-600 hover:underline print:hidden">
            다시 채점
          </button>
        }
      />
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-5 pt-4 text-sm">
        <span className="text-slate-500">
          나 <b className="text-xl text-slate-900">{cmp.mineOverall}</b>점
        </span>
        <span className="text-slate-500">
          AI <b className="text-xl text-slate-900">{cmp.aiOverall}</b>점
        </span>
        <span className="text-slate-600">
          {gap === 0 ? "종합 점수가 같아요" : gap > 0 ? `AI보다 ${gap}점 후하게 봤어요` : `AI보다 ${-gap}점 박하게 봤어요`}
        </span>
      </div>

      {/* 영역별: 두 점(나·AI)과 차이 선 */}
      <div className="px-5 py-4">
        <p className="mb-2 flex items-center gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: ME_COLOR }} aria-hidden /> 나
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: AI_COLOR }} aria-hidden /> AI
          </span>
          <span className="text-slate-400">영역 점수(1~5)</span>
        </p>
        <ul className="space-y-3">
          {cmp.areas.map((a) => (
            <li key={a.id} className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3 text-sm">
              <span className="truncate font-medium">{a.label}</span>
              <span className="relative h-4" role="img" aria-label={`${a.label}: 나 ${a.mine.toFixed(1)}, AI ${a.ai.toFixed(1)}`}>
                <span className="absolute inset-x-0 top-1/2 h-px bg-slate-200" />
                <span
                  className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-slate-400"
                  style={{ left: pos(Math.min(a.mine, a.ai)), width: `calc(${pos(Math.max(a.mine, a.ai))} - ${pos(Math.min(a.mine, a.ai))})` }}
                />
                <span
                  className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
                  style={{ left: pos(a.ai), background: AI_COLOR }}
                />
                <span
                  className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
                  style={{ left: pos(a.mine), background: ME_COLOR }}
                />
              </span>
              <span className="w-28 text-right text-xs tabular-nums text-slate-600">
                나 {a.mine.toFixed(1)} · AI {a.ai.toFixed(1)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {(cmp.higher.length > 0 || cmp.lower.length > 0) && (
        <div className="grid gap-4 border-t border-slate-100 px-5 py-4 sm:grid-cols-2">
          <GapList title="내가 더 후하게 본 항목" rows={cmp.higher} up />
          <GapList title="내가 더 박하게 본 항목" rows={cmp.lower} />
        </div>
      )}

      <table className="w-full border-t border-slate-100 text-sm">
        <thead>
          <tr className="text-xs text-slate-500">
            <th scope="col" className="px-5 py-2 text-left font-medium">세부 기준</th>
            <th scope="col" className="w-12 py-2 text-right font-medium">나</th>
            <th scope="col" className="w-12 py-2 text-right font-medium">AI</th>
            <th scope="col" className="w-24 px-5 py-2 text-right font-medium">차이</th>
          </tr>
        </thead>
        <tbody>
          {rubric.areas.map((area) => (
            <AreaRows key={area.id} areaLabel={area.label} rows={cmp.rows.filter((r) => r.areaId === area.id)} ai={ai} />
          ))}
        </tbody>
      </table>

      {self.memo && (
        <p className="border-t border-slate-100 px-5 py-3 text-sm text-slate-700">
          <span className="font-medium">스스로 느낀 점 </span>
          {self.memo}
        </p>
      )}
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
        차이가 2점 이상인 항목은 AI 근거를 함께 보여 드려요. 영상을 다시 보며 기준을 맞춰 보세요. AI 점수도 추정치예요.
      </p>
    </Card>
  );
}

function GapList({ title, rows, up }: { title: string; rows: ReturnType<typeof compareWithAi>["higher"]; up?: boolean }) {
  return (
    <div>
      <h3 className="mb-1.5 text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400">없음</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {rows.map((r) => (
            <li key={`${r.areaId}.${r.criterionId}`} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate">{r.label}</span>
              <DiffBadge diff={r.diff} />
            </li>
          ))}
        </ul>
      )}
      <span className="sr-only">{up ? "내 점수가 AI보다 높은 항목" : "내 점수가 AI보다 낮은 항목"}</span>
    </div>
  );
}

function DiffBadge({ diff }: { diff: number }) {
  if (diff === 0) return <span className="text-xs text-slate-400">같음</span>;
  return (
    <span className={clsx("inline-flex items-center gap-0.5 text-xs font-medium tabular-nums", Math.abs(diff) >= 2 ? "text-rose-600" : "text-slate-600")}>
      {diff > 0 ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
      {diff > 0 ? "+" : ""}
      {diff}
      <span className="sr-only">{diff > 0 ? " 내가 더 높음" : " 내가 더 낮음"}</span>
    </span>
  );
}

function AreaRows({ areaLabel, rows, ai }: { areaLabel: string; rows: ReturnType<typeof compareWithAi>["rows"]; ai: RubricScores }) {
  return (
    <>
      <tr className="bg-slate-50/70">
        <th scope="rowgroup" colSpan={4} className="px-5 py-1.5 text-left text-xs font-semibold text-slate-600">
          {areaLabel}
        </th>
      </tr>
      {rows.map((r) => {
        const big = Math.abs(r.diff) >= 2;
        const evidence = ai[r.areaId]?.[r.criterionId];
        return (
          <tr key={r.criterionId} className={clsx("border-t border-slate-50 align-top", big && "bg-rose-50/40")}>
            <td className="px-5 py-2">
              <p>{r.label}</p>
              {big && evidence?.evidence && (
                <p className="mt-1 flex flex-wrap items-start gap-1.5 text-xs text-slate-600">
                  <span className="font-medium text-slate-700">AI 근거</span>
                  <TimestampButton start={evidence.at} />
                  <span className="min-w-0 flex-1">{evidence.evidence}</span>
                </p>
              )}
            </td>
            <td className="py-2 text-right tabular-nums">{r.mine}</td>
            <td className="py-2 text-right tabular-nums">{r.ai}</td>
            <td className="px-5 py-2 text-right">
              <DiffBadge diff={r.diff} />
            </td>
          </tr>
        );
      })}
    </>
  );
}
