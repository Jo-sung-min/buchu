package kr.co.buchu.submission;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.util.HashSet;
import java.util.Set;
import java.util.function.Function;

/** Stores a small, explicit Tiptap document schema. HTML, CSS and remote image URLs are never trusted. */
@Component
public class ContentPolicy {
    private static final Set<String> NODES = Set.of("doc", "paragraph", "heading", "bulletList", "orderedList", "listItem",
            "blockquote", "hardBreak", "horizontalRule", "image", "table", "tableRow", "tableHeader", "tableCell", "codeBlock", "text");
    private static final Set<String> MARKS = Set.of("bold", "italic", "strike", "underline", "code", "link", "textStyle", "highlight");
    private final ObjectMapper mapper;

    public ContentPolicy(ObjectMapper mapper) { this.mapper = mapper; }

    public JsonNode normalize(JsonNode content) {
        if (content == null || content.isNull()) return empty();
        if (content.toString().length() > 400_000) throw invalid("상세 설명은 400KB 이내로 작성해 주세요.");
        if (!"doc".equals(content.path("type").asText())) throw invalid("상세 설명 문서 형식이 올바르지 않습니다.");
        return cleanNode(content, 0, new int[]{0, 0});
    }

    public ObjectNode empty() { return mapper.createObjectNode().put("type", "doc").set("content", mapper.createArrayNode()); }

    private ObjectNode cleanNode(JsonNode node, int depth, int[] budget) {
        if (depth > 24 || ++budget[0] > 3000 || !node.isObject()) throw invalid("상세 설명 구조가 너무 복잡합니다.");
        fields(node, Set.of("type", "attrs", "content", "marks", "text"));
        String type = node.path("type").asText();
        if (!NODES.contains(type) || (depth > 0 && type.equals("doc"))) throw invalid("지원하지 않는 상세 설명 요소입니다.");
        ObjectNode result = mapper.createObjectNode().put("type", type);
        if (type.equals("text")) {
            if (!node.path("text").isTextual() || node.has("content") || node.has("attrs")) throw invalid("텍스트 요소 형식이 올바르지 않습니다.");
            String text = node.path("text").textValue();
            budget[1] += text.length();
            if (budget[1] > 100_000) throw invalid("상세 설명은 10만 자 이내로 작성해 주세요.");
            if (text.isEmpty()) throw invalid("빈 텍스트 요소는 사용할 수 없습니다.");
            result.put("text", text);
        } else if (node.has("text")) throw invalid("올바르지 않은 텍스트 요소입니다.");
        JsonNode attrs = node.get("attrs");
        if (attrs != null && !attrs.isNull()) {
            if (!attrs.isObject()) throw invalid("상세 설명 속성 형식이 올바르지 않습니다.");
            ObjectNode clean = mapper.createObjectNode();
            switch (type) {
                case "paragraph", "heading" -> {
                    fields(attrs, type.equals("heading") ? Set.of("level", "textAlign") : Set.of("textAlign"));
                    if (type.equals("heading")) clean.put("level", integer(attrs, "level", 1, 1, 3));
                    if (attrs.hasNonNull("textAlign")) {
                        String align = string(attrs, "textAlign", 10);
                        if (!Set.of("left", "center", "right", "justify").contains(align)) throw invalid("지원하지 않는 정렬입니다.");
                        clean.put("textAlign", align);
                    }
                }
                case "image" -> {
                    fields(attrs, Set.of("uploadId", "src", "alt", "title", "width", "height"));
                    String uploadId = string(attrs, "uploadId", 36);
                    if (!uploadId.matches("[a-fA-F0-9-]{36}")) throw invalid("먼저 이미지를 업로드해 주세요.");
                    clean.put("uploadId", uploadId);
                    clean.put("alt", string(attrs, "alt", 300));
                    clean.put("title", string(attrs, "title", 300));
                    if (attrs.hasNonNull("width")) clean.put("width", integer(attrs, "width", 800, 40, 2000));
                    if (attrs.hasNonNull("height")) clean.put("height", integer(attrs, "height", 600, 40, 10000));
                    // src is ignored: only the server resolves owned, completed upload IDs to media URLs.
                }
                case "orderedList" -> {
                    fields(attrs, Set.of("start", "type"));
                    clean.put("start", integer(attrs, "start", 1, 1, 10000));
                    if (attrs.hasNonNull("type")) {
                        String numbering = string(attrs, "type", 1);
                        if (!Set.of("1", "a", "A", "i", "I").contains(numbering)) throw invalid("지원하지 않는 목록 번호 형식입니다.");
                        clean.put("type", numbering);
                    }
                }
                case "tableCell", "tableHeader" -> {
                    fields(attrs, Set.of("colspan", "rowspan", "colwidth", "align"));
                    clean.put("colspan", integer(attrs, "colspan", 1, 1, 12));
                    clean.put("rowspan", integer(attrs, "rowspan", 1, 1, 100));
                    if (attrs.hasNonNull("align")) {
                        String align = string(attrs, "align", 10);
                        if (!Set.of("left", "center", "right", "justify").contains(align)) throw invalid("지원하지 않는 표 정렬입니다.");
                        clean.put("align", align);
                    }
                    if (attrs.hasNonNull("colwidth")) {
                        JsonNode widths = attrs.get("colwidth");
                        if (!widths.isArray() || widths.size() > 12) throw invalid("표 너비가 올바르지 않습니다.");
                        for (JsonNode width : widths) if (!width.isIntegralNumber() || width.asInt() < 20 || width.asInt() > 2000) throw invalid("표 너비가 올바르지 않습니다.");
                        clean.set("colwidth", widths.deepCopy());
                    }
                }
                case "codeBlock" -> { fields(attrs, Set.of("language")); clean.put("language", string(attrs, "language", 40)); }
                default -> fields(attrs, Set.of());
            }
            if (!clean.isEmpty()) result.set("attrs", clean);
        }
        if (type.equals("image") && !result.has("attrs")) throw invalid("이미지 업로드 정보가 필요합니다.");
        if (type.equals("heading") && !result.has("attrs")) result.set("attrs", mapper.createObjectNode().put("level", 2));
        if (node.has("content")) {
            if (Set.of("text", "image", "hardBreak", "horizontalRule").contains(type) || !node.get("content").isArray()) throw invalid("상세 설명 요소의 내용이 올바르지 않습니다.");
            ArrayNode children = mapper.createArrayNode();
            for (JsonNode child : node.get("content")) {
                String childType = child.path("type").asText();
                if (!allowsChild(type, childType)) throw invalid("상세 설명의 요소 배치가 올바르지 않습니다.");
                children.add(cleanNode(child, depth + 1, budget));
            }
            result.set("content", children);
        }
        if (node.has("marks")) {
            if (!Set.of("text", "hardBreak").contains(type) || !node.get("marks").isArray() || node.get("marks").size() > 8) throw invalid("글자 서식이 올바르지 않습니다.");
            ArrayNode marks = mapper.createArrayNode();
            Set<String> seen = new HashSet<>();
            for (JsonNode mark : node.get("marks")) {
                fields(mark, Set.of("type", "attrs"));
                String markType = mark.path("type").asText();
                if (!MARKS.contains(markType) || !seen.add(markType)) throw invalid("지원하지 않는 글자 서식입니다.");
                ObjectNode cleaned = mapper.createObjectNode().put("type", markType);
                JsonNode a = mark.path("attrs");
                ObjectNode clean = mapper.createObjectNode();
                if (markType.equals("link")) {
                    fields(a, Set.of("href", "target", "rel", "class", "title"));
                    String href = string(a, "href", 2000);
                    if (!safeUrl(href, true)) throw invalid("링크는 http, https 또는 이메일 주소만 사용할 수 있습니다.");
                    clean.put("href", href).put("target", "_blank").put("rel", "noopener noreferrer nofollow");
                    if (a.hasNonNull("title")) clean.put("title", string(a, "title", 300));
                } else if (markType.equals("textStyle") || markType.equals("highlight")) {
                    fields(a, Set.of("color"));
                    if (a.hasNonNull("color")) {
                        String color = string(a, "color", 9);
                        if (!color.matches("#[a-fA-F0-9]{3}([a-fA-F0-9]{3})?")) throw invalid("글자 색상은 16진수 색상으로 지정해 주세요.");
                        clean.put("color", color);
                    }
                } else if (!a.isMissingNode() && !a.isNull()) fields(a, Set.of());
                if (!clean.isEmpty()) cleaned.set("attrs", clean);
                marks.add(cleaned);
            }
            result.set("marks", marks);
        }
        return result;
    }

    private static boolean allowsChild(String parent, String child) {
        return switch (parent) {
            case "paragraph", "heading" -> Set.of("text", "hardBreak").contains(child);
            case "codeBlock" -> child.equals("text");
            case "bulletList", "orderedList" -> child.equals("listItem");
            case "table" -> child.equals("tableRow");
            case "tableRow" -> Set.of("tableCell", "tableHeader").contains(child);
            default -> Set.of("paragraph", "heading", "bulletList", "orderedList", "blockquote", "horizontalRule", "image", "table", "codeBlock").contains(child);
        };
    }

    public Set<String> uploadIds(JsonNode content) {
        Set<String> ids = new HashSet<>();
        visitImages(content, id -> { ids.add(id); return null; });
        if (ids.size() > 20) throw invalid("상세 설명 이미지는 20개까지 등록할 수 있습니다.");
        return ids;
    }

    public JsonNode withImageUrls(JsonNode content, Function<String, String> resolve) {
        JsonNode copy = content.deepCopy();
        visitImages(copy, resolve);
        return copy;
    }

    private void visitImages(JsonNode node, Function<String, String> resolve) {
        if (node.path("type").asText().equals("image")) {
            String url = resolve.apply(node.path("attrs").path("uploadId").asText());
            if (url != null) ((ObjectNode) node.get("attrs")).put("src", url);
        }
        if (node.path("content").isArray()) node.path("content").forEach(child -> visitImages(child, resolve));
    }

    public boolean hasContent(JsonNode node) {
        if (node.path("type").asText().equals("image") || !node.path("text").asText().isBlank()) return true;
        for (JsonNode child : node.path("content")) if (hasContent(child)) return true;
        return false;
    }

    public static boolean safeUrl(String value, boolean allowMail) {
        try {
            if (value.chars().anyMatch(c -> c <= 32 || c == 127)) return false;
            URI uri = URI.create(value);
            String scheme = uri.getScheme();
            if (allowMail && "mailto".equalsIgnoreCase(scheme)) return value.matches("mailto:[^\\s<>@]+@[^\\s<>@]+\\.[^\\s<>@]+");
            return ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))
                    && uri.getHost() != null && uri.getUserInfo() == null;
        } catch (IllegalArgumentException e) { return false; }
    }

    private static String string(JsonNode node, String key, int limit) {
        if (!node.hasNonNull(key)) return "";
        if (!node.get(key).isTextual() || node.get(key).textValue().length() > limit) throw invalid("상세 설명 속성이 너무 길거나 올바르지 않습니다.");
        return node.get(key).textValue();
    }

    private static int integer(JsonNode node, String key, int fallback, int min, int max) {
        if (!node.hasNonNull(key)) return fallback;
        if (!node.get(key).isIntegralNumber() || node.get(key).asInt() < min || node.get(key).asInt() > max) throw invalid("상세 설명 숫자 속성이 올바르지 않습니다.");
        return node.get(key).asInt();
    }

    private static void fields(JsonNode node, Set<String> allowed) {
        if (node.isMissingNode() || node.isNull()) return;
        if (!node.isObject()) throw invalid("상세 설명 형식이 올바르지 않습니다.");
        node.fieldNames().forEachRemaining(key -> { if (!allowed.contains(key)) throw invalid("지원하지 않는 상세 설명 속성입니다: " + key); });
    }

    private static ResponseStatusException invalid(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
}
