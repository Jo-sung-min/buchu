import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "회원가입", robots: { index: false, follow: true } };

export default function RegisterPage() {
  return <div className="review-write-page container auth-page"><Link href="/" className="review-back-link">← 홈</Link><div className="review-write-heading"><h1>회원가입</h1></div><Suspense><AuthForm mode="register" /></Suspense></div>;
}
