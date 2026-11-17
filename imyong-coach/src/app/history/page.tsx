import type { Metadata } from "next";
import { HistoryPage } from "@/components/history/HistoryPage";

export const metadata: Metadata = { title: "분석 기록 · 임용 2차 AI 코치" };

export default function Page() {
  return <HistoryPage />;
}
