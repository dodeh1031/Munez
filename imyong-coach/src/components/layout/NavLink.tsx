"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export function NavLink({ href, children }: { href: "/" | "/report" | "/history"; children: React.ReactNode }) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "rounded-md px-3 py-1.5 font-medium transition-colors",
        active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      )}
    >
      {children}
    </Link>
  );
}
