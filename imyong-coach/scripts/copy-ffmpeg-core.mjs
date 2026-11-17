// postinstall: ffmpeg.wasm 실행 파일을 public/ffmpeg 로 복사합니다.
// - CDN 없이 로컬(오프라인)에서도 브라우저 압축이 동작하도록
// - @ffmpeg/ffmpeg 를 번들러(Turbopack)를 거치지 않고 브라우저가 직접 import 하도록 정적 파일로 제공
//   (Turbopack은 패키지 안의 `new Worker(new URL(변수, import.meta.url))` 를 빌드 시점에 해석하지 못함)
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nm = join(root, "node_modules", "@ffmpeg");
const dest = join(root, "public", "ffmpeg");

const jobs = [
  { from: join(nm, "core", "dist", "esm"), to: dest, files: ["ffmpeg-core.js", "ffmpeg-core.wasm"] },
  { from: join(nm, "ffmpeg", "dist", "esm"), to: join(dest, "esm"), files: "*.js" },
];

for (const { from, to, files } of jobs) {
  if (!existsSync(from)) {
    console.warn(`[copy-ffmpeg] ${from} 를 찾을 수 없어 건너뜁니다.`);
    continue;
  }
  mkdirSync(to, { recursive: true });
  const list = files === "*.js" ? readdirSync(from).filter((f) => f.endsWith(".js")) : files;
  for (const f of list) copyFileSync(join(from, f), join(to, f));
}
console.log("[copy-ffmpeg] public/ffmpeg 로 ffmpeg.wasm 파일 복사 완료");
