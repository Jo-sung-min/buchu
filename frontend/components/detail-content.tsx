import { Fragment, type CSSProperties, type ReactNode } from "react";
import type { RichDocument } from "@/lib/submissions";

export function safeContentUrl(value: unknown, image = false): string | undefined {
  if (typeof value !== "string" || /[\u0000-\u0020\u007f\\]/.test(value)) return undefined;
  if (image && /^\/api\/media\/[a-f0-9-]+(?:\?[^#]*)?$/i.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.username || url.password) return undefined;
    if (["https:", "http:"].includes(url.protocol) || (!image && url.protocol === "mailto:")) return value;
  } catch { /* Unsupported and relative URLs are not rendered. */ }
  return undefined;
}

function color(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value) ? value : undefined;
}
function textStyle(attrs: Record<string, unknown>): CSSProperties {
  const align = String(attrs.textAlign || "");
  return { textAlign: ["left", "center", "right", "justify"].includes(align) ? align as CSSProperties["textAlign"] : undefined };
}
function renderNode(node: RichDocument, key: string, depth = 0): ReactNode {
  if (!node || depth > 24) return null;
  const attrs = node.attrs || {};
  const children = node.content?.slice(0, 1500).map((child, index) => renderNode(child, `${key}-${index}`, depth + 1));
  if (node.type === "text") {
    let text: ReactNode = typeof node.text === "string" ? node.text : "";
    for (const [index, mark] of (node.marks || []).slice(0, 10).entries()) {
      const markKey = `${key}-mark-${index}`;
      switch (mark.type) {
        case "bold": text = <strong key={markKey}>{text}</strong>; break;
        case "italic": text = <em key={markKey}>{text}</em>; break;
        case "underline": text = <u key={markKey}>{text}</u>; break;
        case "strike": text = <s key={markKey}>{text}</s>; break;
        case "code": text = <code key={markKey}>{text}</code>; break;
        case "textStyle": text = <span key={markKey} style={{ color: color(mark.attrs?.color) }}>{text}</span>; break;
        case "highlight": text = <mark key={markKey} style={{ backgroundColor: color(mark.attrs?.color) }}>{text}</mark>; break;
        case "link": {
          const href = safeContentUrl(mark.attrs?.href);
          if (href) text = <a key={markKey} href={href} target="_blank" rel="noopener noreferrer nofollow">{text}</a>;
          break;
        }
      }
    }
    return <Fragment key={key}>{text}</Fragment>;
  }
  switch (node.type) {
    case "doc": return <Fragment key={key}>{children}</Fragment>;
    case "paragraph": return <p key={key} style={textStyle(attrs)}>{children?.length ? children : <br />}</p>;
    case "heading": {
      const level = Number(attrs.level);
      if (level === 1) return <h2 key={key} className="rich-heading-large" style={textStyle(attrs)}>{children}</h2>;
      if (level === 3) return <h4 key={key} style={textStyle(attrs)}>{children}</h4>;
      return <h3 key={key} style={textStyle(attrs)}>{children}</h3>;
    }
    case "bulletList": return <ul key={key}>{children}</ul>;
    case "orderedList": return <ol key={key} type={typeof attrs.type === "string" && ["1", "a", "A", "i", "I"].includes(attrs.type) ? attrs.type as "1" | "a" | "A" | "i" | "I" : undefined} start={Math.min(10000, Math.max(1, Number(attrs.start) || 1))}>{children}</ol>;
    case "listItem": return <li key={key}>{children}</li>;
    case "blockquote": return <blockquote key={key}>{children}</blockquote>;
    case "hardBreak": return <br key={key} />;
    case "horizontalRule": return <hr key={key} />;
    case "codeBlock": return <pre key={key}><code>{children}</code></pre>;
    case "image": {
      const src = safeContentUrl(attrs.src, true);
      if (!src) return null;
      const width = typeof attrs.width === "number" && Number.isFinite(attrs.width) ? Math.max(80, Math.min(1600, attrs.width)) : undefined;
      return <figure key={key} style={{ width: width ? `${width}px` : undefined }}><img src={src} alt={typeof attrs.alt === "string" ? attrs.alt : "서비스 소개 이미지"} loading="lazy" referrerPolicy="no-referrer" />{typeof attrs.title === "string" && attrs.title && <figcaption>{attrs.title}</figcaption>}</figure>;
    }
    case "table": return <div key={key} className="rich-table-scroll"><table><tbody>{children}</tbody></table></div>;
    case "tableRow": return <tr key={key}>{children}</tr>;
    case "tableCell": case "tableHeader": {
      const Cell = node.type === "tableHeader" ? "th" : "td";
      return <Cell key={key} style={textStyle({ textAlign: attrs.align || attrs.textAlign })} colSpan={Math.min(20, Math.max(1, Number(attrs.colspan) || 1))} rowSpan={Math.min(100, Math.max(1, Number(attrs.rowspan) || 1))}>{children}</Cell>;
    }
    default: return null;
  }
}

export function DetailContent({ content, className = "" }: { content?: RichDocument | null; className?: string }) {
  return <div className={`rich-content ${className}`}>{content ? renderNode(content, "document") : <p>등록된 상세 내용이 없습니다.</p>}</div>;
}
