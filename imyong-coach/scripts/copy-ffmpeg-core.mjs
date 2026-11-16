// postinstall: ffmpeg.wasm 코어 파일을 public/ffmpeg 로 복사합니다.
// CDN 없이 로컬(오프라인)에서도 브라우저 압축이 동작하도록 하기 위함입니다.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "node_modules", "@ffmpeg", "core", "dist", "esm");
const destDir = join(root, "public", "ffmpeg");

if (!existsSync(srcDir)) {
  console.warn("[copy-ffmpeg-core] @ffmpeg/core 를 찾을 수 없어 건너뜁니다.");
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
for (const file of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) {
  copyFileSync(join(srcDir, file), join(destDir, file));
}
console.log("[copy-ffmpeg-core] public/ffmpeg 로 코어 파일 복사 완료");
