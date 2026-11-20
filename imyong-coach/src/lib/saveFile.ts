/**
 * 파일을 내 컴퓨터에 저장 (브라우저 전용)
 *  - 크롬·엣지: '다른 이름으로 저장' 창에서 위치를 고름 (드라이브 폴더를 연결해 두었으면 그 폴더에서 시작)
 *  - 그 밖의 브라우저: 일반 다운로드(다운로드 폴더)
 */

type SaveFilePicker = (options: {
  suggestedName?: string;
  id?: string;
  startIn?: FileSystemHandle | "desktop" | "documents" | "downloads" | "videos";
  types?: { description: string; accept: Record<string, string[]> }[];
}) => Promise<FileSystemFileHandle>;

export type SaveResult = "saved" | "downloaded" | "cancelled";

export async function saveFileToComputer(
  file: Blob,
  suggestedName: string,
  options: { startIn?: FileSystemDirectoryHandle | null; description?: string } = {},
): Promise<SaveResult> {
  const picker = (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
  if (picker && window.isSecureContext) {
    const ext = suggestedName.match(/\.[A-Za-z0-9]+$/)?.[0] ?? "";
    const mime = (file.type || "application/octet-stream").split(";")[0].trim();
    // 연결한 폴더에서 시작하지 못하면(권한 등) 기본 위치로 한 번 더 시도
    const starts = options.startIn ? [options.startIn, "videos" as const] : ["videos" as const];
    let handle: FileSystemFileHandle | null = null;
    for (const startIn of starts) {
      try {
        handle = await picker({
          suggestedName,
          id: "imyong-save",
          startIn,
          types: ext ? [{ description: options.description ?? "파일", accept: { [mime]: [ext] } }] : undefined,
        });
        break;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
        console.warn("[save] 저장 창을 열지 못했습니다", err);
      }
    }
    if (handle) {
      // 쓰기 오류(공간 부족 등)는 호출한 쪽에서 안내
      const writable = await handle.createWritable();
      await writable.write(file);
      await writable.close();
      return "saved";
    }
  }
  downloadBlob(file, suggestedName);
  return "downloaded";
}

export function downloadBlob(file: Blob, name: string) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
