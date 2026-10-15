package kr.co.buchu.submission;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ContentPolicyTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final ContentPolicy policy = new ContentPolicy(mapper);

    @Test void acceptsRealTiptapDefaultTableAndListAttributes() throws Exception {
        var input = mapper.readTree("""
                {"type":"doc","content":[
                    {"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"참여 안내"}]},
                    {"type":"orderedList","attrs":{"start":1,"type":null},"content":[{"type":"listItem","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"가입하세요"}]}]}]},
                    {"type":"table","content":[{"type":"tableRow","content":[
                        {"type":"tableHeader","attrs":{"colspan":1,"rowspan":1,"colwidth":null,"align":null},"content":[{"type":"paragraph"}]},
                        {"type":"tableCell","attrs":{"colspan":1,"rowspan":1,"colwidth":[200],"align":"center"},"content":[{"type":"paragraph"}]}
                    ]}]}
                ]}
                """);
        var result = policy.normalize(input);
        assertThat(result.path("content").get(2).path("content").get(0).path("content").get(1).path("attrs").path("align").asText()).isEqualTo("center");
        assertThat(policy.hasContent(result)).isTrue();
    }

    @Test void limitsDepthAndBlocksExecutableAttributesAndUrlSchemes() throws Exception {
        var nested = mapper.createObjectNode().put("type", "paragraph");
        for (int i = 0; i < 30; i++) {
            var parent = mapper.createObjectNode().put("type", "blockquote");
            parent.putArray("content").add(nested); nested = parent;
        }
        var document = mapper.createObjectNode().put("type", "doc"); document.putArray("content").add(nested);
        assertThatThrownBy(() -> policy.normalize(document)).isInstanceOf(ResponseStatusException.class);
        var unknownAttribute = mapper.readTree("{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"attrs\":{\"onclick\":\"alert(1)\"}}]}");
        assertThatThrownBy(() -> policy.normalize(unknownAttribute)).isInstanceOf(ResponseStatusException.class);
        assertThat(ContentPolicy.safeUrl("javascript:alert(1)", true)).isFalse();
        assertThat(ContentPolicy.safeUrl("data:text/html,<script>", true)).isFalse();
        assertThat(ContentPolicy.safeUrl("https://trusted.example@evil.example", true)).isFalse();
        assertThat(ContentPolicy.safeUrl("https://company.example/program", false)).isTrue();
        assertThat(ContentPolicy.safeUrl("mailto:contact@company.example", true)).isTrue();
    }

    @Test void acceptsTiptapLinkTitleDefaultsAndLimitsSuppliedTitles() throws Exception {
        var input = mapper.readTree("""
                {"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"공식 안내",
                  "marks":[{"type":"link","attrs":{"href":"https://company.example/guide","target":"_blank",
                  "rel":"noopener noreferrer nofollow","class":null,"title":null}}]}]}]}
                """);
        var result = policy.normalize(input);
        assertThat(result.path("content").get(0).path("content").get(0).path("marks").get(0).path("attrs").path("href").asText())
                .isEqualTo("https://company.example/guide");
        var attrs = (com.fasterxml.jackson.databind.node.ObjectNode) input.path("content").get(0).path("content").get(0).path("marks").get(0).path("attrs");
        attrs.put("title", "자세한 참여 조건");
        assertThat(policy.normalize(input).toString()).contains("자세한 참여 조건");
        attrs.put("title", "가".repeat(301));
        assertThatThrownBy(() -> policy.normalize(input)).isInstanceOf(ResponseStatusException.class);
    }
}
