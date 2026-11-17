import type { FFmpeg } from "@ffmpeg/ffmpeg";

type FFmpegModule = typeof import("@ffmpeg/ffmpeg");

/**
 * ffmpeg.wasm 싱글턴 로더 (브라우저 전용)
 * - @ffmpeg/ffmpeg·코어·워커를 모두 public/ffmpeg 에서 제공 (postinstall 복사) → CDN 불필요
 * - 패키지를 번들에 넣지 않고 브라우저가 직접 import (Turbopack이 패키지의 Worker 생성 코드를 해석하지 못하기 때문)
 * - 단일 스레드 코어: COOP/COEP 헤더(SharedArrayBuffer) 없이 동작
 */
let loading: Promise<FFmpeg> | null = null;

export function getFFmpeg(): Promise<FFmpeg> {
  if (!loading) {
    const promise = (async () => {
      const base = new URL("/ffmpeg/", window.location.href);
      const { FFmpeg } = (await import(/* webpackIgnore: true */ new URL("esm/index.js", base).href)) as FFmpegModule;
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: new URL("ffmpeg-core.js", base).href,
        wasmURL: new URL("ffmpeg-core.wasm", base).href,
      });
      return ffmpeg;
    })();
    loading = promise;
    promise.catch(() => {
      if (loading === promise) loading = null;
    });
  }
  return loading;
}

/**
 * 실행 중인 작업을 강제로 멈춥니다.
 * ffmpeg.wasm은 exec 중단을 지원하지 않으므로 워커를 종료하고, 다음 작업 때 새로 불러옵니다.
 */
export function terminateFFmpeg() {
  const current = loading;
  loading = null;
  current?.then((ff) => ff.terminate()).catch(() => {});
}
