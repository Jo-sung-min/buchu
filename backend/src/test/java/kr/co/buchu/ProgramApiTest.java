package kr.co.buchu;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "buchu.catalog-resource=classpath:programs-test.json")
@AutoConfigureMockMvc
class ProgramApiTest {
    @Autowired
    private MockMvc mvc;

    @Test
    void listsFeaturedProgramsFirstAndIncludesCatalogDate() throws Exception {
        mvc.perform(get("/api/programs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.items", hasSize(3)))
                .andExpect(jsonPath("$.items[0].slug").value("featured-program"))
                .andExpect(jsonPath("$.updatedAt").value("2026-10-14"));
    }

    @Test
    void combinesSearchChannelAndCostFilters() throws Exception {
        mvc.perform(get("/api/programs")
                        .param("q", "  쇼핑  ").param("channel", "blog").param("cost", "free"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].slug").value("featured-program"));
    }

    @Test
    void searchesTagsWithoutCaseSensitivity() throws Exception {
        mvc.perform(get("/api/programs").param("q", "NEWSLETTER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].slug").value("alpha-program"));
    }

    @Test
    void supportsNameSortAndEmptySearchResults() throws Exception {
        mvc.perform(get("/api/programs").param("sort", "name"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].slug").value("alpha-program"));
        mvc.perform(get("/api/programs").param("q", "없는프로그램"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0))
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    void returnsProgramDetailsAndJsonNotFound() throws Exception {
        mvc.perform(get("/api/programs/featured-program"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("쿠팡 테스트"))
                .andExpect(jsonPath("$.steps[0]").value("공식 사이트에서 가입"))
                .andExpect(jsonPath("$.cautions[0]").value("수익은 보장되지 않습니다."));
        mvc.perform(get("/api/programs/unknown-program"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("프로그램을 찾을 수 없습니다."));
    }

    @Test
    void rejectsInvalidFiltersAndOverlongSearchTerms() throws Exception {
        for (String filter : new String[]{"channel", "cost", "sort"}) {
            mvc.perform(get("/api/programs").param(filter, "invalid"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value(400))
                    .andExpect(jsonPath("$.message").isString());
        }
        mvc.perform(get("/api/programs").param("q", "가".repeat(121)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void reportsServiceHealth() throws Exception {
        mvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"))
                .andExpect(jsonPath("$.service").value("buchu-api"));
    }
}
