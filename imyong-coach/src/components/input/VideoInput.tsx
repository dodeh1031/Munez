"use client";

import { useState } from "react";
import clsx from "clsx";
import { Camera, Upload } from "lucide-react";
import type { VideoSource } from "@/lib/store";
import { VideoDropzone } from "@/components/input/VideoDropzone";
import { WebcamRecorder } from "@/components/input/WebcamRecorder";

const TABS: { id: VideoSource; label: string; icon: typeof Upload }[] = [
  { id: "upload", label: "파일 업로드", icon: Upload },
  { id: "webcam", label: "웹캠 녹화", icon: Camera },
];

export function VideoInput() {
  const [tab, setTab] = useState<VideoSource>("upload");

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="영상 입력 방식" className="inline-flex rounded-lg bg-slate-100 p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`video-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`video-panel-${id}`}
            onClick={() => setTab(id)}
            className={clsx(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`video-panel-${tab}`} aria-labelledby={`video-tab-${tab}`}>
        {tab === "upload" ? <VideoDropzone /> : <WebcamRecorder />}
      </div>
    </div>
  );
}
