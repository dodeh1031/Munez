"use client";

import { useState } from "react";
import clsx from "clsx";
import { AudioLines, ScrollText, Search } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { TimestampButton } from "@/components/report/TimestampButton";
import { formatSeconds } from "@/lib/format";
import type { EvalMode, TranscriptChunk } from "@/lib/schema/report";
import { PACE_REFERENCE, computeSpeechMetrics, findSpeechHabits } from "@/lib/speech";

const METER = { min: 150, max: 420 };

function paceLabel(spm: number) {
  if (spm > PACE_REFERENCE.max) return "빠른 편";
  if (spm < PACE_REFERENCE.min) return "느린 편";
  return "참고 범위 안";
}

/** 말하기 지표: 말 속도·군말·말버릇 후보·긴 멈춤 (발화 기록으로 계산) */
export function SpeechMetricsCard({
  transcript,
  mode,
  durationSec,
}: {
  transcript: TranscriptChunk[] | undefined;
  mode: EvalMode;
  durationSec: number | null;
}) {
  const m = computeSpeechMetrics(transcript);
  if (!m) {
    return (
      <Card>
        <CardHeader icon={AudioLines} title="말하기 지표" description="말 속도 · 군말 · 말버릇 · 멈춤" />
        <p className="px-5 py-6 text-sm text-slate-500">
          이 리포트에는 발화 기록이 없어요. 이전 버전에서 분석한 기록이거나, 영상에 말소리가 없었을 수 있어요.
        </p>
      </Card>
    );
  }
  const spm = m.syllablesPerMin;
  const pos = (v: number) => `${((Math.min(METER.max, Math.max(METER.min, v)) - METER.min) / (METER.max - METER.min)) * 100}%`;

  return (
    <Card>
      <CardHeader icon={AudioLines} title="말하기 지표" description="AI가 받아 적은 발화 기록으로 계산한 값" />
      <div className="grid gap-px bg-slate-100 sm:grid-cols-2">
        <Tile label="말 속도">
          {spm !== null ? (
            <>
              <p>
                <b className="text-2xl">{Math.round(spm)}</b>
                <span className="text-sm text-slate-500"> 음절/분 · {paceLabel(spm)}</span>
              </p>
              {/* 참고 범위 띠와 현재 위치 */}
              <div className="relative mt-3 h-2 rounded-full bg-slate-100" aria-hidden>
                <span
                  className="absolute inset-y-0 rounded-full bg-slate-300"
                  style={{ left: pos(PACE_REFERENCE.min), width: `calc(${pos(PACE_REFERENCE.max)} - ${pos(PACE_REFERENCE.min)})` }}
                />
                <span
                  className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#2a78d6]"
                  style={{ left: pos(spm) }}
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                회색 띠: 일반적인 발표 말하기 참고 범위 {PACE_REFERENCE.min}~{PACE_REFERENCE.max}음절/분 (개인차 큼)
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">말한 시간이 짧아 계산하지 않았어요.</p>
          )}
        </Tile>
        <Tile label="군말 (음 · 어 · 그… 등)">
          <p>
            <b className="text-2xl">{m.fillerTotal}</b>
            <span className="text-sm text-slate-500">
              회{m.fillerPerMin !== null && ` · 말하는 1분당 ${m.fillerPerMin.toFixed(1)}회`}
            </span>
          </p>
          {m.fillerWords.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {m.fillerWords.map((w) => (
                <span key={w.word} className="rounded-md bg-amber-50 px-1.5 py-0.5 text-amber-900 ring-1 ring-amber-200">
                  {w.word} {w.count}
                </span>
              ))}
            </p>
          )}
        </Tile>
        <Tile label="3초 이상 멈춤">
          <p>
            <b className="text-2xl">{m.pauses.length}</b>
            <span className="text-sm text-slate-500">회</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {mode === "demo"
              ? "핵심 발문 뒤 기다림이라면 좋은 멈춤이에요. 영상으로 확인해 보세요."
              : "답을 떠올리느라 멈춘 곳인지 영상으로 확인해 보세요."}
          </p>
        </Tile>
        <Tile label="말한 시간">
          <p>
            <b className="text-2xl tabular-nums">{formatSeconds(m.speakingSec)}</b>
            {durationSec !== null && (
              <span className="text-sm text-slate-500">
                {" "}
                / 영상 {formatSeconds(durationSec)} ({Math.round(Math.min(1, m.speakingSec / durationSec) * 100)}%)
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500">발화 {m.chunkCount}개 · 약 {m.syllables.toLocaleString()}음절</p>
        </Tile>
      </div>

      <div className="divide-y divide-slate-100 border-t border-slate-100">
        {m.fastSegments.length > 0 && (
          <Section title="말이 빨라진 구간">
            {m.fastSegments.map((f) => (
              <Row key={f.start} at={f.start} badge={`${Math.round(f.spm)}음절/분`} text={f.text} />
            ))}
          </Section>
        )}
        {m.fillerHotspots.length > 0 && (
          <Section title="군말이 많았던 발화">
            {m.fillerHotspots.map((h) => (
              <Row key={h.start} at={h.start} badge={`군말 ${h.count}회`} text={h.text} highlight />
            ))}
          </Section>
        )}
        {m.habitWords.length > 0 && (
          <Section title="자주 쓴 말버릇 후보">
            <p className="flex flex-wrap gap-1.5">
              {m.habitWords.map((h) => (
                <span key={h.word} className="rounded-md bg-slate-100 px-2 py-0.5 text-sm text-slate-700">
                  &ldquo;{h.word}&rdquo; {h.count}회
                </span>
              ))}
            </p>
            <p className="text-xs text-slate-500">실제 뜻으로 쓴 경우도 포함될 수 있어요. 발화 기록에서 밑줄로 확인하세요.</p>
          </Section>
        )}
        {m.pauses.length > 0 && (
          <Section title="긴 멈춤 위치">
            <p className="flex flex-wrap gap-1.5">
              {m.pauses.slice(0, 10).map((p) => (
                <span key={p.at} className="inline-flex items-center gap-1 text-xs text-slate-600">
                  <TimestampButton start={p.at} /> {Math.round(p.sec)}초
                </span>
              ))}
              {m.pauses.length > 10 && <span className="self-center text-xs text-slate-400">외 {m.pauses.length - 10}곳</span>}
            </p>
          </Section>
        )}
      </div>

      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
        AI가 받아 적은 발화를 바탕으로 한 추정치예요. 받아쓰기 정확도에 따라 실제와 조금 다를 수 있어요.
        {mode === "demo" && " 특수교육대상학생에게는 참고 범위보다 천천히, 또박또박 말하는 것이 좋을 수 있어요."}
      </p>
    </Card>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white px-5 py-4">
      <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 px-5 py-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function Row({ at, badge, text, highlight }: { at: string; badge: string; text: string; highlight?: boolean }) {
  return (
    <div className="flex flex-wrap items-start gap-2 text-sm">
      <TimestampButton start={at} />
      <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{badge}</span>
      <p className="min-w-0 flex-1 leading-relaxed text-slate-700">{highlight ? <Highlighted text={text} /> : text}</p>
    </div>
  );
}

/** 군말(노란 배경)·말버릇 후보(점선 밑줄) 표시. 검색어가 있으면 검색어만 표시 */
export function Highlighted({ text, query = "" }: { text: string; query?: string }) {
  const q = query.trim();
  if (q) {
    const parts: React.ReactNode[] = [];
    const lower = text.toLowerCase();
    const needle = q.toLowerCase();
    let i = 0;
    let k = 0;
    while (i < text.length) {
      const j = lower.indexOf(needle, i);
      if (j < 0) {
        parts.push(text.slice(i));
        break;
      }
      if (j > i) parts.push(text.slice(i, j));
      parts.push(
        <mark key={k++} className="rounded bg-indigo-100 px-0.5 text-indigo-900">
          {text.slice(j, j + needle.length)}
        </mark>,
      );
      i = j + needle.length;
    }
    return <>{parts}</>;
  }
  const hits = findSpeechHabits(text);
  const parts: React.ReactNode[] = [];
  let i = 0;
  hits.forEach((h, k) => {
    if (h.start > i) parts.push(text.slice(i, h.start));
    parts.push(
      h.kind === "filler" ? (
        <mark key={k} className="rounded bg-amber-100 px-0.5 text-amber-900">
          {text.slice(h.start, h.end)}
        </mark>
      ) : (
        <span key={k} className="underline decoration-slate-400 decoration-dotted underline-offset-4">
          {text.slice(h.start, h.end)}
        </span>
      ),
    );
    i = h.end;
  });
  if (i < text.length) parts.push(text.slice(i));
  return <>{parts}</>;
}

/** 발화 기록 전체 (검색 가능, 타임스탬프로 영상 이동) */
export function TranscriptCard({ transcript }: { transcript: TranscriptChunk[] | undefined }) {
  const [query, setQuery] = useState("");
  if (!transcript || transcript.length === 0) return null;
  const q = query.trim().toLowerCase();
  const shown = q ? transcript.filter((c) => c.text.toLowerCase().includes(q)) : transcript;

  return (
    <Card>
      <CardHeader
        icon={ScrollText}
        title="발화 기록"
        description="AI가 들리는 그대로 받아 적은 내용 · 만능틀 표현을 검색해 보세요"
      />
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3 print:hidden">
        <label className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <span className="sr-only">발화 기록 검색</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="예: 알겠죠, 노력하겠습니다"
            className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </label>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          <mark className="rounded bg-amber-100 px-1 text-amber-900">군말</mark>
          <span className="underline decoration-slate-400 decoration-dotted underline-offset-4">말버릇 후보</span>
          <span>
            {q ? `${shown.length}개 찾음` : `발화 ${transcript.length}개`}
          </span>
        </span>
      </div>
      <ol className="divide-y divide-slate-50">
        {shown.map((c, i) => (
          <li key={`${c.start}-${i}`} className={clsx("flex gap-3 px-5 py-2.5 text-sm")}>
            <TimestampButton start={c.start} />
            <p className="min-w-0 flex-1 leading-relaxed text-slate-700">
              <Highlighted text={c.text} query={query} />
            </p>
          </li>
        ))}
        {shown.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-400">찾는 표현이 없어요.</li>}
      </ol>
    </Card>
  );
}
