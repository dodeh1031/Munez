import { AnalysisInputForm } from "@/components/input/AnalysisInputForm";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">연습 영상 AI 분석</h1>
        <p className="mt-2 text-slate-600">
          심층면접·수업실연 연습 영상을 올리면 루브릭 점수, 구간별 피드백, 만능틀 탈피 제안을 받아볼 수 있어요.
        </p>
      </div>
      <AnalysisInputForm />
    </div>
  );
}
