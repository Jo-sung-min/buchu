"use client";
import Link from "next/link";
import { postCategoryLabels, postTime, type Post } from "@/lib/posts";
import { Icon } from "../icons";

/** One Blind-style feed line: anonymous avatar, topic, title, then view and comment counts. */
export function PostRow({ post, showTime = true }: { post: Post; showTime?: boolean }) {
  return <li className="home-row post-row">
    <span className="home-row-avatar home-row-avatar-anon" aria-hidden="true">익</span>
    <span className="home-row-topic">{postCategoryLabels[post.category] || post.category}</span>
    <Link href={`/community/${encodeURIComponent(post.id)}`} className="home-row-title">{post.title}{post.commentCount > 0 && <b className="post-row-comments">[{post.commentCount}]</b>}</Link>
    <span className="home-row-counts">
      {showTime && <time dateTime={post.createdAt}>{postTime(post.createdAt)}</time>}
      <span aria-label={`조회 ${post.viewCount}`}><Icon name="eye" size={13} />{post.viewCount}</span>
      <span aria-label={`댓글 ${post.commentCount}`}><Icon name="comment" size={13} />{post.commentCount}</span>
    </span>
  </li>;
}
