"use client";

import clsx from "clsx";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  count?: number;
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  idPrefix,
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  idPrefix: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 [scrollbar-width:none]"
    >
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel`}
            onClick={() => onChange(tab.id)}
            className={clsx(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              selected ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={clsx(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  selected ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-500",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
