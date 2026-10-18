import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "로그인", robots: { index: false, follow: true } };

export default function LoginPage() {
  return <div className="review-write-page container auth-page"><Link href="/" className="review-back-link">← 홈</Link><div className="review-write-heading"><h1>로그인</h1></div><Suspense><AuthForm mode="login" /></Suspense></div>;
}
