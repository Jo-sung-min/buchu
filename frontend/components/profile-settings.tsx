"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ageGroupLabels, ageGroups, type AgeGroup } from "@/lib/types";
import { announceMemberChange, updateProfile } from "@/lib/auth";
import { useAuth } from "./auth-provider";

/** Member profile: the age group drives the "내 나이대 추천" filter on the side-job board. */
export function ProfileSettings() {
  const { member, ready, refresh } = useAuth();
  const [ageGroup, setAgeGroup] = useState<AgeGroup | "">("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { setAgeGroup(member?.ageGroup || ""); }, [member]);

  async function save() {
    if (busy || !member) return;
    setBusy(true); setError(""); setStatus("");
    try {
      await updateProfile(ageGroup || null);
      await refresh();
      announceMemberChange();
      setStatus(ageGroup ? `${ageGroupLabels[ageGroup]} 추천 부업이 부업 정보에 먼저 보여요.` : "나이대를 지웠어요. 모든 부업이 보여요.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "저장하지 못했어요. 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }

  return <section className="settings-panel" aria-labelledby="profile-heading">
    <h2 id="profile-heading">내 정보</h2>
    {!ready ? <p role="status">불러오는 중…</p> : !member ? <p>나이대를 저장해 두면 부업 정보에서 내게 맞는 부업을 먼저 보여드려요. <Link href="/login?next=%2Fsettings">로그인</Link> 또는 <Link href="/register?next=%2Fsettings">회원가입</Link> 후 설정할 수 있어요.</p> : <>
      <p><b>{member.nickname}</b> 님 · 아이디 {member.username}</p>
      <div className="profile-field">
        <label htmlFor="profile-age">나이대</label>
        <div className="profile-field-row">
          <select id="profile-age" value={ageGroup} onChange={event => setAgeGroup(event.target.value as AgeGroup | "")} disabled={busy}>
            <option value="">선택 안 함</option>
            {ageGroups.map(value => <option key={value} value={value}>{ageGroupLabels[value]}</option>)}
          </select>
          <button type="button" className="review-button review-button-primary" onClick={save} disabled={busy || (member.ageGroup || "") === ageGroup}>{busy ? "저장 중…" : "저장"}</button>
        </div>
        <span className="review-character-count">부업 정보 목록이 이 나이대 추천 부업을 먼저 보여줘요. 다른 사람에게는 공개되지 않아요.</span>
      </div>
      {status && <p className="profile-status" role="status">{status}</p>}
      {error && <p className="review-error" role="alert">{error}</p>}
    </>}
  </section>;
}
