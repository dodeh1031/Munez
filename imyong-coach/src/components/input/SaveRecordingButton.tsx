"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, Download, LoaderCircle } from "lucide-react";
import { getSyncFolderHandle } from "@/lib/history/folderSync";
import { saveFileToComputer } from "@/lib/saveFile";
import { useSessionStore } from "@/lib/store";

/**
 * 웹캠 녹화 원본 저장 버튼 (웹캠으로 녹화한 영상이 있을 때만 보임)
 * 원본은 브라우저 메모리에만 있어 새로고침하면 사라지므로 보관하려면 저장해야 합니다.
 * (기록에는 분석용 압축본만 남음)
 */
export function SaveRecordingButton({ className }: { className?: string }) {
  const video = useSessionStore((s) => s.video);
  const saved = useSessionStore((s) => s.videoSaved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!video || video.source !== "webcam") return null;
  const file = video.file;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const result = await saveFileToComputer(file, file.name, {
        startIn: getSyncFolderHandle(),
        description: "녹화 영상",
      });
      if (result !== "cancelled") useSessionStore.getState().setVideoSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        title="녹화 원본을 내 컴퓨터(드라이브 폴더 등)에 저장해요. 새로고침하거나 창을 닫으면 원본은 사라져요."
        className={clsx(
          "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 disabled:opacity-60",
          saved
            ? "text-emerald-700 ring-emerald-200 hover:bg-emerald-50"
            : "bg-indigo-600 text-white ring-indigo-600 hover:bg-indigo-700",
          className,
        )}
      >
        {busy ? (
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
        ) : saved ? (
          <Check className="size-3.5" aria-hidden />
        ) : (
          <Download className="size-3.5" aria-hidden />
        )}
        {saved ? "녹화 영상 저장됨" : "녹화 영상 저장"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-rose-600">
          저장하지 못했어요: {error}
        </span>
      )}
    </span>
  );
}
