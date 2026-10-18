import Link from "next/link";
import type { Metadata } from "next";
import { AdApplyForm } from "@/components/ads/ad-apply-form";
import { adMonthlyPrice, adTotalSlots, krw } from "@/lib/ads";

export const metadata: Metadata = { title: "내 사이트 광고하기", description: "부추 양옆 스폰서 자리에 내 사이트를 월 30만 원으로 홍보하세요." };

export default function AdApplyPage() {
  return <div className="review-write-page container ad-apply-page">
    <Link href="/" className="review-back-link">← 홈</Link>
    <div className="review-write-heading"><h1>내 사이트 광고하기</h1></div>
    <section className="ad-pricing" aria-label="광고 안내">
      <div className="ad-pricing-price"><span>스폰서 타일</span><strong>월 {krw(adMonthlyPrice)}</strong><small>부가세 별도 · 총 {adTotalSlots}자리</small></div>
      <ul>
        <li>PC 화면 양옆 스폰서 영역에 사이트 이름, 한 줄 소개, 링크가 담긴 타일로 노출돼요.</li>
        <li>부추의 모든 공개 페이지(홈, 전체 글, 부업 정보, 기업 홍보, 부업 클래스)에 함께 나와요.</li>
        <li>신청하면 담당자 이메일로 결제 안내를 보내 드리고, 입금이 확인되면 게재가 시작돼요.</li>
        <li>부업·재테크와 무관하거나 사기·불법 가능성이 있는 사이트는 게재가 거절될 수 있어요.</li>
      </ul>
    </section>
    <AdApplyForm />
  </div>;
}
