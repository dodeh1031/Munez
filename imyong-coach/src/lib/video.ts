import { ACCEPTED_VIDEO_EXTENSIONS, ACCEPTED_VIDEO_TYPES } from "@/lib/constants";

export function isAcceptedVideo(file: File): boolean {
  if (ACCEPTED_VIDEO_TYPES.includes(file.type)) return true;
  const name = file.name.toLowerCase();
  return ACCEPTED_VIDEO_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export interface VideoProbe {
  /** 영상 길이(초). 읽지 못하면 null */
  durationSec: number | null;
  width: number;
  height: number;
  /** 이 브라우저가 실제로 프레임을 디코딩할 수 있는지 (false면 ffmpeg 호환 모드로 처리) */
  decodable: boolean;
}

/** events 중 하나가 발생하거나 timeoutMs가 지나면 그 이름("timeout")으로 resolve */
export function waitForEvent(target: EventTarget, events: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve) => {
    const done = (name: string) => {
      clearTimeout(timer);
      events.forEach((e) => target.removeEventListener(e, handlers[e]));
      resolve(name);
    };
    const handlers: Record<string, () => void> = {};
    events.forEach((e) => {
      handlers[e] = () => done(e);
      target.addEventListener(e, handlers[e]);
    });
    const timer = setTimeout(() => done("timeout"), timeoutMs);
  });
}

/**
 * MediaRecorder로 만든 WebM은 길이 정보가 없어 duration이 Infinity로 나옵니다.
 * 끝으로 한 번 탐색하면 브라우저가 실제 길이를 계산하므로 그 값을 읽습니다.
 */
export async function resolveDuration(video: HTMLVideoElement): Promise<number | null> {
  if (Number.isFinite(video.duration) && video.duration > 0) return video.duration;
  const toEnd = waitForEvent(video, ["durationchange", "seeked"], 5000);
  video.currentTime = Number.MAX_SAFE_INTEGER;
  await toEnd;
  const d = video.duration;
  const back = waitForEvent(video, ["seeked"], 5000);
  video.currentTime = 0;
  await back;
  return Number.isFinite(d) && d > 0 ? d : null;
}

/**
 * <video onLoadedMetadata> 핸들러: MediaRecorder WebM의 duration=Infinity를 실제 길이로 바로잡아
 * 재생바(탐색)가 정상 동작하게 합니다.
 */
export function fixInfiniteDuration(e: { currentTarget: HTMLVideoElement }) {
  const video = e.currentTarget;
  if (Number.isFinite(video.duration)) return;
  video.addEventListener(
    "durationchange",
    () => {
      video.currentTime = 0;
    },
    { once: true },
  );
  video.currentTime = Number.MAX_SAFE_INTEGER;
}

/** 브라우저 <video>로 영상 메타데이터와 디코딩 가능 여부를 확인합니다. */
export async function probeVideo(file: File, timeoutMs = 8000): Promise<VideoProbe> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  try {
    video.src = url;
    const meta = await waitForEvent(video, ["loadedmetadata", "error"], timeoutMs);
    if (meta !== "loadedmetadata") return { durationSec: null, width: 0, height: 0, decodable: false };

    // 첫 프레임이 실제로 디코딩되는지 확인 (HEVC 등 미지원 코덱은 여기서 걸러짐)
    const data = video.readyState >= 2 ? "loadeddata" : await waitForEvent(video, ["loadeddata", "error"], timeoutMs);
    const decodable = data === "loadeddata" && video.videoWidth > 0;
    const durationSec = await resolveDuration(video);
    return { durationSec, width: video.videoWidth, height: video.videoHeight, decodable };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

/** 짧은 변 기준 480p로 축소 (작은 영상은 키우지 않음), 짝수 크기 */
export function targetSize(width: number, height: number, shortSide = 480): { width: number; height: number } {
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  const scale = Math.min(1, shortSide / Math.min(width, height));
  return { width: even(width * scale), height: even(height * scale) };
}
