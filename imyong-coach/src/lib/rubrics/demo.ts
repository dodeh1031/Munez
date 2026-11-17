import type { Rubric } from "@/lib/rubrics/types";

/**
 * 수업실연 채점표
 * 참고: 『끈기 임용 2차 초등특수 수업실연』 수업실연 채점기준표 및 세부 기준 분석 (요약·재구성)
 */
export const DEMO_RUBRIC: Rubric = {
  mode: "demo",
  title: "수업실연 채점표",
  source: "끈기 임용 2차 초등특수 수업실연 채점기준표 (요약·재구성)",
  areas: [
    {
      id: "posture",
      label: "교사의 기본 자세",
      description: "자신감·존중·열정이 드러나는 태도, 발성, 비언어적 표현",
      criteria: [
        {
          id: "stableFlow",
          label: "안정적인 흐름",
          description: "수업이 끊기거나 허둥대지 않고 자신감 있게 이어지는가 (활동 순서 숙지)",
        },
        {
          id: "respect",
          label: "경어 · 존중",
          description: "경어를 기본으로 학생을 존중하고, 개별 학생에게는 이름을 부르며 친근하게 다가가는가",
        },
        {
          id: "passion",
          label: "열의 · 열정",
          description: "가치 있는 배움을 주려는 열의와 열정이 드러나는가",
        },
        {
          id: "praise",
          label: "구체적 칭찬 · 허용적 분위기",
          description: "행동이 그려지도록 구체적으로 칭찬하고, 답변을 경청하며, 실수를 허용하고 격려하는가",
        },
        {
          id: "voice",
          label: "발음 · 목소리 크기",
          description: "발음이 정확하고 목소리 크기가 적절한가",
        },
        {
          id: "pacing",
          label: "진행 속도 · 기다림",
          description: "핵심 발문 뒤 충분히 기다리고(약 2초 이상), 단계별 시간을 알맞게 배분하는가",
        },
        {
          id: "intonation",
          label: "억양 변화",
          description: "적절한 높낮이로 단조롭지 않고 매끄러운 분위기를 만드는가",
        },
        {
          id: "nonverbal",
          label: "표정 · 제스처 · 시선 · 동선",
          description: "밝은 표정, 효과적인 제스처, 고개 끄덕임, 몸 낮추기, 고른 시선 분산, 깔끔한 동선과 칠판·매체 활용",
        },
      ],
    },
    {
      id: "operation",
      label: "수업 운영 능력",
      description: "상호작용 중심 전개, 학생중심 교사 역할, 수업 조건 반영과 평가",
      criteria: [
        {
          id: "interaction",
          label: "상호작용 중심 전개",
          description: "교사–학생, 학생–학생, 수업 내용 간 상호작용(문답, 짝·모둠 토의, 또래 교수 등)으로 전개되는가",
        },
        {
          id: "facilitator",
          label: "학생중심 교사 역할",
          description: "안내자·조력자·촉진자로서 활동과 방법을 설명하고, 시간을 배분하며, 오반응에 피드백하는가",
        },
        {
          id: "engagement",
          label: "참여 독려",
          description: "확산적 발문과 호기심·동기 유발로 참여를 끌어내고, 학습 의욕이 낮은 학생을 지원하는가",
        },
        {
          id: "conditions",
          label: "수업 내용 · 조건 반영",
          description: "제시된 수업 조건(자료, 학생 특성, 활동 등)을 정확히 이해해 충실히 반영하고 자료를 입체적으로 활용하는가",
        },
        {
          id: "assessment",
          label: "평가 · 피드백",
          description: "활동별 정리·형성평가·수준별 평가를 활용하고, 교육과정–수업–평가 일체화를 고려해 마무리하는가",
        },
      ],
    },
    {
      id: "special",
      label: "특수교과의 수업",
      description: "장애 특성과 삶의 맥락을 반영한 개별화된 안전한 수업",
      criteria: [
        {
          id: "disability",
          label: "장애 특성 반영",
          description: "장애 특성, 학습 수준, 흥미를 파악해 수업에 적절히 드러내는가",
        },
        {
          id: "functional",
          label: "기능적 목표 · 실생활 연계",
          description: "이 수업으로 실생활에서 얻을 것을 도입·정리에서 학습 목표와 연결해 강조하는가",
        },
        {
          id: "behavior",
          label: "도전행동 중재",
          description: "문제행동의 기능에 맞는 긍정적 행동지원 중재를 제공하는가",
        },
        {
          id: "individualized",
          label: "개별화 · 맞춤형 교육",
          description: "수준별 과제·활동·발문·자료로 개별화 교육의 특징이 드러나는가",
        },
        {
          id: "safety",
          label: "안전한 수업 환경",
          description: "사전 규칙 안내, 도구 사용 주의, 배경사건 중재로 물리적·심리적 안전을 확보하는가",
        },
        {
          id: "supportStaff",
          label: "특수교육 지원인력 협력",
          description: "지원인력을 정확한 명칭으로 부르고, 상황에 맞게(학생 지원, 사진 촬영, 실습 준비 등) 협력적으로 활용하는가",
        },
      ],
    },
  ],
};
