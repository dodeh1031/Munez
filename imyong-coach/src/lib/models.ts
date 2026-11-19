/**
 * 화면에서 고를 수 있는 분석 모델 (브라우저·서버 공용)
 * 새 모델이 나오면 이 목록만 고치면 됩니다. (.env.local의 GEMINI_MODEL도 항상 선택지에 포함)
 */
export interface ModelOption {
  id: string;
  label: string;
  badge: string;
  description: string;
}

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "gemini-4-hydrogen",
    label: "Hydrogen",
    badge: "평소 연습",
    description: "저렴하고 근거를 지어낼 확률이 낮은 편",
  },
  {
    id: "gemini-4-neon",
    label: "Neon",
    badge: "정밀 점검",
    description: "더 깊이 분석 · Hydrogen보다 비용 약 2배",
  },
];

/** 모델 id → 화면 표시 이름 (목록에 없으면 id 그대로) */
export function modelLabel(id: string | null | undefined): string {
  if (!id) return "";
  return MODEL_OPTIONS.find((m) => m.id === id)?.label ?? id;
}
