"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { DetailContent } from "@/components/detail-content";
import type { RichDocument, UploadedImage } from "@/lib/submissions";

const UploadedImageNode = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      uploadId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-upload-id"),
        renderHTML: (attributes: Record<string, unknown>) => attributes.uploadId ? { "data-upload-id": attributes.uploadId } : {},
      },
    };
  },
});

const text = (value: string): RichDocument => ({ type: "text", text: value });
const paragraph = (value: string): RichDocument => ({ type: "paragraph", content: [text(value)] });
const heading = (value: string): RichDocument => ({ type: "heading", attrs: { level: 2 }, content: [text(value)] });
const starterTemplate: RichDocument = {
  type: "doc",
  content: [
    heading("좋아하는 것을 소개하고, 새로운 수익을 만나세요"),
    paragraph("우리 서비스가 어떤 경험을 제공하는지 소개해 주세요. 참여자가 상품을 추천하고 성과에 따라 보상을 받는 과정을 알기 쉽게 설명하면 좋아요."),
    { type: "blockquote", content: [paragraph("이런 분께 추천해요 · 자신만의 채널에서 좋은 제품과 서비스를 소개하고 싶은 분")] },
    heading("이렇게 참여해요"),
    { type: "orderedList", content: ["공식 사이트에서 가입하고 참여 조건을 확인해요.", "나만의 추천 링크를 발급받아요.", "운영 중인 채널에 소개하고 성과를 확인해요."].map((value) => ({ type: "listItem", content: [paragraph(value)] })) },
    heading("수익과 정산을 확인하세요"),
    { type: "table", content: [
      { type: "tableRow", content: ["항목", "안내"].map((value) => ({ type: "tableHeader", content: [paragraph(value)] })) },
      ...[["보상 기준", "실제 지급 기준과 예외 조건을 입력해 주세요."], ["정산 주기", "정산일, 최소 지급 금액을 입력해 주세요."], ["참여 비용", "무료 여부와 추가 비용을 입력해 주세요."]].map((row) => ({ type: "tableRow", content: row.map((value) => ({ type: "tableCell", content: [paragraph(value)] })) })),
    ] },
    heading("시작하기 전에 알아두세요"),
    { type: "bulletList", content: ["참여 대상과 채널 운영 조건을 구체적으로 알려 주세요.", "광고 표시, 금지 행위 등 꼭 알아야 할 운영 정책을 안내해 주세요."].map((value) => ({ type: "listItem", content: [paragraph(value)] })) },
    paragraph("아래에 서비스 화면이나 안내 이미지를 넣어 소개를 완성해 보세요."),
  ],
};

export default function DetailEditor({ value, onChange, onImageUpload, disabled, uploading }: {
  value: RichDocument;
  onChange: (value: RichDocument) => void;
  onImageUpload: (file: File) => Promise<UploadedImage>;
  disabled: boolean;
  uploading: boolean;
}) {
  const [preview, setPreview] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  const [localError, setLocalError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, defaultProtocol: "https", isAllowedUri: (url) => /^(https?:\/\/|mailto:)/i.test(url) } }),
      UploadedImageNode.configure({ allowBase64: false }),
      TableKit.configure({ table: { resizable: false } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle, Color, Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: "서비스의 장점과 참여 방법을 자유롭게 소개해 주세요. 위의 ‘소개 양식 넣기’로 시작할 수도 있어요." }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: { attributes: { "aria-label": "상세페이지 내용", role: "textbox", "aria-multiline": "true", spellcheck: "false" } },
    onUpdate: ({ editor: current }) => onChangeRef.current(current.getJSON() as RichDocument),
  });
  const selected = useEditorState({ editor, selector: ({ editor: current }) => ({
    bold: current?.isActive("bold"), italic: current?.isActive("italic"), underline: current?.isActive("underline"),
    bulletList: current?.isActive("bulletList"), orderedList: current?.isActive("orderedList"), blockquote: current?.isActive("blockquote"),
    highlight: current?.isActive("highlight"), link: current?.isActive("link"), table: current?.isActive("table"),
    left: current?.isActive({ textAlign: "left" }), center: current?.isActive({ textAlign: "center" }), right: current?.isActive({ textAlign: "right" }),
    heading: current?.isActive("heading") ? String(current.getAttributes("heading").level) : "0",
    undo: current?.can().undo() ?? false, redo: current?.can().redo() ?? false,
  }) });

  useEffect(() => { editor?.setEditable(!disabled, false); }, [editor, disabled]);
  useEffect(() => {
    if (editor && JSON.stringify(editor.getJSON()) !== JSON.stringify(value)) editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  const addImage = async (file: File) => {
    if (!editor || disabled) return;
    setLocalError("");
    try {
      const result = await onImageUpload(file);
      editor.chain().focus().insertContent({ type: "image", attrs: { uploadId: result.uploadId, src: result.url, alt: file.name } }).run();
    } catch (error) { setLocalError(error instanceof Error ? error.message : "이미지를 등록하지 못했어요."); }
  };

  const addLink = () => {
    if (!editor) return;
    if (!link.trim()) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else {
      try {
        const url = new URL(link.trim());
        if (!["https:", "http:", "mailto:"].includes(url.protocol)) throw new Error();
        editor.chain().focus().extendMarkRange("link").setLink({ href: url.href }).run();
      } catch { setLocalError("https:// 또는 http://로 시작하는 주소, 이메일 링크를 입력해 주세요."); return; }
    }
    setLinkOpen(false);
    setLocalError("");
  };
  const button = (label: string, content: React.ReactNode, action: () => void, active?: boolean, unavailable = false) => (
    <button type="button" title={label} aria-label={label} aria-pressed={active} className={active ? "editor-tool is-active" : "editor-tool"} disabled={disabled || unavailable || !editor} onClick={action}>{content}</button>
  );

  return <div className="submission-editor">
    <div className="editor-topline">
      <div className="editor-view-tabs" role="group" aria-label="상세페이지 보기 방식">
        <button type="button" className={!preview ? "active" : ""} aria-pressed={!preview} onClick={() => setPreview(false)}>내용 편집</button>
        <button type="button" className={preview ? "active" : ""} aria-pressed={preview} onClick={() => setPreview(true)}>미리보기</button>
      </div>
      <button type="button" className="editor-template" disabled={disabled || !editor} onClick={() => {
        if (editor && (editor.isEmpty || window.confirm("작성한 상세페이지를 소개 양식으로 바꿀까요? 현재 내용은 사라져요."))) editor.commands.setContent(starterTemplate);
      }}>✧ 소개 양식 넣기</button>
    </div>
    {!preview && <>
      <div className="editor-toolbar" role="group" aria-label="상세페이지 꾸미기">
        <label className="editor-heading-select"><span className="submission-sr-only">문단 스타일</span><select value={selected?.heading ?? "0"} disabled={disabled || !editor} onChange={(event) => {
          const level = Number(event.target.value);
          if (level) editor?.chain().focus().setHeading({ level: level as 1 | 2 | 3 }).run();
          else editor?.chain().focus().setParagraph().run();
        }}><option value="0">본문</option><option value="1">큰 제목</option><option value="2">제목</option><option value="3">작은 제목</option></select></label>
        <span className="editor-divider" />
        {button("굵게", <b>B</b>, () => editor?.chain().focus().toggleBold().run(), selected?.bold)}
        {button("기울임", <i>I</i>, () => editor?.chain().focus().toggleItalic().run(), selected?.italic)}
        {button("밑줄", <u>U</u>, () => editor?.chain().focus().toggleUnderline().run(), selected?.underline)}
        <label className="editor-color-tool" title="글자 색"><span>A</span><input type="color" aria-label="글자 색" defaultValue="#285c40" disabled={disabled || !editor} onChange={(event) => editor?.chain().focus().setColor(event.target.value).run()} /></label>
        {button("형광펜", <span className="editor-highlight-mark">가</span>, () => editor?.chain().focus().toggleHighlight({ color: "#edf3c3" }).run(), selected?.highlight)}
        <span className="editor-divider" />
        {button("글머리 기호", "• 목록", () => editor?.chain().focus().toggleBulletList().run(), selected?.bulletList)}
        {button("번호 목록", "1. 목록", () => editor?.chain().focus().toggleOrderedList().run(), selected?.orderedList)}
        {button("인용문", "❞", () => editor?.chain().focus().toggleBlockquote().run(), selected?.blockquote)}
        {button("왼쪽 정렬", "왼쪽", () => editor?.chain().focus().setTextAlign("left").run(), selected?.left)}
        {button("가운데 정렬", "가운데", () => editor?.chain().focus().setTextAlign("center").run(), selected?.center)}
        {button("오른쪽 정렬", "오른쪽", () => editor?.chain().focus().setTextAlign("right").run(), selected?.right)}
        <span className="editor-divider" />
        {button("링크 넣기", "↗ 링크", () => { setLink(editor?.getAttributes("link").href ?? ""); setLinkOpen(!linkOpen); }, selected?.link)}
        {button("이미지 넣기", uploading ? "전송 중…" : "▧ 이미지", () => fileInput.current?.click(), undefined, uploading)}
        {button("표 넣기", "▦ 표", () => editor?.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run(), false, selected?.table)}
        {selected?.table && <>
          {button("표 행 추가", "+ 행", () => editor?.chain().focus().addRowAfter().run())}
          {button("표 열 추가", "+ 열", () => editor?.chain().focus().addColumnAfter().run())}
          {button("표 삭제", "표 삭제", () => editor?.chain().focus().deleteTable().run())}
        </>}
        <span className="editor-divider" />
        {button("실행 취소", "↶", () => editor?.chain().focus().undo().run(), undefined, !selected?.undo)}
        {button("다시 실행", "↷", () => editor?.chain().focus().redo().run(), undefined, !selected?.redo)}
      </div>
      {linkOpen && <div className="editor-link-panel"><label htmlFor="detail-link">연결할 주소</label><input id="detail-link" type="url" value={link} placeholder="https://example.com" onChange={(event) => setLink(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addLink(); } }} /><button type="button" onClick={addLink}>적용</button><button type="button" onClick={() => { editor?.chain().focus().unsetLink().run(); setLinkOpen(false); }}>링크 삭제</button><button type="button" aria-label="링크 편집 닫기" onClick={() => setLinkOpen(false)}>×</button></div>}
      <EditorContent editor={editor} className="submission-rich-editor" />
      {!editor && <p className="editor-loading">편집기를 준비하고 있어요…</p>}
    </>}
    {preview && <div className="editor-preview"><span className="editor-preview-label">상세페이지 미리보기</span><DetailContent content={value} /></div>}
    <input type="file" ref={fileInput} className="submission-sr-only" accept="image/jpeg,image/png,image/webp" aria-label="상세페이지 이미지 파일" tabIndex={-1} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void addImage(file); }} />
    {localError && <p className="submission-alert error" role="alert">{localError}</p>}
    <div className="editor-footnote"><span>이미지 1장당 최대 8MB · JPG, PNG, WebP</span><span>이미지는 ‘이미지 넣기’로 등록해 주세요</span></div>
  </div>;
}
