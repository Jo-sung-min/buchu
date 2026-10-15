import type { Metadata } from "next";
import SubmissionForm from "@/components/submissions/submission-form";

export const metadata: Metadata = {
  title: "기업 게재 신청",
  description: "모두의 마케터에 프로그램을 소개하거나 도와줘!에 홍보·인재 모집을 신청하세요. 기업 정보와 상세페이지를 등록할 수 있어요.",
  robots: { index: false, follow: false },
};

export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ board?: string | string[] }> }) {
  const { board } = await searchParams;
  return <SubmissionForm initialBoard={board === "HELP" ? "HELP" : "MARKETER"} />;
}
