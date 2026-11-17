import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { NavLink } from "@/components/layout/NavLink";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-indigo-600 text-white">
            <GraduationCap className="size-5" aria-hidden />
          </span>
          <span className="truncate font-semibold tracking-tight">임용 2차 AI 코치</span>
          <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 sm:inline">
            심층면접 · 수업실연
          </span>
        </Link>
        <nav className="flex shrink-0 items-center gap-1 text-sm">
          <NavLink href="/">새 분석</NavLink>
          <NavLink href="/report">리포트</NavLink>
          <NavLink href="/history">기록</NavLink>
        </nav>
      </div>
    </header>
  );
}
