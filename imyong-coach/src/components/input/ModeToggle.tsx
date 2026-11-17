"use client";

import clsx from "clsx";
import { MessagesSquare, Presentation } from "lucide-react";
import { MODE_META } from "@/lib/constants";
import { getRubric } from "@/lib/rubrics";
import { EVAL_MODES } from "@/lib/schema/report";
import { useSessionStore } from "@/lib/store";

const ICONS = { interview: MessagesSquare, demo: Presentation } as const;

export function ModeToggle() {
  const mode = useSessionStore((s) => s.mode);
  const setMode = useSessionStore((s) => s.setMode);

  return (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      <legend className="sr-only">평가 모드 선택</legend>
      {EVAL_MODES.map((m) => {
        const meta = MODE_META[m];
        const Icon = ICONS[m];
        const selected = m === mode;
        return (
          <label
            key={m}
            className={clsx(
              "flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-colors",
              "has-focus-visible:ring-2 has-focus-visible:ring-indigo-500 has-focus-visible:ring-offset-2",
              selected ? "border-indigo-600 bg-indigo-50/60" : "border-slate-200 bg-white hover:border-slate-300",
            )}
          >
            <input
              type="radio"
              name="eval-mode"
              value={m}
              checked={selected}
              onChange={() => setMode(m)}
              className="sr-only"
            />
            <span
              className={clsx(
                "grid size-10 shrink-0 place-items-center rounded-lg transition-colors",
                selected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500",
              )}
            >
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold">{meta.label}</span>
                <span className="text-xs text-slate-500">{meta.sublabel}</span>
              </span>
              <span className="mt-1 block text-sm text-slate-600">{meta.description}</span>
              <span className="mt-2.5 flex flex-wrap gap-1">
                {getRubric(m).areas.map((area) => (
                  <span
                    key={area.id}
                    className={clsx(
                      "rounded-md px-1.5 py-0.5 text-xs",
                      selected ? "bg-white text-indigo-700 ring-1 ring-indigo-200" : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {area.label}
                  </span>
                ))}
              </span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
