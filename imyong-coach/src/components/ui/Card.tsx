import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={clsx("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  icon: Icon,
  title,
  description,
  step,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  step?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        {step !== undefined ? (
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
            {step}
          </span>
        ) : Icon ? (
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="font-semibold leading-7 tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
