"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { login, register } from "@/lib/auth";
import { ageGroupLabels, ageGroups, type AgeGroup } from "@/lib/types";
import { useAuth } from "../auth-provider";

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const id = useId();
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [ageGroup, setAgeGroup] = useState<AgeGroup | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const next = safeNext(params.get("next"));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (mode === "register" && !/^[a-z0-9_]{4,20}$/.test(username.trim().toLowerCase())) { setError("아이디는 영문 소문자, 숫자, 밑줄 4~20자로 입력해 주세요."); return; }
    if (password.length < 8) { setError("비밀번호는 8자 이상이어야 해요."); return; }
    setBusy(true);
    try {
      if (mode === "register") await register(username.trim().toLowerCase(), password, nickname.trim(), ageGroup || null);
      else await login(username.trim(), password);
      await refresh();
      router.push(next);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "요청을 처리하지 못했어요. 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  return <form className="review-form auth-form" onSubmit={submit} aria-label={mode === "login" ? "로그인" : "회원가입"}>
    <div className="review-field"><label htmlFor={`${id}-username`}>아이디</label><input id={`${id}-username`} value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" placeholder={mode === "register" ? "영문 소문자·숫자·밑줄 4~20자" : "아이디"} maxLength={20} required disabled={busy} autoCapitalize="none" /></div>
    <div className="review-field"><label htmlFor={`${id}-password`}>비밀번호</label><input id={`${id}-password`} type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder={mode === "register" ? "8자 이상" : "비밀번호"} minLength={8} maxLength={72} required disabled={busy} /></div>
    {mode === "register" && <div className="review-field"><label htmlFor={`${id}-nickname`}>닉네임</label><input id={`${id}-nickname`} value={nickname} onChange={event => setNickname(event.target.value)} placeholder="글에 표시될 이름, 2~12자" minLength={2} maxLength={12} required disabled={busy} /><span className="review-character-count">공백·괄호 없이. 나중에 바꿀 수 없어요.</span></div>}
    {mode === "register" && <div className="review-field"><label htmlFor={`${id}-age`}>나이대 <small>(선택)</small></label><select id={`${id}-age`} value={ageGroup} onChange={event => setAgeGroup(event.target.value as AgeGroup | "")} disabled={busy}><option value="">선택 안 함</option>{ageGroups.map(value => <option key={value} value={value}>{ageGroupLabels[value]}</option>)}</select><span className="review-character-count">내 나이대에 맞는 추천 부업을 먼저 보여드려요. 설정에서 언제든 바꿀 수 있고 다른 사람에게는 보이지 않아요.</span></div>}
    {mode === "register" && <div className="review-writing-note"><strong>로그인 없이도 글은 쓸 수 있어요.</strong><p>비회원 글은 디시처럼 <b>ㅇㅇ(118.235)</b> 형태로 IP 앞자리가 붙고, 회원 글은 닉네임으로 올라가요. 회원은 삭제 코드 없이 내 글을 지울 수 있어요.</p></div>}
    {error && <p className="review-error" role="alert">{error}</p>}
    <div className="review-form-actions">
      <span>{mode === "login" ? <>아직 계정이 없나요? <Link href={`/register${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}>회원가입</Link></> : <>이미 계정이 있나요? <Link href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}>로그인</Link></>}</span>
      <button type="submit" className="review-button review-button-primary" disabled={busy}>{busy ? "처리 중…" : mode === "login" ? "로그인" : "가입하고 시작하기"}</button>
    </div>
  </form>;
}
