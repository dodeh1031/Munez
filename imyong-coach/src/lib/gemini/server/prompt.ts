import "server-only";
import { formatSeconds } from "@/lib/format";
import { SCORE_SCALE, getRubric, type Rubric } from "@/lib/rubrics";
import {
  CONCEPT_CRITERIA,
  CONCEPT_CRITERION_IDS,
  INTERVIEW_CHECKLIST,
  QUESTION_TYPE_IDS,
  QUESTION_TYPES,
} from "@/lib/rubrics/interview";
import type { EvalMode } from "@/lib/schema/report";

/**
 * 채점표(rubrics/*.ts) → Gemini 지시문.
 * 채점표 문구를 고치면 프롬프트도 자동으로 바뀝니다.
 */

function rubricText(rubric: Rubric): string {
  return rubric.areas
    .map((area) => {
      const criteria = area.criteria.map((c) => `  - ${c.id} 「${c.label}」: ${c.description}`).join("\n");
      return `■ 영역 ${area.id} 「${area.label}」 — ${area.description}\n${criteria}`;
    })
    .join("\n");
}

const SCALE_TEXT = SCORE_SCALE.map((s) => `${s.score}점 ${s.label}: ${s.description}`).join(" / ");

const COMMON_RULES = `
[평가 원칙]
1. 근거 중심: 모든 점수와 피드백은 영상에서 실제로 보고 들은 발화·행동에 근거합니다. 영상에 없는 내용을 추측하거나 지어내지 않습니다.
2. 엄정한 채점: 채점표 척도(${SCALE_TEXT})를 따릅니다. 4점 이상은 기준을 분명히 충족한 경우에만 줍니다. 해당 요소가 영상에서 드러나지 않으면 1~2점을 주고, 근거에 "영상에서 확인되지 않음"과 보완 방법을 적습니다.
3. 타임스탬프: 영상 시작 기준 MM:SS 형식(예: 03:25)으로 적고, 영상 길이를 넘지 않습니다. 특정 장면이 아니라 전반적인 판단이면 at을 빈 문자열로 둡니다.
4. 인용: 수험생의 말을 인용할 때는 실제로 말한 표현을 최대한 그대로 적습니다.
5. 구체적 피드백: "더 노력하세요" 같은 일반론 대신, 다음 연습에서 바로 고칠 수 있는 행동·문장으로 제안합니다.
6. 문체: 한국어 '~합니다'체. 근거와 피드백은 각각 1~2문장으로 간결하게.
7. 영상 특성: 분석용 영상은 초당 1프레임으로 압축되어 있습니다. 프레임 사이의 짧은 동작은 보이지 않을 수 있으니, 연속된 프레임의 자세·시선·제스처 변화와 음성을 함께 보고 판단합니다.
8. 응답은 지정된 JSON 형식만 출력합니다.`;

function demoInstructions(): string {
  return `
[수업실연 평가 지침]
- conditionChecks: 문제지(텍스트·이미지)에 제시된 수업 조건을 빠짐없이 하나씩 추출해 충족(met)/부분 충족(partial)/미충족(missed)으로 판정합니다. 조건이 제시되지 않았으면 빈 배열로 둡니다.
- segments: 도입–전개–정리 흐름에 따라 주요 장면 6~12개를 시간순으로 고릅니다. 잘한 점(strength)과 보완점(improve, critical)을 균형 있게 담고, area에는 관련 채점 영역 id를 넣습니다.
- alternatives: 어느 수업에나 붙일 수 있는 만능틀·상투적 발문(예: "알겠죠?", "잘했어요", "재미있었나요?", "함께 해 봅시다", "다 같이 해 볼까요?")을 실제 발화에서 3~6개 찾습니다. 대체 발문은 수업 조건, 학습목표, 특수교육대상학생의 특성(의사소통 수준, AAC, 촉진 단계 등)을 반영해 교실에서 그대로 말할 수 있는 문장으로 씁니다.
- 특수교과의 수업 영역은 특수교육 현장 관점(개별화, 긍정적 행동지원, 기능적 교육과정, 안전, 지원인력 협력)에서 엄격하게 봅니다.`;
}

function interviewInstructions(): string {
  const types = QUESTION_TYPE_IDS.map((id) => {
    const t = QUESTION_TYPES[id];
    return `  - ${id} (type ${t.no} ${t.label}): ${t.focus.join(", ")}`;
  }).join("\n");
  const concepts = CONCEPT_CRITERION_IDS.map((id) => `${id}=${CONCEPT_CRITERIA[id].label}(${CONCEPT_CRITERIA[id].description})`).join(", ");
  const checklist = INTERVIEW_CHECKLIST.map(
    (g) => `  [${g.label}] ` + g.items.map((i) => `${i.id}: ${i.label}`).join(" / "),
  ).join("\n");
  return `
[심층면접 평가 지침]
- questions: 영상에서 답변한 문항을 시간순으로 구분합니다. 문항 번호, 구상형(prepared)/즉답형(instant), 문제 유형, 문항 요지, 시작·끝 타임스탬프를 적습니다. 문제지가 없으면 답변 내용으로 문항을 추정합니다.
  · 문항별 점수(scores): ${concepts} — 각 1~5점.
  · 문제 유형별 채점 기준을 함께 반영합니다:
${types}
  · keywordsCovered/keywordsMissed: 그 문항에서 언급한 핵심 개념어와, 언급했으면 좋았을 핵심 개념어.
- checklist: 아래 자기점검표 항목마다 pass(지킴)/fail(보완 필요)/na(영상에서 확인 불가)로 판정합니다. 입실·퇴실 장면이 영상에 없으면 해당 항목은 na로 두고 note는 빈 문자열입니다.
${checklist}
- segments: 주요 장면 6~12개를 시간순으로 고르고, area에는 관련 채점 영역 id를 넣습니다.
- alternatives: 어느 문항에나 쓸 수 있는 만능틀 답변(예: "~가 중요하다고 생각합니다", "최선을 다하겠습니다", "항상 노력하겠습니다", "학생 중심으로 하겠습니다")을 실제 발화에서 3~6개 찾고, 문제 상황에 맞춘 근거와 실천 방안이 담긴 대체 답변을 씁니다.`;
}

export function buildSystemInstruction(mode: EvalMode): string {
  const rubric = getRubric(mode);
  return `당신은 한국 초등 특수교사 임용시험 2차(심층면접·수업실연) 평가위원이자 특수교육 수업 컨설턴트입니다.
수험생의 연습 영상을 보고 아래 채점표에 따라 엄정하고 구체적으로 평가해, 수험생이 다음 연습에서 바로 개선할 수 있게 돕습니다.
${COMMON_RULES}

[채점표: ${rubric.title}] (scores의 키는 아래 영역 id → 세부 기준 id, 각 1~5점)
${rubricText(rubric)}
${mode === "demo" ? demoInstructions() : interviewInstructions()}`;
}

export function buildUserPrompt(input: {
  mode: EvalMode;
  promptText: string;
  hasImage: boolean;
  durationSec: number | null;
}): string {
  const lines = [
    `평가 모드: ${input.mode === "demo" ? "수업실연" : "심층면접 (구상형·즉답형)"}`,
    input.durationSec ? `영상 길이: ${formatSeconds(input.durationSec)} (타임스탬프는 이 범위 안에서)` : null,
    "",
    input.mode === "demo" ? "[문제지: 수업 조건·학습목표]" : "[문제지: 면접 문항]",
    input.promptText.trim() || (input.hasImage ? "(첨부한 문제지 이미지를 참고하세요)" : "(제공되지 않음 — 영상 내용만으로 판단하세요)"),
    input.hasImage && input.promptText.trim() ? "(첨부한 문제지 이미지도 함께 참고하세요)" : null,
    "",
    "위 영상을 채점표에 따라 평가해 JSON으로 답하세요.",
  ];
  return lines.filter((l) => l !== null).join("\n");
}
