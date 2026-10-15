import type { Metadata } from "next";
import { PaymentResult } from "@/components/courses/payment-result";
export const metadata: Metadata = { title: "결제 확인", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function PaymentSuccess({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const value = (key: string) => typeof query[key] === "string" ? query[key].slice(0, 200) : "";
  return <PaymentResult orderId={value("orderId")} paymentKey={value("paymentKey")} amount={value("amount")} />;
}
