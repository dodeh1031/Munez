"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowDown, ArrowUp, Download, FileJson, FolderOpen, History, Minus, Trash2, Upload, Video } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { ScoreTrendChart, Sparkline } from "@/components/history/ScoreTrendChart";
import { MODE_META } from "@/lib/constants";
import { formatBytes, formatSeconds } from "@/lib/format";
import { storageUsage } from "@/lib/history/db";
import { downloadHistoryFile, parseHistoryFile } from "@/lib/history/files";
import { useHistoryStore } from "@/lib/history/store";
import type { HistoryRecord } from "@/lib/history/types";
import { openRecord } from "@/lib/history/viewer";
import { SCORE_MAX, TONE_CLASS, areaAverage, getRubric, overallScore, toneFor100 } from "@/lib/rubrics";
import { EVAL_MODES, type EvalMode } from "@/lib/schema/report";
import { selfOverall } from "@/lib/selfScore";

const fmtDate = (iso: string) => new Date(iso).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
const fmtShort = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

function Delta({ value, digits = 0, unit = "" }: { value: number; digits?: number; unit?: string }) {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-slate-500">
        <Minus className="size-3" aria-hidden /> 변화 없음
      </span>
    );
  }
  const up = rounded > 0;
  return (
    <span className={clsx("inline-flex items-center gap-0.5 font-medium", up ? "text-emerald-700" : "text-rose-600")}>
      {up ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
      {up ? "+" : ""}
      {rounded.toFixed(digits)}
      {unit}
      <span className="sr-only">{up ? " 상승" : " 하락"}</span>
    </span>
  );
}

export function HistoryPage() {
  const router = useRouter();
  const records = useHistoryStore((s) => s.records);
  const status = useHistoryStore((s) => s.status);
  const error = useHistoryStore((s) => s.error);
  const [modeChoice, setModeChoice] = useState<EvalMode | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void useHistoryStore.getState().load();
  }, []);

  useEffect(() => {
    let alive = true;
    void storageUsage().then((u) => {
      if (alive) setUsage(u);
    });
    return () => {
      alive = false;
    };
  }, [records.length]);

  // 기본 탭: 가장 최근 기록의 모드
  const mode: EvalMode = modeChoice ?? records.at(-1)?.mode ?? "demo";
  const rubric = getRubric(mode);
  const list = records.filter((r) => r.mode === mode);
  const rows = list.map((record, i) => ({
    record,
    round: i + 1,
    overall: overallScore(rubric, record.report.scores),
    areas: rubric.areas.map((a) => areaAverage(a, record.report.scores)),
  }));
  const first = rows[0];
  const latest = rows.at(-1);
  const best = rows.reduce<number | null>((m, r) => (m === null || r.overall > m ? r.overall : m), null);

  async function handleOpen(id: string) {
    if (await openRecord(id)) router.push("/report");
  }

  async function handleDelete(r: HistoryRecord) {
    if (!window.confirm(`${fmtDate(r.createdAt)} 기록("${r.title}")을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    try {
      await useHistoryStore.getState().remove(r.id);
      setNotice({ tone: "ok", text: "기록을 삭제했어요." });
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : String(err) });
    }
  }

  async function handleImport(file: File) {
    try {
      const imported = parseHistoryFile(await file.text());
      const { added, skipped } = await useHistoryStore.getState().addMany(imported);
      setNotice({
        tone: "ok",
        text: `${added}개 기록을 불러왔어요${skipped ? ` (이미 있는 ${skipped}개는 건너뜀)` : ""}. 가져온 기록에는 영상이 포함되지 않아요.`,
      });
      if (added > 0) setModeChoice(imported.at(-1)?.mode ?? null);
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">분석 기록</h1>
          <p className="mt-2 text-slate-600">
            이 컴퓨터의 브라우저에 저장된 분석 결과입니다. 학교·집 컴퓨터 사이에서는 JSON 백업으로 옮길 수 있어요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImport(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            className="flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
          >
            <Upload className="size-4" aria-hidden /> 기록 불러오기
          </button>
          <button
            type="button"
            disabled={records.length === 0}
            onClick={() => downloadHistoryFile(records, "imyong-history")}
            className="flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="size-4" aria-hidden /> 전체 백업 ({records.length})
          </button>
        </div>
      </div>

      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={clsx(
            "mb-4 rounded-xl px-4 py-3 text-sm",
            notice.tone === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-800",
          )}
        >
          {notice.text}
        </p>
      )}

      {status === "error" && (
        <p role="alert" className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          기록을 불러오지 못했어요: {error}
        </p>
      )}

      {status !== "ready" && status !== "error" ? (
        <p className="py-16 text-center text-sm text-slate-500">기록을 불러오는 중…</p>
      ) : records.length === 0 ? (
        <Card className="px-6 py-16 text-center">
          <History className="mx-auto size-10 text-slate-300" aria-hidden />
          <p className="mt-3 font-semibold">아직 저장된 기록이 없어요</p>
          <p className="mt-1 text-sm text-slate-500">
            AI 분석이 끝나면 자동으로 여기에 저장됩니다. 다른 컴퓨터에서 만든 백업 파일은 &lsquo;기록 불러오기&rsquo;로 가져올 수 있어요.
          </p>
          <Link href="/" className="mt-5 inline-block rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            새 분석 시작하기
          </Link>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* 필터는 차트 위 한 줄: 아래 모든 카드에 적용 */}
          <Tabs
            tabs={EVAL_MODES.map((m) => ({ id: m, label: MODE_META[m].label, count: records.filter((r) => r.mode === m).length }))}
            value={mode}
            onChange={setModeChoice}
            label="평가 모드"
            idPrefix="history"
          />

          <div role="tabpanel" id="history-panel" aria-labelledby={`history-tab-${mode}`} className="space-y-6">
            {rows.length === 0 ? (
              <Card className="px-6 py-12 text-center text-sm text-slate-500">
                {MODE_META[mode].label} 기록이 아직 없어요.
              </Card>
            ) : (
              <>
                <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                  <Card>
                    <CardHeader
                      title="종합 점수 변화"
                      description={`${MODE_META[mode].label} · 회차별 100점 환산 점수`}
                    />
                    <div className="flex flex-wrap gap-x-6 gap-y-1 px-5 pt-4 text-sm">
                      <span className="text-slate-500">
                        최근 <b className="text-lg text-slate-900">{latest?.overall}</b>점
                      </span>
                      {rows.length > 1 && first && latest && (
                        <span className="text-slate-500">
                          첫 회 대비 <Delta value={latest.overall - first.overall} unit="점" />
                        </span>
                      )}
                      <span className="text-slate-500">
                        최고 <b className="text-slate-900">{best}</b>점
                      </span>
                      <span className="text-slate-500">
                        총 <b className="text-slate-900">{rows.length}</b>회
                      </span>
                    </div>
                    <div className="px-3 pb-4 pt-2">
                      <ScoreTrendChart
                        points={rows.map((r) => ({
                          id: r.record.id,
                          score: r.overall,
                          dateLabel: fmtShort(r.record.createdAt),
                          title: r.record.title,
                        }))}
                        onOpen={(id) => void handleOpen(id)}
                      />
                      {rows.length === 1 && (
                        <p className="px-2 text-xs text-slate-500">기록이 2회 이상 쌓이면 변화 추이가 선으로 그려져요.</p>
                      )}
                    </div>
                  </Card>

                  <Card>
                    <CardHeader title="영역별 변화" description={`영역 점수(${SCORE_MAX}점 만점) · 첫 회 → 최근`} />
                    <table className="w-full text-sm">
                      <thead className="sr-only">
                        <tr>
                          <th>영역</th>
                          <th>추세</th>
                          <th>최근 점수</th>
                          <th>첫 회 대비</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rubric.areas.map((area, ai) => {
                          const values = rows.map((r) => r.areas[ai]);
                          const now = values.at(-1) ?? 0;
                          return (
                            <tr key={area.id}>
                              <th scope="row" className="px-5 py-3 text-left font-medium">
                                {area.label}
                              </th>
                              <td className="py-3">
                                <Sparkline
                                  values={values}
                                  max={SCORE_MAX}
                                  label={`${area.label} 변화: ${values.map((v) => v.toFixed(1)).join(" → ")}`}
                                />
                              </td>
                              <td className="py-3 text-right tabular-nums">
                                <b>{now.toFixed(1)}</b>
                              </td>
                              <td className="px-5 py-3 text-right text-xs tabular-nums">
                                {values.length > 1 ? <Delta value={now - values[0]} digits={1} /> : <span className="text-slate-300">–</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </Card>
                </div>

                <Card>
                  <CardHeader title="기록 목록" description="최근 기록부터 · 열면 리포트와 타임스탬프 이동을 다시 볼 수 있어요" />
                  <ol className="divide-y divide-slate-100">
                    {[...rows].reverse().map(({ record, round, overall }) => {
                      const grade = toneFor100(overall);
                      return (
                        <li key={record.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                          <span className="w-10 shrink-0 text-sm font-semibold text-slate-400">{round}회</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{record.title}</p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                              <span>{fmtDate(record.createdAt)}</span>
                              {record.durationSec !== null && <span>· 영상 {formatSeconds(record.durationSec)}</span>}
                              {record.hasVideo && (
                                <span className="inline-flex items-center gap-0.5">
                                  · <Video className="size-3" aria-hidden /> 영상 저장됨
                                </span>
                              )}
                              {record.source === "imported" && <span>· 가져온 기록</span>}
                            </p>
                          </div>
                          {record.selfScore?.mode === record.mode && (
                            <span className="shrink-0 text-xs text-slate-500" title="자기 채점 종합 점수">
                              나 <b className="tabular-nums text-slate-700">{selfOverall(rubric, record.selfScore)}</b>
                            </span>
                          )}
                          <span className="w-24 shrink-0 text-right">
                            <b className="text-lg tabular-nums">{overall}</b>
                            <span className="text-sm text-slate-400">점 </span>
                            <span className={clsx("text-xs font-semibold", TONE_CLASS[grade.tone].text)}>{grade.label}</span>
                          </span>
                          <div className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              onClick={() => void handleOpen(record.id)}
                              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                            >
                              <FolderOpen className="size-3.5" aria-hidden /> 열기
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadHistoryFile([record], `imyong-report-${record.mode}`)}
                              aria-label={`${round}회 기록 JSON 내보내기`}
                              title="JSON 내보내기"
                              className="rounded-lg p-1.5 text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
                            >
                              <FileJson className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(record)}
                              aria-label={`${round}회 기록 삭제`}
                              title="삭제"
                              className="rounded-lg p-1.5 text-slate-400 ring-1 ring-slate-200 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </Card>
              </>
            )}
          </div>

          <p className="text-xs text-slate-500">
            기록은 이 컴퓨터의 이 브라우저에만 저장돼요. 브라우저 방문 기록·사이트 데이터를 지우면 함께 지워지니 가끔
            &lsquo;전체 백업&rsquo;을 해 두세요.
            {usage && ` (현재 사용량 약 ${formatBytes(usage.usage)})`}
          </p>
        </div>
      )}
    </div>
  );
}
