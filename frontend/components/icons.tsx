import type { CSSProperties } from "react";

export type IconName = "arrow" | "arrow-up" | "search" | "bookmark" | "check" | "link" | "spark" | "chevron" | "close" | "book" | "globe" | "leaf" | "info" | "sliders" | "heart" | "settings" | "sun" | "moon" | "comment" | "eye";
export function Icon({ name, size = 20, className = "", style }: { name: IconName; size?: number; className?: string; style?: CSSProperties }) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <><path d="M4 12h15M13 5l7 7-7 7" /></>,
    "arrow-up": <><path d="M6 18 18 6M6 6h12v12" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    bookmark: <path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4z" />,
    check: <path d="m5 12 4 4L19 6" />,
    link: <><path d="m9 15 6-6M8 16l-1 1a4.2 4.2 0 0 1-6-6l4-4a4.2 4.2 0 0 1 6 0M16 8l1-1a4.2 4.2 0 0 1 6 6l-4 4a4.2 4.2 0 0 1-6 0" transform="translate(1 -1) scale(.9)" /></>,
    spark: <><path d="m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8z" /></>,
    chevron: <path d="m9 5 7 7-7 7" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    book: <><path d="M12 5v16M3 4c4-1 6-1 9 1 3-2 5-2 9-1v15c-4-1-6-1-9 2-3-3-5-3-9-2z" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
    leaf: <><path d="M19 3C9 2 2 8 6 16c7 5 14-1 13-13Z" /><path d="m4 21 10-11" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
    sliders: <><path d="M4 7h5m4 0h7M4 17h9m4 0h3" /><circle cx="11" cy="7" r="2" /><circle cx="15" cy="17" r="2" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
    settings: <><path d="m9.5 3-.6 2.3-2 .9L4.7 5.5 2.2 9.8 4 11.4v2.2l-1.8 1.6 2.5 4.3 2.2-.7 2 .9.6 2.3h5l.6-2.3 2-.9 2.2.7 2.5-4.3-1.8-1.6v-2.2l1.8-1.6-2.5-4.3-2.2.7-2-.9-.6-2.3z" transform="translate(0 -.5)" /><circle cx="12" cy="12" r="3" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    moon: <path d="M20.5 13.4A8.5 8.5 0 0 1 10.6 3.5a8.5 8.5 0 1 0 9.9 9.9Z" />,
    comment: <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 4v-4H6a2 2 0 0 1-2-2z" />,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}>{paths[name]}</svg>;
}

export function BuchuMark({ size = 32 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M19 34C7 30 4 17 7 7c8 3 14 13 12 27Z" fill="currentColor" /><path d="M21 34c-5-17 0-28 9-32 4 13 1 25-9 32Z" fill="currentColor" /><path d="M22 34c0-10 5-17 14-20 1 11-4 18-14 20Z" fill="currentColor" /></svg>;
}
