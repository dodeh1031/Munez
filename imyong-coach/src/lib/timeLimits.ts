import { z } from "zod";
import type { EvalMode } from "@/lib/schema/report";

/**
 * 시간 조건 (시도교육청·연도마다 다르므로 직접 입력)
 *  - 수업실연: lessonMin (실연 제한 시간)
 *  - 심층면접: preparedMin (구상형 문항 전체 답변 시간), instantMin (즉답형 답변 시간)
 *  - note: 그 밖의 조건 메모 (예: 구상 10분 → 답변 10분, 판서 가능 여부 등)
 */
export const timeLimitsSchema = z.object({
  lessonMin: z.number().positive().max(180).nullable(),
  preparedMin: z.number().positive().max(120).nullable(),
  instantMin: z.number().positive().max(60).nullable(),
  note: z.string().max(1000),
});
export type TimeLimits = z.infer<typeof timeLimitsSchema>;

export const EMPTY_TIME_LIMITS: TimeLimits = { lessonMin: null, preparedMin: null, instantMin: null, note: "" };

export const TIME_PRESETS = {
  lesson: [10, 15, 20],
  prepared: [8, 10, 15],
  instant: [2, 3, 5],
} as const;

/** 이 모드에서 쓰는 값만 남깁니다 (다른 모드 값이 분석에 섞이지 않도록) */
export function limitsForMode(t: TimeLimits, mode: EvalMode): TimeLimits {
  return mode === "demo"
    ? { ...EMPTY_TIME_LIMITS, lessonMin: t.lessonMin, note: t.note.trim() }
    : { ...EMPTY_TIME_LIMITS, preparedMin: t.preparedMin, instantMin: t.instantMin, note: t.note.trim() };
}

export function hasLimits(t: TimeLimits | null | undefined): boolean {
  return Boolean(t && (t.lessonMin || t.preparedMin || t.instantMin || t.note.trim()));
}

export function sameLimits(a: TimeLimits | null | undefined, b: TimeLimits | null | undefined): boolean {
  return JSON.stringify(a ?? EMPTY_TIME_LIMITS) === JSON.stringify(b ?? EMPTY_TIME_LIMITS);
}

/** 초 → "1분 20초" / "50초" / "15분" */
export function koreanDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r}초`;
  return r === 0 ? `${m}분` : `${m}분 ${r}초`;
}

export type UsageTone = "good" | "warning" | "critical";

/** 사용 시간 vs 제한 시간 판정 (초과는 5초까지 허용, 80% 미만이면 너무 일찍 끝난 것으로 봄) */
export function judgeUsage(usedSec: number, limitSec: number): { tone: UsageTone; label: string } {
  if (usedSec > limitSec + 5) return { tone: "critical", label: `${koreanDuration(usedSec - limitSec)} 초과` };
  const ratio = usedSec / limitSec;
  if (ratio < 0.8) {
    return { tone: "warning", label: `제한 시간의 ${Math.round(ratio * 100)}%만 사용 — 내용이 부족했을 수 있어요` };
  }
  return { tone: "good", label: `제한 시간 안 (${koreanDuration(Math.max(0, limitSec - usedSec))} 남김)` };
}

/* ───────────── 이 컴퓨터에 마지막 입력값 기억 (편의 기능, 실패해도 무시) ───────────── */

const STORAGE_KEY = "imyong-coach:time-limits";

export function loadSavedTimeLimits(): TimeLimits | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = timeLimitsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveTimeLimits(t: TimeLimits) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
  } catch {
    /* 사생활 보호 모드 등 */
  }
}
