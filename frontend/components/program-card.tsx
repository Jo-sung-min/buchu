"use client";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { Program } from "@/lib/types";
import { Icon } from "./icons";
import { useSaved } from "./saved-provider";

export function BrandAvatar({ program, large = false }: { program: Program; large?: boolean }) {
  return <span className={`brand-avatar ${large ? "brand-avatar-large" : ""}`} style={{ "--brand-color": program.brandColor } as CSSProperties}>{program.initials}</span>;
}
export function SaveButton({ program, full = false }: { program: Program; full?: boolean }) {
  const { saved, ready, toggle } = useSaved();
  const active = saved.includes(program.slug);
  return <button className={`${full ? "button button-outline save-full" : "save-button"} ${active ? "is-saved" : ""}`} onClick={() => toggle(program.slug)} disabled={!ready} aria-label={`${program.name} ${active ? "저장 취소" : "저장"}`} aria-pressed={active}><Icon name="bookmark" size={19} />{full && (active ? "관심 부업에 저장됨" : "관심 부업에 저장")}</button>;
}
export function ProgramCard({ program }: { program: Program }) {
  return <article className="program-card"><div className="card-top"><BrandAvatar program={program} /><SaveButton program={program} /></div><div className="card-heading"><Link href={`/programs/${program.slug}`}><h3>{program.name}</h3></Link>{program.featured && <span className="recommend-badge">부추 PICK</span>}</div><p className="card-tagline">{program.tagline}</p><div className="card-tags">{program.tags.slice(0, 2).map(tag => <span key={tag}>{tag}</span>)}</div><dl className="card-facts"><div><dt>수익 방식</dt><dd>{program.commission}</dd></div><div><dt>시작 비용</dt><dd className={program.cost === "free" ? "text-green" : ""}>{program.costLabel}</dd></div></dl><Link href={`/programs/${program.slug}`} className="card-cta">어떤 부업인지 살펴보기 <Icon name="arrow-up" size={18} /></Link></article>;
}
