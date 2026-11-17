import { formatSeconds, parseTimestamp } from "@/lib/format";
import type { TranscriptChunk } from "@/lib/schema/report";

/**
 * 말하기 지표 — AI가 받아 적은 발화 기록(transcript)으로 코드가 계산합니다.
 * (AI가 숫자를 직접 세지 않으므로 같은 기록이면 항상 같은 값)
 */

/** 말 속도 참고 범위(음절/분). 일반적인 발표 말하기 기준의 대략적인 값이며 개인차가 큽니다. */
export const PACE_REFERENCE = { min: 240, max: 320 } as const;

/** 항상 군말로 보는 말 */
const STRONG_FILLERS = new Set(["음", "으음", "음음", "어", "어어", "엄", "흠", "으"]);
/** 뒤에 쉼표·말줄임표가 올 때만 군말로 보는 말 ("그 학생"의 '그'는 제외) */
const WEAK_FILLERS = new Set(["그", "저", "아", "에"]);
/** 습관적으로 반복되기 쉬운 말 (실제 의미로 쓴 경우도 포함될 수 있어 '후보'로 표시) */
export const HABIT_WORDS = new Set(["이제", "약간", "그냥", "뭐", "막", "사실", "그러니까", "진짜", "일단"]);

const LONG_PAUSE_SEC = 3;

export interface WordHit {
  word: string;
  start: number;
  end: number;
  kind: "filler" | "habit";
}

/** 문장에서 군말·말버릇 후보 위치 찾기 (하이라이트용) */
export function findSpeechHabits(text: string): WordHit[] {
  const hits: WordHit[] = [];
  for (const m of text.matchAll(/[가-힣]+/g)) {
    const word = m[0];
    const start = m.index ?? 0;
    const end = start + word.length;
    const after = text.slice(end, end + 2);
    if (STRONG_FILLERS.has(word) || (WEAK_FILLERS.has(word) && /^(\s*[,…~]|\.\.)/.test(after))) {
      hits.push({ word, start, end, kind: "filler" });
    } else if (HABIT_WORDS.has(word)) {
      hits.push({ word, start, end, kind: "habit" });
    }
  }
  return hits;
}

export function countSyllables(text: string): number {
  return (text.match(/[가-힣0-9]/g) ?? []).length;
}

interface Timed extends TranscriptChunk {
  s: number;
  e: number;
  dur: number;
  syllables: number;
  hits: WordHit[];
}

export interface SpeechMetrics {
  chunkCount: number;
  /** 말한 시간 합계(초) — 발화 항목 길이의 합 */
  speakingSec: number;
  syllables: number;
  /** 말하는 동안의 분당 음절 수 (말한 시간이 너무 짧으면 null) */
  syllablesPerMin: number | null;
  fastSegments: { start: string; end: string; spm: number; text: string }[];
  fillerTotal: number;
  fillerPerMin: number | null;
  fillerWords: { word: string; count: number }[];
  /** 군말이 많았던 발화 (2회 이상, 많은 순 최대 3개) */
  fillerHotspots: { start: string; count: number; text: string }[];
  habitWords: { word: string; count: number }[];
  /** 3초 이상 끊긴 구간 (시간순) */
  pauses: { at: string; sec: number }[];
}

const tally = (words: string[]) =>
  [...words.reduce((m, w) => m.set(w, (m.get(w) ?? 0) + 1), new Map<string, number>())]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);

export function computeSpeechMetrics(transcript: TranscriptChunk[] | undefined): SpeechMetrics | null {
  if (!transcript || transcript.length === 0) return null;
  const chunks: Timed[] = transcript
    .map((c) => {
      const s = parseTimestamp(c.start);
      const e = parseTimestamp(c.end);
      return { ...c, s, e, dur: Math.max(1, e - s), syllables: countSyllables(c.text), hits: findSpeechHabits(c.text) };
    })
    .sort((a, b) => a.s - b.s);

  const speakingSec = chunks.reduce((sum, c) => sum + c.dur, 0);
  const syllables = chunks.reduce((sum, c) => sum + c.syllables, 0);
  const spm = speakingSec >= 10 ? (syllables / speakingSec) * 60 : null;

  // 눈에 띄게 빨라진 발화: 전체 평균의 1.2배 이상이면서 참고 범위 상한을 넘는 6초 이상 발화
  const fastSegments =
    spm === null
      ? []
      : chunks
          .filter((c) => c.dur >= 6 && c.syllables >= 15)
          .map((c) => ({ start: c.start, end: c.end, spm: (c.syllables / c.dur) * 60, text: c.text }))
          .filter((c) => c.spm >= Math.max(spm * 1.2, PACE_REFERENCE.max))
          .sort((a, b) => b.spm - a.spm)
          .slice(0, 3);

  const fillers = chunks.flatMap((c) => c.hits.filter((h) => h.kind === "filler").map((h) => h.word));
  const habits = chunks.flatMap((c) => c.hits.filter((h) => h.kind === "habit").map((h) => h.word));
  const minutes = speakingSec / 60;

  const pauses: SpeechMetrics["pauses"] = [];
  for (let i = 1; i < chunks.length; i++) {
    const gap = chunks[i].s - chunks[i - 1].e;
    if (gap >= LONG_PAUSE_SEC) pauses.push({ at: formatSeconds(chunks[i - 1].e), sec: gap });
  }

  return {
    chunkCount: chunks.length,
    speakingSec,
    syllables,
    syllablesPerMin: spm,
    fastSegments,
    fillerTotal: fillers.length,
    fillerPerMin: minutes >= 0.5 ? fillers.length / minutes : null,
    fillerWords: tally(fillers),
    fillerHotspots: chunks
      .map((c) => ({ start: c.start, count: c.hits.filter((h) => h.kind === "filler").length, text: c.text }))
      .filter((c) => c.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3),
    habitWords: tally(habits).filter((h) => h.count >= 2),
    pauses,
  };
}
