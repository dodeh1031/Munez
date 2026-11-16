"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { CircleAlert, FileVideo, LoaderCircle, Trash2, Upload } from "lucide-react";
import { MAX_VIDEO_SECONDS } from "@/lib/constants";
import { formatBytes, formatSeconds } from "@/lib/format";
import { useSessionStore } from "@/lib/store";
import { isAcceptedVideo, readVideoDuration } from "@/lib/video";

export function VideoDropzone() {
  const video = useSessionStore((s) => s.video);
  const setVideo = useSessionStore((s) => s.setVideo);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setWarning(null);
    if (!isAcceptedVideo(file)) {
      setError("mp4, mov, webm 형식의 영상만 업로드할 수 있어요.");
      return;
    }
    setChecking(true);
    const durationSec = await readVideoDuration(file);
    setChecking(false);
    if (durationSec !== null && durationSec > MAX_VIDEO_SECONDS + 1) {
      setError(`영상이 ${formatSeconds(durationSec)}로 최대 15분을 넘어요. 잘라서 다시 올려 주세요.`);
      return;
    }
    if (durationSec === null) {
      setWarning("이 브라우저에서 영상 길이를 읽지 못했어요(코덱 문제일 수 있음). 분석 전 압축 단계에서 다시 확인합니다.");
    }
    setVideo({ file, durationSec, source: "upload" });
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
      className="sr-only"
      tabIndex={-1}
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) void handleFile(file);
        e.target.value = "";
      }}
    />
  );

  if (video && video.source === "upload") {
    return (
      <div className="space-y-3">
        {fileInput}
        <video src={video.url} controls playsInline className="aspect-video w-full rounded-xl bg-slate-900" />
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5">
          <FileVideo className="size-5 shrink-0 text-indigo-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{video.file.name}</p>
            <p className="text-xs text-slate-500">
              {formatBytes(video.file.size)}
              {video.durationSec !== null && ` · ${formatSeconds(video.durationSec)}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
          >
            교체
          </button>
          <button
            type="button"
            onClick={() => setVideo(null)}
            aria-label="영상 삭제"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
        {warning && <Notice tone="warn">{warning}</Notice>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {fileInput}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          dragDepth.current += 1;
          setIsDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => {
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragDepth.current = 0;
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        disabled={checking}
        className={clsx(
          "flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 text-center transition-colors",
          isDragging
            ? "border-indigo-500 bg-indigo-50 text-indigo-700"
            : "border-slate-300 bg-slate-50/60 text-slate-600 hover:border-indigo-400 hover:bg-indigo-50/40",
        )}
      >
        {checking ? (
          <LoaderCircle className="size-8 animate-spin text-indigo-500" aria-hidden />
        ) : (
          <span className="grid size-12 place-items-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
            <Upload className="size-5 text-indigo-600" aria-hidden />
          </span>
        )}
        <span>
          <span className="block font-medium text-slate-800">
            {checking ? "영상 정보를 확인하는 중…" : "영상을 끌어다 놓거나 클릭해서 선택"}
          </span>
          <span className="mt-1 block text-xs text-slate-500">MP4 · MOV · WebM / 최대 15분</span>
        </span>
      </button>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

function Notice({ tone, children }: { tone: "error" | "warn"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={clsx(
        "flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
        tone === "error" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800",
      )}
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      {children}
    </p>
  );
}
