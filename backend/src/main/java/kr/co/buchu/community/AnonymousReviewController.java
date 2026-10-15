package kr.co.buchu.community;

import jakarta.servlet.http.HttpServletRequest;
import kr.co.buchu.security.RequestRateLimiter;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class AnonymousReviewController {
    private final AnonymousReviewService reviews;
    private final RequestRateLimiter limits;

    public AnonymousReviewController(AnonymousReviewService reviews, RequestRateLimiter limits) {
        this.reviews = reviews; this.limits = limits;
    }

    @GetMapping("/reviews")
    public AnonymousReviewService.ReviewPage list(@RequestParam(required = false) String programSlug,
                                                 @RequestParam(defaultValue = "latest") String sort,
                                                 @RequestParam(defaultValue = "0") int page,
                                                 @RequestParam(defaultValue = "10") int size) {
        return reviews.list(programSlug, sort, page, size, false);
    }

    @GetMapping("/reviews/summary")
    public AnonymousReviewService.Summary summary() { return reviews.summary(); }

    @PostMapping("/programs/{slug}/reviews")
    @ResponseStatus(HttpStatus.CREATED)
    public AnonymousReviewService.CreatedReview create(@PathVariable String slug,
                                                        @RequestBody AnonymousReviewService.ReviewInput input,
                                                        HttpServletRequest request) {
        limits.check("anonymous-reviews", request.getRemoteAddr(), 5, 60_000);
        return reviews.create(slug, input);
    }

    @DeleteMapping("/reviews/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id, @RequestHeader(value = "X-Review-Token", required = false) String token) {
        reviews.deleteOwned(id, token);
    }

    @GetMapping("/admin/reviews")
    public AnonymousReviewService.ReviewPage adminList(@RequestParam(required = false) String programSlug,
                                                      @RequestParam(defaultValue = "latest") String sort,
                                                      @RequestParam(defaultValue = "0") int page,
                                                      @RequestParam(defaultValue = "10") int size) {
        return reviews.list(programSlug, sort, page, size, true);
    }

    @DeleteMapping("/admin/reviews/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void adminDelete(@PathVariable String id) { reviews.deleteAdmin(id); }
}
