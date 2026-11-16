import type { Metadata } from "next";
import { ReportDashboard } from "@/components/report/ReportDashboard";

export const metadata: Metadata = { title: "분석 리포트 · 임용 2차 AI 코치" };

export default function ReportPage() {
  return <ReportDashboard />;
}
