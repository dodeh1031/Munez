import type { Rubric } from "@/lib/rubrics/types";

/**
 * 심층면접 채점표
 * 참고: 『끈기 임용 2차 초등특수 심층면접』 심층면접 채점 기준표 · 자기점검표 (요약·재구성)
 *  - 영역 점수: 공고문에 명시된 5개 영역 + 태도·전달력(자기점검표 기반)
 *  - 문항별 평가: 문제 개념별 채점 항목 + 문제 유형(type 1~10)
 *  - 자기점검표: 입실·태도·답변 시·퇴실 체크리스트
 */
export const INTERVIEW_RUBRIC: Rubric = {
  mode: "interview",
  title: "심층면접 채점표",
  source: "끈기 임용 2차 초등특수 심층면접 채점 기준표·자기점검표 (요약·재구성)",
  areas: [
    {
      id: "aptitude",
      label: "교직 적성",
      description: "교직에 대한 총체적 적응 능력",
      criteria: [
        {
          id: "adaptability",
          label: "교직 적응 능력",
          description: "인지적·정의적 측면의 교직 적응 능력(잠재력, 사고력, 판단력, 응용력, 책임감, 문제해결력)이 드러나는가",
        },
      ],
    },
    {
      id: "philosophy",
      label: "교직관",
      description: "확고한 교직관과 교직에 임하는 의지",
      criteria: [
        {
          id: "conviction",
          label: "확고한 교직관",
          description: "교직에 대한 자신만의 확고한 관점과 교사상이 뚜렷한가",
        },
        {
          id: "aspiration",
          label: "의지와 포부",
          description: "어떤 태도로 교직에 임할지 구체적인 의지와 포부를 드러내는가",
        },
        {
          id: "calling",
          label: "열정과 소명 의식",
          description: "교직에 대한 열정과 소명 의식이 진정성 있게 드러나는가",
        },
      ],
    },
    {
      id: "character",
      label: "인격 및 소양",
      description: "교사로서 적절한 성품과 올바른 지식",
      criteria: [
        {
          id: "disposition",
          label: "교사다운 성품",
          description: "일관되게 드러나는 성격과 경향이 교사로서 적절한가 (자주성, 안정감, 계획성, 책임감)",
        },
        {
          id: "knowledge",
          label: "학문 · 지식의 정확성",
          description: "답변에 쓰인 개념·용어·법령 등 지식이 올바른가",
        },
      ],
    },
    {
      id: "communication",
      label: "의사소통 능력",
      description: "논리적 표현과 상호작용에 대한 이해",
      criteria: [
        {
          id: "reasoning",
          label: "논리적 사고 · 표현",
          description: "의사소통 능력을 발휘한 사고(논리력, 분석력, 표현력)로 핵심을 전달하는가",
        },
        {
          id: "collaboration",
          label: "상호작용 이해",
          description: "상호작용의 중요성과 긍정적 결과를 이해하는가 (협동성, 포용력, 문제 상황 대처)",
        },
      ],
    },
    {
      id: "instruction",
      label: "학습지도 능력",
      description: "특수교육 학습지도의 적절성과 전문성",
      criteria: [
        {
          id: "expertise",
          label: "특수교육 학습지도 전문성",
          description: "교과 전문성, 개별화·맞춤형 지도, 중도중복장애 학생 지도 방안이 적절하고 전문적인가",
        },
      ],
    },
    {
      id: "delivery",
      label: "태도 · 전달력",
      description: "자기점검표의 태도·답변 항목을 점수화",
      criteria: [
        {
          id: "presence",
          label: "시선 · 표정 · 자세",
          description: "여러 평가위원에게 시선을 고르게 나누고, 가벼운 미소와 허리·어깨를 편 자세를 유지하는가",
        },
        {
          id: "voice",
          label: "발성",
          description: "자신감 있는 목소리 크기, 적절한 속도, 정확한 발음을 유지하는가",
        },
        {
          id: "structure",
          label: "답변 구조화",
          description: "문항 번호와 첫째·둘째·(근거)로 나누어 말하고 핵심 키워드에 강세를 두며 '이상입니다'로 마무리하는가",
        },
        {
          id: "timing",
          label: "시간 관리",
          description: "문항별 시간을 알맞게 배분하고, 즉답형에서도 침착하게 답변하는가",
        },
      ],
    },
  ],
};

/* ───────────── 문항별 평가 ───────────── */

export const QUESTION_FORMAT_IDS = ["prepared", "instant"] as const;
export type QuestionFormatId = (typeof QUESTION_FORMAT_IDS)[number];
export const QUESTION_FORMAT_LABEL: Record<QuestionFormatId, string> = {
  prepared: "구상형",
  instant: "즉답형",
};

/** 문제 개념별 채점 항목 (문항마다 1~5점) */
export const CONCEPT_CRITERION_IDS = ["understanding", "analysis", "solution", "commitment"] as const;
export type ConceptCriterionId = (typeof CONCEPT_CRITERION_IDS)[number];
export const CONCEPT_CRITERIA: Record<ConceptCriterionId, { label: string; description: string }> = {
  understanding: { label: "개념 이해", description: "핵심 개념의 정의·필요성·배경을 바르게 이해하고 있는가" },
  analysis: { label: "문제 분석", description: "제시된 상황의 문제점을 적절히 분석하는가" },
  solution: { label: "해결 방안", description: "해결 방안이 구체적이고 실현 가능한가" },
  commitment: { label: "의지 · 역량", description: "개선 의지와 실천 역량을 드러내는가" },
};

/** 문제 유형별 채점 기준 (type 1~10) */
export const QUESTION_TYPE_IDS = [
  "philosophy",
  "inclusion",
  "behaviorSupport",
  "conflict",
  "counseling",
  "competency",
  "idea",
  "dilemma",
  "issue",
  "policy",
] as const;
export type QuestionTypeId = (typeof QUESTION_TYPE_IDS)[number];

export const QUESTION_TYPES: Record<QuestionTypeId, { no: number; label: string; focus: string[] }> = {
  philosophy: {
    no: 1,
    label: "교직관·교사상",
    focus: ["자신만의 뚜렷한 교직관", "교사상에 다가가기 위한 실천 의지", "강점 활용·약점 보완 의지"],
  },
  inclusion: {
    no: 2,
    label: "통합교육",
    focus: ["현장 문제의 적절한 분석", "통합교육의 가치·필요성 이해", "구체적·협력적 실천 방안"],
  },
  behaviorSupport: {
    no: 3,
    label: "행동지원",
    focus: ["긍정적 행동지원의 개념·필요성 이해", "주체별 협력적·체계적 중재", "중재 근거의 타당성"],
  },
  conflict: {
    no: 4,
    label: "문제·갈등 상황 대처",
    focus: ["문제 상황의 분석적 판단", "구체적·실현 가능한 해결 방안", "방안 제시 이유의 타당성"],
  },
  counseling: {
    no: 5,
    label: "상담",
    focus: ["학부모·동료 교사의 입장 공감", "적절한 상담 기법", "부드러운 어조와 겸손한 자세"],
  },
  competency: {
    no: 6,
    label: "역량·자질",
    focus: ["필요한 역량의 적절한 파악", "맥락에 맞는 근거", "역량을 기르기 위한 구체적 실천"],
  },
  idea: {
    no: 7,
    label: "교육적 아이디어",
    focus: ["개념에 대한 교육적 상상력", "참신하고 실현 가능한 아이디어"],
  },
  dilemma: {
    no: 8,
    label: "딜레마성 문제",
    focus: ["선택한 상황에 대한 이해", "선택 이유의 타당성", "양면적 사고"],
  },
  issue: {
    no: 9,
    label: "사회적·교육적 이슈",
    focus: ["이슈에 대한 지속적이고 깊은 관심", "견해와 소양의 적절성"],
  },
  policy: {
    no: 10,
    label: "장특법·교육정책",
    focus: ["정책의 배경·필요성·사례 이해", "현장 실천 계획과 실행 의지"],
  },
};

/* ───────────── 자기점검표 ───────────── */

export interface ChecklistItem {
  id: string;
  label: string;
}
export interface ChecklistGroup {
  id: string;
  label: string;
  items: ChecklistItem[];
}

export const INTERVIEW_CHECKLIST: ChecklistGroup[] = [
  {
    id: "entry",
    label: "평가실 입실",
    items: [
      { id: "knock", label: "노크 후 입실, 평가위원과 눈이 마주치면 가볍게 목례" },
      { id: "door", label: "등을 보이지 않고 문 닫기" },
      { id: "eyeContact", label: "평가위원과 눈 맞추고 미소 짓기" },
      { id: "bow", label: "공손한 자세로 인사 (속으로 1·2·3 센 뒤 고개 들기)" },
      { id: "number", label: "인사 후 관리번호 말하기" },
      { id: "seat", label: "의자 소리가 나지 않게 착석" },
    ],
  },
  {
    id: "attitude",
    label: "태도",
    items: [
      { id: "posture", label: "허리와 어깨 펴기" },
      { id: "smile", label: "가벼운 미소와 자신감 있는 태도" },
      { id: "gaze", label: "여러 평가위원에게 골고루 시선 분배" },
      { id: "volume", label: "자신감 있는 목소리로 크게" },
      { id: "speed", label: "적절한 속도 유지" },
      { id: "pronunciation", label: "정확한 발음" },
    ],
  },
  {
    id: "answering",
    label: "답변 시",
    items: [
      { id: "clock", label: "시간 분배를 위해 시계 확인" },
      { id: "structure", label: "문항 번호와 첫째·둘째·(근거)로 나누어 답변" },
      { id: "emphasis", label: "강조할 문장·키워드에 강세" },
      { id: "colloquial", label: "지나친 구어체 표현 자제" },
      { id: "calm", label: "아는 문제가 나와도 흥분하지 않기" },
      { id: "fidget", label: "초조한 행동 자제 (손톱 물어뜯기, 다리 떨기 등)" },
      { id: "closing", label: "'이상입니다.'로 답변 마무리" },
    ],
  },
  {
    id: "exit",
    label: "퇴실",
    items: [
      { id: "endBow", label: "'면접 답변 마치겠습니다. 이상입니다.' 후 가벼운 목례" },
      { id: "chair", label: "의자를 끌지 않고 조심히 일어나기" },
      { id: "standBow", label: "일어나서 인사 (속으로 1·2·3)" },
      { id: "proctor", label: "구상지를 받는 감독관께도 감사 인사" },
      { id: "doorClose", label: "문을 조심히, 조용히 닫기" },
    ],
  },
];

export const CHECKLIST_ITEM_IDS = INTERVIEW_CHECKLIST.flatMap((g) => g.items.map((i) => i.id));
