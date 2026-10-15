import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "결제 안내", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function PaymentFail({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const canceled = query.code === "PAY_PROCESS_CANCELED" || query.code === "USER_CANCEL";
  return <div className="container course-payment-result"><span className="section-kicker">BUCHU CLASS</span><h1>{canceled ? "결제를 중단했어요" : "결제가 완료되지 않았어요"}</h1><p>{canceled ? "준비되었을 때 다시 시작할 수 있어요." : "결제 수단과 주문 상태를 확인해 주세요. 이미 금액이 결제되었다면 추가 구매 전 수강 문의로 주문을 확인해주세요."}</p><p>내 강의실에서 저장된 주문 상태를 확인할 수 있습니다.</p><Link href="/classroom" className="button button-green">내 주문 확인하기</Link><Link href="/courses" className="course-classroom-link">부업 클래스 둘러보기</Link></div>;
}
