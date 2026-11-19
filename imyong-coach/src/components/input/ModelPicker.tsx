"use client";

import { useEffect } from "react";
import clsx from "clsx";
import { CircleAlert, Cpu } from "lucide-react";
import type { GeminiClientConfig } from "@/lib/gemini/events";
import { useSessionStore } from "@/lib/store";

const STORAGE_KEY = "imyong-coach:model";

function loadSavedModel(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveModel(id: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* 사생활 보호 모드 등 */
  }
}

/** 분석 모델 선택 — 분석할 때마다 고를 수 있고, 마지막 선택은 이 컴퓨터에 기억 */
export function ModelPicker() {
  const config = useSessionStore((s) => s.serverConfig);
  const choice = useSessionStore((s) => s.modelChoice);
  const setServerConfig = useSessionStore((s) => s.setServerConfig);
  const setModelChoice = useSessionStore((s) => s.setModelChoice);

  useEffect(() => {
    if (config) return;
    let alive = true;
    fetch("/api/gemini/config", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<GeminiClientConfig>) : null))
      .then((c) => {
        if (!alive || !c) return;
        setServerConfig(c);
        const saved = loadSavedModel();
        setModelChoice(saved && c.options.some((o) => o.id === saved) ? saved : c.defaultModel);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [config, setServerConfig, setModelChoice]);

  if (!config) return <p className="text-xs text-slate-400">분석 모델 정보를 불러오는 중…</p>;

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
        <Cpu className="size-4 text-indigo-600" aria-hidden /> 분석 모델
        {config.mock && <span className="text-xs font-normal text-amber-700">(모의 모드: 실제 AI를 호출하지 않아요)</span>}
      </p>
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">분석 모델 선택</legend>
        {config.options.map((o) => {
          const selected = choice === o.id;
          return (
            <label
              key={o.id}
              className={clsx(
                "flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors",
                "has-focus-visible:ring-2 has-focus-visible:ring-indigo-500",
                selected ? "border-indigo-600 bg-indigo-50/60" : "border-slate-200 bg-white hover:border-slate-300",
              )}
            >
              <input
                type="radio"
                name="analysis-model"
                value={o.id}
                checked={selected}
                onChange={() => {
                  setModelChoice(o.id);
                  saveModel(o.id);
                }}
                className="mt-1 size-4 accent-indigo-600"
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="font-semibold">{o.label}</span>
                  <span className="rounded bg-slate-100 px-1.5 text-xs text-slate-600">{o.badge}</span>
                  {o.id === config.defaultModel && <span className="text-xs text-slate-400">기본</span>}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">{o.description}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      {!config.hasApiKey && !config.mock && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          GEMINI_API_KEY가 설정되지 않았어요. imyong-coach/.env.local에 키를 넣고 개발 서버를 다시 시작해야 분석할 수 있어요.
        </p>
      )}
    </div>
  );
}
