import { timeStamp } from "@/lib/format";
import type { AnalysisMeta } from "@/lib/gemini/events";
import {
  HISTORY_FILE_APP,
  historyFileSchema,
  historyRecordSchema,
  legacyReportFileSchema,
  type HistoryRecord,
} from "@/lib/history/types";
import type { AnalysisReport, EvalMode } from "@/lib/schema/report";
import type { SelfScore } from "@/lib/selfScore";
import type { TimeLimits } from "@/lib/timeLimits";

export function newRecord(input: {
  mode: EvalMode;
  title: string;
  promptText: string;
  durationSec: number | null;
  timeLimits?: TimeLimits | null;
  report: AnalysisReport;
  meta: AnalysisMeta | null;
  selfScore?: SelfScore | null;
}): HistoryRecord {
  return {
    id: crypto.randomUUID(),
    version: 1,
    createdAt: new Date().toISOString(),
    hasVideo: false,
    source: "local",
    ...input,
  };
}

/** 기록들을 JSON 파일로 내려받기 (영상은 포함하지 않음 — 다른 컴퓨터로 옮기기·백업용) */
export function downloadHistoryFile(records: HistoryRecord[], baseName: string) {
  const data = {
    app: HISTORY_FILE_APP,
    kind: "history",
    version: 1,
    exportedAt: new Date().toISOString(),
    records: records.map((r) => ({ ...r, hasVideo: false })),
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  // 일부 브라우저는 download 속성에 한글이 있으면 무시하므로 ASCII 이름 사용
  a.download = `${baseName}-${timeStamp()}.json`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** 백업 파일(또는 예전 '리포트 저장' 파일)을 읽어 기록 목록으로 변환 */
export function parseHistoryFile(text: string): HistoryRecord[] {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("JSON 파일을 읽지 못했습니다. 이 프로그램에서 저장한 파일인지 확인하세요.");
  }

  const legacy = legacyReportFileSchema.safeParse(json);
  if (legacy.success) {
    const l = legacy.data;
    return [
      {
        id: `legacy-${l.savedAt}-${l.report.mode}`,
        version: 1,
        createdAt: l.savedAt,
        mode: l.report.mode,
        title: l.video ?? "가져온 리포트",
        promptText: l.promptText ?? "",
        durationSec: null,
        report: l.report,
        meta: (l.meta as AnalysisMeta | undefined) ?? null,
        hasVideo: false,
        source: "imported",
      },
    ];
  }

  const file = historyFileSchema.safeParse(json);
  if (!file.success) throw new Error("이 프로그램의 기록 파일 형식이 아닙니다.");

  const records: HistoryRecord[] = [];
  let invalid = 0;
  for (const raw of file.data.records) {
    const r = historyRecordSchema.safeParse(raw);
    if (r.success) {
      records.push({ ...(r.data as Omit<HistoryRecord, "hasVideo" | "source">), hasVideo: false, source: "imported" });
    } else {
      invalid++;
    }
  }
  if (records.length === 0) throw new Error(`불러올 수 있는 기록이 없습니다${invalid ? ` (형식 오류 ${invalid}개)` : ""}.`);
  return records;
}
