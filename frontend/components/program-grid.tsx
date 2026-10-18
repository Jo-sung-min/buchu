"use client";
import Link from "next/link";
import { type Program, channelLabels, difficultyLabels, programCategoryLabel } from "@/lib/types";
import { BrandAvatar, SaveButton } from "./program-card";
import { Icon } from "./icons";

type Stat = { reviewCount: number; averageRating: number | null };

/** Side-job catalogue as cards: what it is, how you earn, what it costs, how hard it is — at a glance. */
export function ProgramGrid({ items, stats, loaded, statsError }: { items: Program[]; stats: Map<string, Stat>; loaded: boolean; statsError: boolean }) {
  return <div className="program-cards">
    {items.map(program => {
      const stat = stats.get(program.slug);
      const href = `/programs/${program.slug}`;
      return <article className="program-tile" key={program.slug}>
        <div className="program-tile-top">
          <BrandAvatar program={program} />
          <div className="program-tile-labels"><span className="program-tile-category">{programCategoryLabel(program.category)}</span><span className={`program-tile-level level-${program.difficulty}`}>{difficultyLabels[program.difficulty]}</span>{program.featured && <span className="program-tile-pick">PICK</span>}</div>
          <SaveButton program={program} />
        </div>
        <h3><Link href={href}>{program.name}</Link></h3>
        <p className="program-tile-tagline">{program.tagline}</p>
        <p className="program-tile-description">{program.description}</p>
        <dl className="program-tile-facts">
          <div><dt>수익 방식</dt><dd>{program.commission}</dd></div>
          <div><dt>시작 비용</dt><dd className={program.cost === "free" ? "is-free" : ""}>{program.costLabel}</dd></div>
          <div><dt>활동 채널</dt><dd>{program.channels.map(channel => channelLabels[channel]).join(" · ")}</dd></div>
        </dl>
        <div className="program-tile-bottom">
          <Link href={`${href}#reviews`} className="program-tile-rating"><span className={stat?.reviewCount ? "rating-star" : "rating-star empty"}>★</span>{statsError ? "후기 확인" : stat?.reviewCount && stat.averageRating != null ? <><b>{stat.averageRating.toFixed(1)}</b> 후기 {stat.reviewCount}</> : loaded ? "첫 후기를 기다려요" : "후기 불러오는 중"}</Link>
          <Link href={`${href}#how-to`} className="program-tile-cta">시작 방법 보기 <Icon name="arrow" size={14} /></Link>
        </div>
      </article>;
    })}
  </div>;
}
