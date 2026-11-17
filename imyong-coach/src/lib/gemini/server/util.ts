import "server-only";

export const NO_KEY_MESSAGE =
  "GEMINI_API_KEY가 설정되지 않았습니다. imyong-coach/.env.local 파일에 키를 넣고 개발 서버를 다시 시작하세요. (키 없이 화면만 보려면 GEMINI_MOCK=1)";

/** abort되면 즉시 끝나는 sleep */
export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
