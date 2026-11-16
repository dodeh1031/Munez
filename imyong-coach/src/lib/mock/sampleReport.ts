import type { AnalysisReport, EvalMode } from "@/lib/schema/report";

/**
 * 1단계 레이아웃 확인용 샘플 리포트.
 * 3단계에서 실제 Gemini 응답이 들어오면 리포트 화면은 이 데이터 대신 실제 결과를 보여 줍니다.
 */
export const SAMPLE_MODE: EvalMode = "demo";

export const SAMPLE_REPORT: AnalysisReport = {
  summary:
    "수업조건 3가지 중 AAC 활용과 모둠 활동은 명확히 구현했지만, 행동지원 전략은 정리 단계에서 한 문장으로만 언급되었습니다. 발문이 대부분 '~알겠죠?' 형태의 확인형이라 학생 반응을 끌어내는 장면이 부족합니다. 시선 처리와 발성은 안정적입니다.",
  rubric: {
    content: {
      score: 20,
      rationale:
        "학습목표 제시(00:45)가 명확하고, AAC 활용 조건을 전개 2(10:15~)에서 구체적으로 구현했습니다. 다만 행동지원 조건이 12:10에서 짧게 언급되는 데 그쳤습니다.",
    },
    method: {
      score: 16,
      rationale:
        "모둠 활동 지시(05:20~)가 '함께 해 봅시다' 수준이라 역할 분담과 촉진 단계가 드러나지 않습니다.",
    },
    delivery: {
      score: 21,
      rationale:
        "가상 학생 자리를 고르게 응시하고 목소리 크기·속도가 일정합니다. 판서 중 등을 보이는 시간(08:30)이 다소 깁니다.",
    },
    time: {
      score: 17,
      rationale: "도입이 4분 가까이 이어졌고, 정리 단계는 1분이 채 되지 않아 급하게 마무리되었습니다.",
    },
  },
  segments: [
    {
      start: "00:00",
      end: "00:45",
      category: "delivery",
      sentiment: "strength",
      title: "밝은 첫인사와 시선 처리",
      observation: "첫인사와 함께 가상 학생 이름을 부르며 좌우를 고르게 바라봅니다.",
      suggestion: "지금처럼 학생 이름 호명을 수업 전체에 걸쳐 유지하세요.",
    },
    {
      start: "00:45",
      end: "04:10",
      category: "time",
      sentiment: "improve",
      title: "도입이 길어짐",
      observation: "동기유발 영상 내용을 3분 이상 말로 설명하고 있습니다.",
      suggestion: "도입은 2분 안팎으로 줄이고, 설명 대신 짧은 질문 1~2개로 바로 학습목표에 연결하세요.",
    },
    {
      start: "05:20",
      end: "07:10",
      category: "method",
      sentiment: "improve",
      title: "모둠 활동 지시가 추상적",
      observation: "'친구들과 함께 해 봅시다'라고만 안내하고 역할이나 순서를 제시하지 않습니다.",
      suggestion: "학생별 역할(카드 고르기·AAC로 말하기)과 교사의 시범–안내–독립 단계를 말로 드러내세요.",
    },
    {
      start: "08:30",
      end: "09:05",
      category: "delivery",
      sentiment: "improve",
      title: "판서 중 등을 보이는 시간",
      observation: "약 30초 동안 칠판만 바라보며 판서합니다.",
      suggestion: "몸을 45도로 열고 판서하며 '지금 선생님이 무엇을 쓰고 있을까요?'처럼 말을 이어 가세요.",
    },
    {
      start: "10:15",
      end: "11:40",
      category: "content",
      sentiment: "strength",
      title: "AAC 활용 장면이 구체적",
      observation: "학생 A가 AAC로 인사말을 선택하고, 교사가 즉시 칭찬과 확장 발화를 해 줍니다.",
      suggestion: "다른 학생의 수준에 맞춘 촉진(신체·언어·시각)도 한 번 더 보여 주면 개별화가 더 분명해집니다.",
    },
    {
      start: "12:10",
      end: "12:40",
      category: "content",
      sentiment: "critical",
      title: "행동지원 조건 반영 미흡",
      observation: "'자리에 앉아 볼까요?' 한 문장으로 행동지원 조건을 처리했습니다.",
      suggestion: "문제행동 발생 장면을 가정하고 선행사건 중재(시각적 일과표·선택권 제공)와 대체행동 강화를 시연하세요.",
    },
    {
      start: "13:30",
      end: "14:10",
      category: "time",
      sentiment: "critical",
      title: "정리 단계 급하게 마무리",
      observation: "학습 내용 정리 없이 차시 예고만 하고 수업을 끝냅니다.",
      suggestion: "최소 2분을 확보해 학습목표 도달 여부를 학생 활동으로 확인하세요.",
    },
  ],
  alternatives: [
    {
      at: "02:30",
      original: "오늘 무엇을 배울지 알겠죠?",
      problem: "'네'로만 답하게 되는 확인형 만능 발문이라 학생의 실제 이해를 확인할 수 없습니다.",
      alternative: "(그림카드를 가리키며) 지윤아, 오늘 우리가 친구를 만나면 무엇을 할까? 카드에서 찾아서 보여 줄래?",
    },
    {
      at: "05:25",
      original: "친구들과 함께 해 봅시다.",
      problem: "역할과 방법이 없는 모둠 활동 만능틀입니다. 수준이 다른 학생들이 각자 무엇을 해야 할지 알 수 없습니다.",
      alternative: "민수는 상황 카드를 고르고, 하은이는 AAC로 '안녕하세요'를 눌러 인사해요. 선생님이 먼저 한 번 보여 줄게요.",
    },
    {
      at: "13:40",
      original: "오늘 수업 재미있었나요?",
      problem: "정리 단계의 만능 질문으로, 학습목표 도달 여부를 확인하지 못합니다.",
      alternative: "선생님이 아침에 교실에 들어오면 어떤 인사를 할까요? AAC로 다시 한번 말해 보고, 성공하면 스티커를 붙여요.",
    },
  ],
};
