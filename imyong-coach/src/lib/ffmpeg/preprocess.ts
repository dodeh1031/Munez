import type { FFFSType, FFmpeg, LogEvent } from "@ffmpeg/ffmpeg";
import { captureFrames } from "@/lib/ffmpeg/capture";
import { getFFmpeg, terminateFFmpeg } from "@/lib/ffmpeg/client";
import { probeVideo } from "@/lib/video";

/**
 * 분석용 영상 전처리 (브라우저 안에서만 실행, 원본은 외부로 나가지 않음)
 *
 * 출력: H.264 mp4 · 짧은 변 480px · 1fps · AAC 모노 16kHz 32kbps
 *  - Gemini는 영상을 초당 1프레임으로 샘플링하므로 1fps면 분석 정보 손실이 없습니다.
 *  - 타임라인을 원본과 똑같이 유지 → 리포트 타임스탬프로 원본 영상의 같은 장면에 바로 이동.
 *
 * 방식
 *  - capture  : 브라우저가 디코딩 가능한 영상. 브라우저로 1초마다 프레임 캡처 + ffmpeg로 오디오 분리를 동시에 진행 (빠름)
 *  - transcode: 브라우저가 못 여는 코덱(예: Chrome의 HEVC). ffmpeg.wasm 단독 변환, 참조되지 않는 프레임 디코딩 생략 (느림)
 */

export const ANALYSIS_SPEC = { shortSide: 480, fps: 1, audio: "AAC 모노 16kHz" } as const;

// ultrafast: wasm에서는 veryfast가 3~4배 느려 15분 영상 처리 시간이 47초→68초로 늘어남(용량은 20→11MB).
// 업로드 몇 초를 아끼려고 압축을 20초 더 기다리는 건 손해라 가장 빠른 프리셋 사용.
// (Gemini 비용은 파일 크기가 아니라 영상 길이·샘플링으로 결정됨)
const X264 = ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "30", "-pix_fmt", "yuv420p"];
const AAC = ["-ac", "1", "-ar", "16000", "-c:a", "aac", "-b:a", "32k"];
const SCALE_1FPS =
  "fps=1,scale=w='if(gt(iw,ih),-2,min(480,iw))':h='if(gt(iw,ih),min(480,ih),-2)',setsar=1";

export interface PreprocessInput {
  file: File;
  durationSec: number | null;
  decodable: boolean;
}

export interface PreprocessResult {
  file: File;
  method: "capture" | "transcode";
  width: number;
  height: number;
  durationSec: number | null;
  hasAudio: boolean;
  elapsedMs: number;
  warnings: string[];
}

export type ProgressFn = (ratio: number, detail: string) => void;

let jobSeq = 0;

const abortError = () => new DOMException("작업이 취소되었습니다.", "AbortError");

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) throw abortError();
}

/** ffmpeg 로그의 "time=HH:MM:SS.xx" → 초 */
function parseTime(message: string): number | null {
  const m = message.match(/time=\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

function parseDuration(logs: string[]): number | null {
  for (const l of logs) {
    const m = l.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }
  return null;
}

function failure(step: string, code: number, logs: string[]): Error {
  const tail = logs
    .filter((l) => l.trim() && !l.includes("Aborted()"))
    .slice(-3)
    .join(" / ");
  return new Error(`${step}에 실패했습니다 (ffmpeg 코드 ${code}). ${tail}`);
}

export async function preprocessVideo(
  input: PreprocessInput,
  { signal, onProgress }: { signal: AbortSignal; onProgress: ProgressFn },
): Promise<PreprocessResult> {
  const started = performance.now();
  const onAbort = () => terminateFFmpeg();
  signal.addEventListener("abort", onAbort, { once: true });

  try {
    onProgress(0.01, "압축 엔진 불러오는 중");
    const ff = await getFFmpeg();
    throwIfAborted(signal);

    const job = ++jobSeq;
    const dir = `/in${job}`;
    const ext = (input.file.name.match(/\.[a-z0-9]+$/i)?.[0] ?? ".mp4").toLowerCase();
    // 한글·공백 파일명 문제를 피하려고 이름만 바꾼 File (데이터 복사 없음)
    const src = new File([input.file], `input${ext}`, { type: input.file.type });
    await ff.createDir(dir);
    // WORKERFS: 원본을 메모리에 통째로 올리지 않고 필요한 부분만 읽음 (대용량 영상 대응)
    await ff.mount("WORKERFS" as FFFSType, { files: [src] }, dir);

    const logs: string[] = [];
    const onLog = ({ message }: LogEvent) => {
      logs.push(message);
      if (logs.length > 300) logs.shift();
    };
    ff.on("log", onLog);

    try {
      const ctx: JobContext = { ff, job, file: input.file, inPath: `${dir}/input${ext}`, logs, signal, onProgress };
      const out =
        input.decodable && input.durationSec ? await captureMode(ctx, input.durationSec) : await transcodeMode(ctx, input);

      throwIfAborted(signal);
      const data = await ff.readFile(out.path);
      await ff.deleteFile(out.path).catch(() => {});
      const baseName = input.file.name.replace(/\.[^.]+$/, "");
      const file = new File([data as Uint8Array<ArrayBuffer>], `${baseName}_분석용.mp4`, { type: "video/mp4" });

      // 결과물 검증 겸 크기·길이 확인 (H.264 mp4는 모든 주요 브라우저가 재생 가능)
      const probe = await probeVideo(file).catch(() => null);
      const warnings: string[] = [];
      if (out.method === "transcode") {
        warnings.push("이 브라우저가 원본 코덱을 재생하지 못해 호환 모드로 압축했습니다. 리포트에서는 분석용 영상으로 재생됩니다.");
      }
      if (!out.hasAudio) warnings.push("오디오 트랙이 없어 화면만 분석됩니다. 녹화 시 마이크가 켜져 있었는지 확인해 주세요.");

      onProgress(1, "완료");
      return {
        file,
        method: out.method,
        width: probe?.width || out.width,
        height: probe?.height || out.height,
        durationSec: probe?.durationSec ?? input.durationSec,
        hasAudio: out.hasAudio,
        elapsedMs: Math.round(performance.now() - started),
        warnings,
      };
    } finally {
      ff.off("log", onLog);
      await ff.unmount(dir).catch(() => {});
      await ff.deleteDir(dir).catch(() => {});
    }
  } catch (err) {
    if (signal.aborted) throw abortError();
    throw err;
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

interface JobContext {
  ff: FFmpeg;
  job: number;
  /** 원본 File (브라우저 프레임 캡처용) */
  file: File;
  /** ffmpeg 가상 파일시스템 안의 원본 경로 */
  inPath: string;
  logs: string[];
  signal: AbortSignal;
  onProgress: ProgressFn;
}

interface ModeOutput {
  path: string;
  method: "capture" | "transcode";
  hasAudio: boolean;
  width: number;
  height: number;
}

/** 진행률을 time= 로그로 계산하는 exec 래퍼. expectedSec는 실행 중에 알게 될 수도 있어 함수로 받음 */
async function execWithProgress(
  ctx: JobContext,
  args: string[],
  expectedSec: () => number,
  onRatio: (r: number) => void,
) {
  const handler = ({ message }: LogEvent) => {
    const t = parseTime(message);
    const expected = expectedSec();
    if (t !== null && expected > 0) onRatio(Math.min(1, t / expected));
  };
  ctx.ff.on("log", handler);
  try {
    return await ctx.ff.exec(args);
  } finally {
    ctx.ff.off("log", handler);
  }
}

async function captureMode(ctx: JobContext, durationSec: number): Promise<ModeOutput> {
  const { ff, job, inPath, signal, onProgress } = ctx;
  const audioPath = `/a${job}.m4a`;
  const framePattern = `/f${job}_%05d.jpg`;
  const framePath = (i: number) => `/f${job}_${String(i).padStart(5, "0")}.jpg`;
  const outPath = `/out${job}.mp4`;

  // ① 오디오 분리(ffmpeg 워커)와 ② 프레임 캡처(메인 스레드)를 동시에 진행
  let audioRatio = 0;
  let captured = 0;
  let total = Math.ceil(durationSec);
  const report = () =>
    onProgress(
      0.03 + 0.77 * (0.65 * (captured / total) + 0.35 * audioRatio),
      `프레임 추출 ${captured}/${total} · 오디오 분리 ${Math.round(audioRatio * 100)}%`,
    );

  const audioJob = execWithProgress(ctx, ["-i", inPath, "-vn", ...AAC, audioPath], () => durationSec, (r) => {
    audioRatio = r;
    report();
  }).catch(() => -1); // 취소 시 terminate로 reject → 아래에서 signal로 처리

  const capture = await captureFrames(ctx.file, {
    durationSec,
    signal,
    onProgress: (done, t) => {
      captured = done;
      total = t;
      report();
    },
  });
  const audioCode = await audioJob;
  throwIfAborted(signal);
  const hasAudio = audioCode === 0;
  audioRatio = 1;

  // ③ 프레임을 ffmpeg 가상 파일시스템에 기록
  const n = capture.frames.length;
  for (let i = 0; i < n; i++) {
    throwIfAborted(signal);
    await ff.writeFile(framePath(i), capture.frames[i]);
    if (i % 30 === 0 || i === n - 1) onProgress(0.8 + 0.05 * ((i + 1) / n), `프레임 정리 ${i + 1}/${n}`);
  }

  // ④ 1fps H.264 + 오디오로 인코딩
  const code = await execWithProgress(
    ctx,
    [
      "-framerate",
      "1",
      "-i",
      framePattern,
      ...(hasAudio ? ["-i", audioPath] : []),
      ...X264,
      ...(hasAudio ? ["-c:a", "copy"] : []),
      "-movflags",
      "+faststart",
      outPath,
    ],
    () => n,
    (r) => onProgress(0.85 + 0.15 * r, `분석용 영상 인코딩 ${Math.round(r * 100)}%`),
  );

  // 임시 파일 정리 (실패해도 무시)
  void Promise.all([
    ...Array.from({ length: n }, (_, i) => ff.deleteFile(framePath(i)).catch(() => {})),
    hasAudio ? ff.deleteFile(audioPath).catch(() => {}) : Promise.resolve(),
  ]);

  throwIfAborted(signal);
  if (code !== 0) throw failure("분석용 영상 인코딩", code, ctx.logs);
  return { path: outPath, method: "capture", hasAudio, width: capture.width, height: capture.height };
}

async function transcodeMode(ctx: JobContext, input: PreprocessInput): Promise<ModeOutput> {
  const outPath = `/out${ctx.job}.mp4`;
  let expected = input.durationSec ?? 0;
  // 길이를 모르면 ffmpeg 로그의 "Duration:"에서 읽음
  const getExpected = () => (expected ||= parseDuration(ctx.logs) ?? 0);
  ctx.onProgress(0.03, "호환 모드로 변환 중 (시간이 조금 걸려요)");
  const code = await execWithProgress(
    ctx,
    [
      // 다른 프레임이 참조하지 않는 프레임과 디블로킹을 생략해 디코딩 속도를 약 2배로
      "-skip_frame",
      "noref",
      "-skip_loop_filter",
      "all",
      "-i",
      ctx.inPath,
      "-vf",
      SCALE_1FPS,
      ...X264,
      ...AAC,
      "-movflags",
      "+faststart",
      outPath,
    ],
    getExpected,
    (r) => ctx.onProgress(0.03 + 0.97 * r, `호환 모드 변환 ${Math.round(r * 100)}%`),
  );
  throwIfAborted(ctx.signal);
  if (code !== 0) throw failure("영상 변환", code, ctx.logs);
  const hasAudio = ctx.logs.some((l) => /Stream #\d+:\d+.*Audio:/.test(l));
  return { path: outPath, method: "transcode", hasAudio, width: 0, height: 0 };
}
