import { resolveDuration, targetSize, waitForEvent } from "@/lib/video";

export interface CaptureResult {
  frames: Uint8Array[];
  width: number;
  height: number;
  durationSec: number;
}

const abortError = () => new DOMException("작업이 취소되었습니다.", "AbortError");

/**
 * 브라우저의 기본(하드웨어) 디코더로 1초마다 한 장씩 프레임을 캡처합니다.
 * ffmpeg.wasm으로 전체를 디코딩하는 것보다 훨씬 빠르고, 키프레임 간격과 무관하게 정확한 시점을 얻습니다.
 * 프레임 i 는 원본 영상의 i초 장면 → 분석 영상의 타임스탬프가 원본과 그대로 일치합니다.
 */
export async function captureFrames(
  file: File,
  opts: {
    durationSec: number;
    signal: AbortSignal;
    onProgress: (done: number, total: number) => void;
    quality?: number;
  },
): Promise<CaptureResult> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  // 화면 밖에 붙여 둬야 일부 브라우저에서 디코딩이 멈추지 않습니다.
  Object.assign(video.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: "2px",
    height: "2px",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(video);

  try {
    video.src = url;
    const ready = await waitForEvent(video, ["loadeddata", "error"], 20000);
    if (ready !== "loadeddata") throw new Error("브라우저에서 영상을 열지 못했습니다.");

    const durationSec = (await resolveDuration(video)) ?? opts.durationSec;
    const { width, height } = targetSize(video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("캔버스를 만들 수 없습니다.");

    const total = Math.max(1, Math.ceil(durationSec));
    const frames: Uint8Array[] = [];
    for (let i = 0; i < total; i++) {
      if (opts.signal.aborted) throw abortError();
      const t = Math.min(i, Math.max(0, durationSec - 0.05));
      if (Math.abs(video.currentTime - t) > 0.001 || video.readyState < 2) {
        const seeked = waitForEvent(video, ["seeked", "error"], 10000);
        video.currentTime = t;
        if ((await seeked) === "error") throw new Error(`${i}초 지점을 읽지 못했습니다.`);
      }
      ctx.drawImage(video, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", opts.quality ?? 0.8));
      if (!blob) throw new Error("프레임 이미지를 만들지 못했습니다.");
      frames.push(new Uint8Array(await blob.arrayBuffer()));
      opts.onProgress(i + 1, total);
    }
    return { frames, width, height, durationSec };
  } finally {
    video.remove();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
