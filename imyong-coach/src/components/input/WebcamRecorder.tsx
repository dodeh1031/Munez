"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Camera, CameraOff, Circle, LoaderCircle, Mic, RotateCcw, Square, Trash2, Video } from "lucide-react";
import { SaveRecordingButton } from "@/components/input/SaveRecordingButton";
import { useBeforeUnload } from "@/components/layout/UnloadGuard";
import { MAX_VIDEO_SECONDS } from "@/lib/constants";
import { formatBytes, formatSeconds, timeStamp } from "@/lib/format";
import { useSessionStore } from "@/lib/store";
import { fixInfiniteDuration } from "@/lib/video";

type Phase = "idle" | "requesting" | "preview" | "countdown" | "recording" | "saving";

// VP8을 먼저: VP9보다 CPU 부담이 적어 15분 녹화에도 프레임이 덜 떨어짐. Safari는 mp4로 녹화.
const MIME_CANDIDATES = ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm", "video/mp4"];

function pickMimeType(): string {
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

function describeError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "카메라·마이크 권한이 거부되었어요. 주소창 왼쪽 아이콘에서 권한을 허용한 뒤 다시 시도해 주세요.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "사용할 수 있는 카메라나 마이크를 찾지 못했어요.";
    case "NotReadableError":
    case "AbortError":
      return "다른 프로그램(줌, 팀즈 등)이 카메라를 쓰고 있는지 확인해 주세요.";
    default:
      return "카메라를 켜지 못했어요. 브라우저 권한과 장치 연결을 확인해 주세요.";
  }
}

/**
 * 브라우저 웹캠 직접 녹화 (MediaRecorder API)
 * 미리보기 → 3초 카운트다운 → 녹화(최대 15분 자동 정지) → 카메라 끄고 결과를 세션에 저장
 */
export function WebcamRecorder() {
  const video = useSessionStore((s) => s.video);
  const setVideo = useSessionStore((s) => s.setVideo);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);

  const previewRef = useRef<HTMLVideoElement>(null);
  const levelRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const meterRef = useRef<{ ctx: AudioContext; raf: number } | null>(null);

  const recorded = video?.source === "webcam" ? video : null;
  const videoSaved = useSessionStore((s) => s.videoSaved);

  // 녹화 중에 창을 닫거나 새로고침하면 녹화가 사라지므로 경고
  useBeforeUnload(phase === "countdown" || phase === "recording" || phase === "saving");

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => {
      clearTimeout(t);
      clearInterval(t);
    });
    timersRef.current = [];
  }, []);

  const stopDevices = useCallback(() => {
    if (meterRef.current) {
      cancelAnimationFrame(meterRef.current.raf);
      void meterRef.current.ctx.close().catch(() => {});
      meterRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // 화면에서 사라질 때(탭 전환, 다른 페이지로 이동해 <Activity>로 숨겨질 때) 카메라를 반드시 끕니다.
  // 녹화 중이었다면 지금까지 녹화한 내용은 저장됩니다(onstop).
  useEffect(() => {
    return () => {
      clearTimers();
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") rec.stop();
      else stopDevices();
      setPhase("idle");
    };
  }, [clearTimers, stopDevices]);

  // 미리보기 <video>에 스트림 연결
  useEffect(() => {
    const el = previewRef.current;
    const stream = streamRef.current;
    if (el && stream && el.srcObject !== stream) {
      el.srcObject = stream;
      void el.play().catch(() => {});
    }
  }, [phase]);

  function startMeter(stream: MediaStream) {
    if (stream.getAudioTracks().length === 0) return;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) sum += ((v - 128) / 128) ** 2;
      const level = Math.min(1, Math.sqrt(sum / data.length) * 4);
      if (levelRef.current) levelRef.current.style.transform = `scaleX(${level})`;
      if (meterRef.current) meterRef.current.raf = requestAnimationFrame(tick);
    };
    meterRef.current = { ctx, raf: requestAnimationFrame(tick) };
  }

  async function openCamera() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("이 브라우저에서는 웹캠 녹화를 쓸 수 없어요. 최신 Chrome·Edge·Safari에서 localhost로 접속해 주세요.");
      return;
    }
    setPhase("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      startMeter(stream);
      setPhase("preview");
    } catch (err) {
      setError(describeError(err));
      setPhase("idle");
    }
  }

  function closeCamera() {
    clearTimers();
    stopDevices();
    setPhase("idle");
  }

  function startCountdown() {
    setPhase("countdown");
    setCountdown(3);
    [1, 2].forEach((n) => timersRef.current.push(setTimeout(() => setCountdown(3 - n), n * 1000)));
    timersRef.current.push(setTimeout(beginRecording, 3000));
  }

  function cancelCountdown() {
    clearTimers();
    setPhase("preview");
  }

  function beginRecording() {
    const stream = streamRef.current;
    if (!stream) return;
    clearTimers();
    const mimeType = pickMimeType();
    const options: MediaRecorderOptions & { videoKeyFrameIntervalDuration?: number } = {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: 2_000_000,
      audioBitsPerSecond: 96_000,
      // 1초마다 키프레임 → 리포트에서 타임스탬프 이동이 빠름 (지원 브라우저만 적용)
      videoKeyFrameIntervalDuration: 1000,
    };
    const recorder = new MediaRecorder(stream, options);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => finalize(recorder);
    recorder.start(1000);
    recorderRef.current = recorder;
    startedAtRef.current = performance.now();
    setElapsed(0);
    setPhase("recording");

    timersRef.current.push(
      setInterval(() => {
        const sec = (performance.now() - startedAtRef.current) / 1000;
        setElapsed(sec);
        if (sec >= MAX_VIDEO_SECONDS) stopRecording();
      }, 250),
    );
  }

  function stopRecording() {
    clearTimers();
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      setPhase("saving");
      rec.stop();
    }
  }

  function finalize(recorder: MediaRecorder) {
    const durationSec = Math.min(MAX_VIDEO_SECONDS, (performance.now() - startedAtRef.current) / 1000);
    const settings = streamRef.current?.getVideoTracks()[0]?.getSettings();
    recorderRef.current = null;
    stopDevices();

    const type = recorder.mimeType || "video/webm";
    const blob = new Blob(chunksRef.current, { type });
    chunksRef.current = [];
    if (blob.size === 0) {
      setError("녹화된 데이터가 없어요. 다시 시도해 주세요.");
      setPhase("idle");
      return;
    }
    const ext = type.includes("mp4") ? "mp4" : "webm";
    const file = new File([blob], `webcam-${timeStamp()}.${ext}`, { type });
    setVideo({
      file,
      durationSec,
      source: "webcam",
      decodable: true,
      width: settings?.width ?? 1280,
      height: settings?.height ?? 720,
    });
    setPhase("idle");
  }

  function discard() {
    setVideo(null);
    setError(null);
  }

  /* ───────────── 렌더링 ───────────── */

  // 녹화 완료 상태
  if (recorded && phase === "idle") {
    return (
      <div className="space-y-3">
        <video
          src={recorded.url}
          onLoadedMetadata={fixInfiniteDuration}
          controls
          playsInline
          className="aspect-video w-full rounded-xl bg-slate-900"
        />
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5">
          <Video className="size-5 shrink-0 text-indigo-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{recorded.file.name}</p>
            <p className="text-xs text-slate-500">
              {formatBytes(recorded.file.size)}
              {recorded.durationSec !== null && ` · ${formatSeconds(recorded.durationSec)}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              discard();
              void openCamera();
            }}
            className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
          >
            <RotateCcw className="size-3.5" aria-hidden /> 다시 녹화
          </button>
          <button
            type="button"
            onClick={discard}
            aria-label="녹화 영상 삭제"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <SaveRecordingButton />
          {!videoSaved && (
            <p className="text-xs text-slate-500">
              녹화 원본은 새로고침하거나 창을 닫으면 사라져요. 보관하려면 저장하세요(기록에는 분석용 압축본만 남아요).
            </p>
          )}
        </div>
      </div>
    );
  }

  const live = phase === "preview" || phase === "countdown" || phase === "recording" || phase === "saving";
  const remaining = MAX_VIDEO_SECONDS - elapsed;

  return (
    <div className="space-y-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-900">
        {live ? (
          <>
            {/* 미리보기는 거울처럼 좌우 반전 (녹화 파일은 반전되지 않음) */}
            <video ref={previewRef} muted playsInline className="size-full -scale-x-100 object-cover" />

            {phase === "countdown" && (
              <div className="absolute inset-0 grid place-items-center bg-black/40">
                <span className="text-7xl font-bold text-white tabular-nums drop-shadow">{countdown}</span>
              </div>
            )}

            {(phase === "recording" || phase === "saving") && (
              <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-sm font-medium text-white">
                <span className={clsx("size-2.5 rounded-full bg-rose-500", phase === "recording" && "animate-pulse")} />
                <span className="font-mono tabular-nums">
                  {formatSeconds(elapsed)} <span className="opacity-60">/ {formatSeconds(MAX_VIDEO_SECONDS)}</span>
                </span>
              </div>
            )}

            {phase === "saving" && (
              <div className="absolute inset-0 grid place-items-center bg-black/50 text-white">
                <span className="flex items-center gap-2 text-sm">
                  <LoaderCircle className="size-4 animate-spin" aria-hidden /> 녹화 파일 저장 중…
                </span>
              </div>
            )}

            <div className="absolute inset-x-3 bottom-3 flex items-center gap-2" title="마이크 입력 크기">
              <Mic className="size-4 shrink-0 text-white drop-shadow" aria-hidden />
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/25">
                <div ref={levelRef} className="h-full origin-left scale-x-0 rounded-full bg-emerald-400 transition-transform duration-75" />
              </div>
            </div>
          </>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-3 px-6 text-center text-slate-300">
            {phase === "requesting" ? (
              <>
                <LoaderCircle className="size-7 animate-spin text-slate-400" aria-hidden />
                <span className="text-sm">카메라·마이크 권한을 요청하는 중…</span>
              </>
            ) : (
              <>
                <span className="grid size-12 place-items-center rounded-full bg-white/10">
                  <Camera className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block font-medium text-white">웹캠으로 바로 녹화</span>
                  <span className="mt-1 block text-xs text-slate-400">
                    정면을 보고, 얼굴이 밝게 보이도록 조명을 확인하세요 · 최대 15분 자동 정지
                  </span>
                </span>
                <button
                  type="button"
                  onClick={openCamera}
                  className="mt-1 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                >
                  카메라 켜기
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {phase === "preview" && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={startCountdown}
            className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
          >
            <Circle className="size-3.5 fill-current" aria-hidden /> 녹화 시작
          </button>
          <button
            type="button"
            onClick={closeCamera}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            <CameraOff className="size-4" aria-hidden /> 카메라 끄기
          </button>
          <span className="ml-auto text-xs text-slate-400">미리보기는 거울처럼 보여요</span>
        </div>
      )}

      {phase === "countdown" && (
        <button
          type="button"
          onClick={cancelCountdown}
          className="rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          카운트다운 취소
        </button>
      )}

      {phase === "recording" && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={stopRecording}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Square className="size-3.5 fill-current" aria-hidden /> 녹화 종료
            </button>
            <span className={clsx("text-xs", remaining < 60 ? "font-medium text-rose-600" : "text-slate-500")}>
              {remaining < 60 ? `${Math.ceil(remaining)}초 후 자동 종료` : `남은 시간 ${formatSeconds(remaining)}`}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-rose-500" style={{ width: `${(elapsed / MAX_VIDEO_SECONDS) * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
