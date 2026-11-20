"use client";

import { useEffect } from "react";
import Link from "next/link";
import clsx from "clsx";
import { CloudAlert, CloudCheck, CloudOff, LoaderCircle } from "lucide-react";
import { fmtSyncTime, initFolderSync, syncFolder, syncSummary, useFolderSync } from "@/lib/history/folderSync";

/**
 * 머리글의 폴더 동기화 상태 (폴더를 연결한 경우에만 보임)
 * 앱을 열 때 연결해 둔 폴더를 불러오고 자동 동기화를 시작하는 역할도 겸합니다.
 */
export function FolderSyncBadge() {
  const { status, folderName, last, error, pending } = useFolderSync();

  useEffect(() => {
    void initFolderSync();
  }, []);

  const base = "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors";
  const label = (text: string) => <span className="hidden md:inline">{text}</span>;

  switch (status) {
    case "ready":
      return (
        <button
          type="button"
          onClick={() => void syncFolder({ interactive: true })}
          title={`'${folderName}' 폴더와 동기화됨${last ? ` · ${fmtSyncTime(last.at)} · ${syncSummary(last)}` : ""}\n누르면 지금 동기화`}
          aria-label="폴더 동기화됨. 누르면 지금 동기화"
          className={clsx(base, "text-emerald-700 hover:bg-emerald-50")}
        >
          <CloudCheck className="size-4" aria-hidden />
          {label("동기화됨")}
        </button>
      );
    case "syncing":
      return (
        <span className={clsx(base, "text-indigo-700")} role="status">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          {label("동기화 중")}
          <span className="sr-only md:hidden">폴더 동기화 중</span>
        </span>
      );
    case "needs-permission":
      return (
        <button
          type="button"
          onClick={() => void syncFolder({ interactive: true })}
          title={`'${folderName}' 폴더 사용을 허용하면 동기화해요${pending ? " (저장 안 된 변경 있음)" : ""}`}
          aria-label="폴더 동기화 허용하기"
          className={clsx(base, "bg-amber-50 text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100")}
        >
          <CloudAlert className="size-4" aria-hidden />
          {label("동기화 허용")}
        </button>
      );
    case "error":
      return (
        <Link
          href="/history"
          title={error ?? "동기화 오류"}
          aria-label="폴더 동기화 오류. 기록 화면에서 확인"
          className={clsx(base, "text-rose-700 hover:bg-rose-50")}
        >
          <CloudOff className="size-4" aria-hidden />
          {label("동기화 오류")}
        </Link>
      );
    default:
      return null;
  }
}
