# 임용 2차 AI 코치 (imyong-coach)

심층면접(구상형·즉답형)·수업실연 연습 영상을 **브라우저에서 압축 → Gemini 멀티모달 분석 → 루브릭 리포트**로 보여 주는 로컬 실행용 웹 도구입니다.
별도 백엔드 서버·DB 없이 Next.js 하나로 동작합니다.

## 실행 방법

```bash
cd imyong-coach
npm install                 # postinstall이 ffmpeg.wasm 코어를 public/ffmpeg 로 복사
cp .env.example .env.local  # GEMINI_API_KEY 입력
npm run dev                 # http://localhost:3000
```

| 스크립트 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` / `npm start` | 프로덕션 빌드 / 실행 |
| `npm run lint` · `npm run typecheck` | 코드 검사 |

## 기술 스택

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · zustand(세션 상태) · zod(리포트 스키마) · `@ffmpeg/ffmpeg`(브라우저 압축) · `@google/genai`(Gemini File API · Structured Output) · lucide-react(아이콘)

## 디렉터리 구조

```
imyong-coach/
├─ .env.example                  # GEMINI_API_KEY, GEMINI_MODEL
├─ scripts/copy-ffmpeg-core.mjs  # postinstall: ffmpeg.wasm 코어 → public/ffmpeg (오프라인 동작)
└─ src/
   ├─ app/
   │  ├─ page.tsx                # ① 입력 화면 (모드·문제·영상)
   │  ├─ report/page.tsx         # ③ 리포트 대시보드 (영상 | 리포트 2단)
   │  └─ api/analyze/route.ts    # [2~3단계] Gemini 업로드·분석 (API 키는 서버에서만 사용)
   ├─ components/
   │  ├─ layout/                 # 헤더·내비게이션
   │  ├─ ui/                     # Card 등 공용 UI
   │  ├─ input/                  # ModeToggle, PromptInput, VideoDropzone, WebcamRecorder
   │  └─ report/                 # VideoPanel, ScoreOverview, SegmentFeedbackList, AlternativeList,
   │                             # VideoSeekContext(타임스탬프 → 영상 점프)
   └─ lib/
      ├─ rubrics/                # 채점표 (영역 → 세부 기준). 문구 수정은 여기서만
      │  ├─ demo.ts              #   수업실연: 기본 자세 · 수업 운영 능력 · 특수교과의 수업
      │  └─ interview.ts         #   심층면접: 공고문 5영역 + 태도·전달력, 문항 유형, 자기점검표
      ├─ schema/report.ts        # 리포트 스키마 = UI 타입 + Gemini 응답 스키마(채점표에서 자동 생성) + 검증
      ├─ store.ts                # 브라우저 메모리 세션 (새로고침 시 초기화)
      ├─ constants.ts            # 모드·루브릭·라벨 메타데이터
      ├─ mock/sampleReport.ts    # 레이아웃 확인용 샘플 리포트
      ├─ ffmpeg/                 # [2단계] 480p·저fps 압축 / 오디오 분리
      └─ gemini/                 # [3단계] 서버 전용 Gemini 클라이언트·프롬프트
```

## 채점표

『끈기 임용 2차 초등특수』 심층면접·수업실연 채점 기준표를 요약·재구성했습니다.

| 모드 | 채점 영역 (세부 기준마다 1~5점) | 추가 평가 |
| --- | --- | --- |
| 수업실연 | 교사의 기본 자세(8) · 수업 운영 능력(5) · 특수교과의 수업(6) | 수업 조건별 반영 여부 |
| 심층면접 | 교직 적성 · 교직관 · 인격 및 소양 · 의사소통 능력 · 학습지도 능력 · 태도·전달력 | 문항별 평가(개념 이해·문제 분석·해결 방안·의지 + 문제 유형 type 1~10), 자기점검표 |

- 영역 점수 = 세부 기준 평균, 종합 점수 = 영역 평균 ÷ 5 × 100 (코드에서 계산)
- `src/lib/rubrics/*.ts`의 기준을 고치면 화면과 AI 응답 스키마가 함께 바뀝니다.

## 진행 단계

- [x] **1단계** — 프로젝트 세팅, 입력 화면, 2단 리포트 레이아웃(샘플 데이터), 타임스탬프 클릭 → 영상 이동
- [x] **1.5단계** — 교재 채점 기준표 기반 모드별 채점표·리포트 탭(종합/문항별/채점표/구간 피드백/대체 표현/자기점검표)
- [ ] **2단계** — 웹캠 녹화(MediaRecorder), ffmpeg.wasm 전처리(480p·1~2fps·오디오 분리)
- [ ] **3단계** — Gemini File API 업로드 + Structured Output 분석, 진행 상태 표시, 실제 리포트 연결
