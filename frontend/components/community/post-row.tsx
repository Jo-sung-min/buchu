"use client";
import Link from "next/link";
import { authorInitial, authorLabel, postCategoryLabels, postTime, type Post } from "@/lib/posts";
import { Icon } from "../icons";

/** One Blind-style feed line: author avatar, topic, title, then view and comment counts. */
export function PostRow({ post, showTime = true }: { post: Post; showTime?: boolean }) {
  const member = post.authorType === "MEMBER";
  return <li className="home-row post-row">
    <span className={`home-row-avatar home-row-avatar-anon${member ? " is-member" : ""}`} aria-hidden="true">{authorInitial(post)}</span>
    <span className="home-row-topic">{postCategoryLabels[post.category] || post.category}</span>
    <Link href={`/community/${encodeURIComponent(post.id)}`} className="home-row-title">{post.title}{post.commentCount > 0 && <b className="post-row-comments">[{post.commentCount}]</b>}{post.images?.length > 0 && <span className="post-row-photo" aria-label={`사진 ${post.images.length}장`} title={`사진 ${post.images.length}장`}><img src={post.images[0].url} alt="" loading="lazy" />{post.images.length > 1 && <b>{post.images.length}</b>}</span>}</Link>
    <span className={`post-row-author${member ? " is-member" : ""}`} title={member ? "회원" : "비회원"}>{authorLabel(post)}</span>
    <span className="home-row-counts">
      {showTime && <time dateTime={post.createdAt}>{postTime(post.createdAt)}</time>}
      <span aria-label={`조회 ${post.viewCount}`}><Icon name="eye" size={13} />{post.viewCount}</span>
      <span aria-label={`댓글 ${post.commentCount}`}><Icon name="comment" size={13} />{post.commentCount}</span>
    </span>
  </li>;
}
