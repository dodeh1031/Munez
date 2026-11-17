/** "MM:SS" 또는 "H:MM:SS" → 초 */
export function parseTimestamp(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/** 초 → "MM:SS" */
export function formatSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}

/**
 * 다운로드용 파일 이름 (확장자 제외 부분).
 * 일부 브라우저는 <a download>에 한글이 있으면 이름을 무시하고 "download"로 저장하므로 ASCII만 남깁니다.
 */
export function asciiFileBase(name: string, fallback: string): string {
  const base = name
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || fallback;
}

/** 20261117-1405 형태의 시각 문자열 */
export function timeStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
