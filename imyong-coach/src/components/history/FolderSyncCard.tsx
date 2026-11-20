"use client";

import { useEffect } from "react";
import clsx from "clsx";
import { CloudAlert, FolderInput, FolderSync, LoaderCircle, RefreshCw, Unlink } from "lucide-react";
import { Card } from "@/components/ui/Card";
import {
  SYNC_FILE_NAME,
  connectFolder,
  disconnectFolder,
  initFolderSync,
  fmtSyncTime,
  syncFolder,
  syncSummary,
  useFolderSync,
} from "@/lib/history/folderSync";

const btn = "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50";
const primary = clsx(btn, "bg-indigo-600 font-semibold text-white hover:bg-indigo-700");
const secondary = clsx(btn, "bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50");

/** 기록 화면: 드라이브(또는 아무) 폴더와 기록 동기화 */
export function FolderSyncCard() {
  const { status, folderName, last, error, pending } = useFolderSync();

  useEffect(() => {
    void initFolderSync();
  }, []);

  if (status === "loading") return null;

  const syncing = status === "syncing";

  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-start gap-4 px-5 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
          <FolderSync className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 basis-72">
          <h2 className="font-semibold tracking-tight">드라이브 폴더 동기화</h2>

          {status === "unsupported" && (
            <p className="mt-1 text-sm text-slate-600">
              이 브라우저는 폴더 연결을 지원하지 않아요. <b>크롬이나 엣지</b>로 열면 쓸 수 있어요. 지금은 &lsquo;전체
              백업&rsquo;으로 받은 파일을 드라이브에 올리고, 다른 컴퓨터에서 &lsquo;기록 불러오기&rsquo;로 가져오세요.
            </p>
          )}

          {status === "disconnected" && (
            <>
              <p className="mt-1 text-sm text-slate-600">
                Google Drive 데스크톱 앱의 <b>&lsquo;내 드라이브&rsquo; 안에 폴더</b>(예: 임용 2차 연습)를 만들어 연결해
                두세요. 분석이 끝나거나 자기 채점·삭제를 하면 그 폴더에 기록이 저장되고, 다른 컴퓨터에서 같은 폴더를
                연결하면 양쪽 기록이 합쳐져요.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                드라이브 앱이 없으면 USB 같은 다른 폴더도 연결할 수 있어요. 영상은 옮기지 않고 리포트·점수·자기 채점만
                옮겨요.
              </p>
            </>
          )}

          {status === "needs-permission" && (
            <p className="mt-1 text-sm text-slate-600">
              <b>&lsquo;{folderName}&rsquo;</b> 폴더를 쓰려면 이 컴퓨터에서 허용이 한 번 필요해요. 창이 뜨면{" "}
              <b>&lsquo;방문할 때마다 허용&rsquo;</b>을 고르면 다음부터는 자동으로 동기화돼요.
              {pending && <span className="mt-1 block text-amber-700">아직 폴더에 저장하지 못한 변경이 있어요.</span>}
            </p>
          )}

          {(status === "ready" || status === "syncing" || status === "error") && (
            <div className="mt-1 space-y-1 text-sm text-slate-600" role="status" aria-live="polite">
              <p>
                연결된 폴더: <b className="text-slate-900">{folderName}</b>
              </p>
              {syncing ? (
                <p className="flex items-center gap-1.5 text-indigo-700">
                  <LoaderCircle className="size-4 animate-spin" aria-hidden /> 동기화하는 중…
                </p>
              ) : status === "error" ? (
                <p className="flex items-start gap-1.5 text-rose-700">
                  <CloudAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
                </p>
              ) : last ? (
                <p>
                  마지막 동기화 {fmtSyncTime(last.at)} · {syncSummary(last)}
                </p>
              ) : null}
              <p className="text-xs text-slate-500">
                분석 저장·자기 채점·삭제 뒤에 자동으로 맞춰요. 폴더 안 파일: {SYNC_FILE_NAME}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {status === "disconnected" && (
            <button type="button" onClick={() => void connectFolder()} className={primary}>
              <FolderInput className="size-4" aria-hidden /> 폴더 연결하기
            </button>
          )}
          {status === "needs-permission" && (
            <button type="button" onClick={() => void syncFolder({ interactive: true })} className={primary}>
              <RefreshCw className="size-4" aria-hidden /> 허용하고 동기화
            </button>
          )}
          {(status === "ready" || status === "syncing" || status === "error") && (
            <button
              type="button"
              disabled={syncing}
              onClick={() => void syncFolder({ interactive: true })}
              className={primary}
            >
              <RefreshCw className={clsx("size-4", syncing && "animate-spin")} aria-hidden />
              {status === "error" ? "다시 시도" : "지금 동기화"}
            </button>
          )}
          {(status === "ready" || status === "error" || status === "needs-permission") && (
            <>
              <button type="button" onClick={() => void connectFolder()} className={secondary}>
                <FolderInput className="size-4" aria-hidden /> 다른 폴더로 바꾸기
              </button>
              <button
                type="button"
                onClick={() => void disconnectFolder()}
                className={secondary}
                title="연결을 끊어도 이 컴퓨터의 기록과 폴더의 파일은 그대로 남아요"
              >
                <Unlink className="size-4" aria-hidden /> 연결 끊기
              </button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
