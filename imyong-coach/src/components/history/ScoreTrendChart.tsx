"use client";

import { useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useElementWidth } from "@/components/history/useElementWidth";

export interface TrendPoint {
  id: string;
  score: number;
  dateLabel: string;
  title: string;
}

// 단일 계열 → 범례 없이 카드 제목이 계열 이름. 검증된 팔레트 1번(파랑), 흰 카드 위 대비 통과.
const SERIES = "#2a78d6";
const GRID = "#e2e8f0";
const AXIS_TEXT = "#64748b";
const CROSSHAIR = "#94a3b8";
const HEIGHT = 240;
const M = { top: 20, right: 48, bottom: 36, left: 40 };
const TICKS = [0, 20, 40, 60, 80, 100];

/** 회차별 종합 점수(0~100) 꺾은선. 마우스·키보드(←→)로 회차를 짚고, 클릭하면 그 기록을 엽니다. */
export function ScoreTrendChart({ points, onOpen }: { points: TrendPoint[]; onOpen?: (id: string) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(wrapRef);
  const [active, setActive] = useState<number | null>(null);

  const n = points.length;
  if (n === 0) return null;
  const iw = Math.max(0, width - M.left - M.right);
  const ih = HEIGHT - M.top - M.bottom;
  const x = (i: number) => M.left + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v: number) => M.top + ih - (Math.max(0, Math.min(100, v)) / 100) * ih;
  // x축 회차 라벨이 겹치지 않게 간격 조절
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(iw / 44))));
  const last = points[n - 1];
  const hovered = active !== null ? points[active] : null;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.score)}`).join(" ");

  function indexAt(e: MouseEvent<SVGRectElement>) {
    if (n <= 1) return 0;
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return 0;
    const px = e.clientX - svg.getBoundingClientRect().left;
    return Math.max(0, Math.min(n - 1, Math.round(((px - M.left) / iw) * (n - 1))));
  }

  function onKeyDown(e: KeyboardEvent) {
    const cur = active ?? n - 1;
    if (e.key === "ArrowRight") setActive(Math.min(n - 1, cur + 1));
    else if (e.key === "ArrowLeft") setActive(Math.max(0, cur - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(n - 1);
    else if (e.key === "Enter" && active !== null) onOpen?.(points[active].id);
    else return;
    e.preventDefault();
  }

  const tipLeft = hovered && active !== null ? Math.min(Math.max(x(active), 90), Math.max(90, width - 90)) : 0;

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      role="group"
      aria-label={`종합 점수 변화 그래프. ${n}회 기록, 최근 ${last.score}점. 좌우 화살표로 회차를 이동하고 Enter로 그 기록을 엽니다.`}
      onKeyDown={onKeyDown}
      onFocus={() => setActive((a) => a ?? n - 1)}
      onBlur={() => setActive(null)}
      className="relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      style={{ height: HEIGHT }}
    >
      {width > 0 && (
        <svg width={width} height={HEIGHT} aria-hidden="true" className="block">
          {TICKS.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} shapeRendering="crispEdges" />
              <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS_TEXT} style={{ fontVariantNumeric: "tabular-nums" }}>
                {t}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            i % labelEvery === 0 || i === n - 1 ? (
              <text key={p.id} x={x(i)} y={HEIGHT - M.bottom + 20} textAnchor="middle" fontSize={11} fill={AXIS_TEXT}>
                {i + 1}회
              </text>
            ) : null,
          )}
          {active !== null && (
            <line x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + ih} stroke={CROSSHAIR} strokeWidth={1} shapeRendering="crispEdges" />
          )}
          {n > 1 && <path d={path} fill="none" stroke={SERIES} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
          {points.map((p, i) => (
            <circle key={p.id} cx={x(i)} cy={y(p.score)} r={i === active ? 5.5 : 4} fill={SERIES} stroke="#ffffff" strokeWidth={2} />
          ))}
          {/* 끝점에만 값 표시 (나머지는 툴팁·아래 목록에서) */}
          <text x={x(n - 1) + 10} y={y(last.score)} dy="0.32em" fontSize={12} fontWeight={600} fill="#334155">
            {last.score}
          </text>
          {/* 마우스 영역: 플롯 전체 — 선이 아니라 가장 가까운 회차를 짚음 */}
          <rect
            x={M.left - 16}
            y={M.top - 8}
            width={iw + 32}
            height={ih + 16}
            fill="transparent"
            style={{ cursor: onOpen ? "pointer" : "default" }}
            onPointerMove={(e) => setActive(indexAt(e))}
            onPointerLeave={() => setActive(null)}
            onClick={(e) => onOpen?.(points[indexAt(e)].id)}
          />
        </svg>
      )}

      {hovered && active !== null && (
        <div
          className="pointer-events-none absolute z-10 w-44 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: tipLeft, top: Math.max(0, y(hovered.score) - 86) }}
        >
          <p className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3 rounded" style={{ background: SERIES }} aria-hidden />
            <b className="text-sm text-slate-900">{hovered.score}점</b>
            <span className="text-slate-500">{active + 1}회</span>
          </p>
          <p className="mt-0.5 text-slate-500">{hovered.dateLabel}</p>
          <p className="truncate text-slate-600">{hovered.title}</p>
          {onOpen && <p className="mt-1 text-[11px] text-indigo-600">클릭하면 이 기록을 열어요</p>}
        </div>
      )}
    </div>
  );
}

/** 표 안의 작은 추세선 (강조는 마지막 회차 점만) */
export function Sparkline({ values, max = 5, label }: { values: number[]; max?: number; label: string }) {
  const w = 96;
  const h = 28;
  const pad = 4;
  if (values.length < 2) return <span className="text-xs text-slate-300">–</span>;
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (values.length - 1);
  const y = (v: number) => h - pad - (Math.max(0, Math.min(max, v)) / max) * (h - 2 * pad);
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const li = values.length - 1;
  return (
    <svg width={w} height={h} role="img" aria-label={label} className="block">
      <path d={d} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(li)} cy={y(values[li])} r={3} fill={SERIES} stroke="#ffffff" strokeWidth={1.5} />
    </svg>
  );
}
