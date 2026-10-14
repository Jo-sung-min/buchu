package kr.co.buchu.program;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Stream;

@Service
public class ProgramService {
    private static final Set<String> CHANNELS = Set.of("all", "blog", "sns", "video", "website");
    private static final Set<String> COSTS = Set.of("all", "free");
    private static final Set<String> SORTS = Set.of("recommended", "name");
    private final ProgramCatalog catalog;

    public ProgramService(ObjectMapper mapper,
                          @Value("${buchu.catalog-resource}") Resource resource) throws IOException {
        try (var input = resource.getInputStream()) {
            var loaded = mapper.readValue(input, ProgramCatalog.class);
            if (loaded.updatedAt() == null || loaded.programs() == null) {
                throw new IllegalStateException("프로그램 데이터의 updatedAt과 programs가 필요합니다.");
            }
            var slugs = new HashSet<String>();
            for (var program : loaded.programs()) {
                if (program.slug() == null || program.slug().isBlank() || !slugs.add(program.slug())) {
                    throw new IllegalStateException("프로그램 slug는 비어 있지 않은 고유한 값이어야 합니다.");
                }
            }
            catalog = new ProgramCatalog(loaded.updatedAt(), List.copyOf(loaded.programs()));
        }
    }

    public ProgramResponse findAll(String q, String channel, String cost, String sort) {
        String query = normalize(q);
        String selectedChannel = normalize(channel);
        String selectedCost = normalize(cost);
        String selectedSort = normalize(sort);
        if (query.length() > 120) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "검색어는 120자 이내로 입력해 주세요.");
        }
        validateChoice(selectedChannel, CHANNELS, "지원하지 않는 채널입니다.");
        validateChoice(selectedCost, COSTS, "지원하지 않는 비용 필터입니다.");
        validateChoice(selectedSort, SORTS, "지원하지 않는 정렬 방식입니다.");

        Comparator<Program> byName = Comparator.comparing(Program::name, String.CASE_INSENSITIVE_ORDER);
        Comparator<Program> ordering = "name".equals(selectedSort)
                ? byName
                : Comparator.comparing(Program::featured).reversed().thenComparing(byName);
        var items = catalog.programs().stream()
                .filter(program -> query.isEmpty() || matches(program, query))
                .filter(program -> "all".equals(selectedChannel) || program.channels().contains(selectedChannel))
                .filter(program -> "all".equals(selectedCost) || selectedCost.equals(program.cost()))
                .sorted(ordering)
                .toList();
        return new ProgramResponse(items, items.size(), catalog.updatedAt());
    }

    public Program findBySlug(String slug) {
        return catalog.programs().stream()
                .filter(program -> program.slug().equals(slug))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "프로그램을 찾을 수 없습니다."));
    }

    private static boolean matches(Program program, String query) {
        return Stream.concat(
                        Stream.of(program.name(), program.tagline(), program.description()),
                        program.tags().stream())
                .anyMatch(value -> value != null && normalize(value).contains(query));
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private static void validateChoice(String value, Set<String> allowed, String message) {
        if (!allowed.contains(value)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
    }
}
