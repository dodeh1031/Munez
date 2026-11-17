"use client";

import { useEffect, useId } from "react";
import clsx from "clsx";
import { Timer } from "lucide-react";
import { useSessionStore } from "@/lib/store";
import { TIME_PRESETS, loadSavedTimeLimits, saveTimeLimits } from "@/lib/timeLimits";

/** 시간 조건 입력 — 시간 관리 채점의 기준이 됩니다. 마지막 입력값은 이 컴퓨터에 기억합니다. */
export function TimeLimitInput() {
  const mode = useSessionStore((s) => s.mode);
  const t = useSessionStore((s) => s.timeLimits);
  const loaded = useSessionStore((s) => s.timeLimitsLoaded);
  const setTimeLimits = useSessionStore((s) => s.setTimeLimits);
  const noteId = useId();

  // 처음 한 번: 이 컴퓨터에 기억해 둔 값 불러오기
  useEffect(() => {
    if (loaded) return;
    setTimeLimits(loadSavedTimeLimits() ?? {}, { loaded: true });
  }, [loaded, setTimeLimits]);

  // 바뀔 때마다 기억
  useEffect(() => {
    if (loaded) saveTimeLimits(t);
  }, [t, loaded]);

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
        <Timer className="size-4 text-indigo-600" aria-hidden />
        시간 조건 <span className="font-normal text-slate-400">(선택 · 시간 관리 채점 기준)</span>
      </p>

      {mode === "demo" ? (
        <MinuteField
          label="수업실연 제한 시간"
          value={t.lessonMin}
          presets={TIME_PRESETS.lesson}
          onChange={(lessonMin) => setTimeLimits({ lessonMin })}
        />
      ) : (
        <>
          <MinuteField
            label="구상형 답변 시간"
            hint="구상형 문항 전체 합계"
            value={t.preparedMin}
            presets={TIME_PRESETS.prepared}
            onChange={(preparedMin) => setTimeLimits({ preparedMin })}
          />
          <MinuteField
            label="즉답형 답변 시간"
            value={t.instantMin}
            presets={TIME_PRESETS.instant}
            onChange={(instantMin) => setTimeLimits({ instantMin })}
          />
        </>
      )}

      <div>
        <label htmlFor={noteId} className="mb-1 block text-xs font-medium text-slate-600">
          시도교육청 조건 메모 <span className="font-normal text-slate-400">(선택)</span>
        </label>
        <textarea
          id={noteId}
          value={t.note}
          onChange={(e) => setTimeLimits({ note: e.target.value })}
          rows={2}
          placeholder={
            mode === "demo"
              ? "예) 구상 60분 후 실연 20분, 판서 가능, 학생 없이 진행"
              : "예) 구상 10분 → 구상형 3문항 답변 10분, 즉답형 1문항은 구상 없이 바로 답변"
          }
          className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
      </div>
    </div>
  );
}

function MinuteField({
  label,
  hint,
  value,
  presets,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number | null;
  presets: readonly number[];
  onChange: (v: number | null) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <label htmlFor={id} className="w-36 shrink-0 text-sm text-slate-700">
        {label}
        {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0.5}
          max={180}
          step={0.5}
          value={value ?? ""}
          onChange={(e) => {
            const v = e.target.value === "" ? null : Number(e.target.value);
            onChange(v !== null && Number.isFinite(v) && v > 0 ? v : null);
          }}
          placeholder="-"
          className="w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-right text-sm tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        <span className="text-sm text-slate-500">분</span>
      </div>
      <div className="flex gap-1" role="group" aria-label={`${label} 빠른 선택`}>
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={value === p}
            onClick={() => onChange(value === p ? null : p)}
            className={clsx(
              "rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-colors",
              value === p ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
            )}
          >
            {p}분
          </button>
        ))}
      </div>
    </div>
  );
}
