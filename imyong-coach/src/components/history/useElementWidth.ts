"use client";

import { useEffect, useState, type RefObject } from "react";

/** 요소의 현재 너비(px). ResizeObserver가 처음 관찰할 때와 크기가 바뀔 때 갱신 */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}
