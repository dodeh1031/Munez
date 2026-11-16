import { ACCEPTED_VIDEO_EXTENSIONS, ACCEPTED_VIDEO_TYPES } from "@/lib/constants";

export function isAcceptedVideo(file: File): boolean {
  if (ACCEPTED_VIDEO_TYPES.includes(file.type)) return true;
  const name = file.name.toLowerCase();
  return ACCEPTED_VIDEO_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/**
 * 브라우저 <video> 메타데이터로 영상 길이(초)를 읽습니다.
 * 브라우저가 디코딩하지 못하는 코덱(예: Chrome의 일부 HEVC .mov)이면 null을 반환합니다.
 */
export function readVideoDuration(file: File, timeoutMs = 8000): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;

    const done = (value: number | null) => {
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => done(null), timeoutMs);

    video.onloadedmetadata = () => {
      const d = video.duration;
      done(Number.isFinite(d) && d > 0 ? d : null);
    };
    video.onerror = () => done(null);
    video.src = url;
  });
}
