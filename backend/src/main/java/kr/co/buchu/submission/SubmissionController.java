package kr.co.buchu.submission;

import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.servlet.http.HttpServletRequest;
import kr.co.buchu.security.RequestRateLimiter;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/submissions")
public class SubmissionController {
    private final SubmissionService submissions;
    private final RequestRateLimiter limits;

    public SubmissionController(SubmissionService submissions, RequestRateLimiter limits) { this.submissions = submissions; this.limits = limits; }

    @PostMapping("/drafts")
    @ResponseStatus(HttpStatus.CREATED)
    public SubmissionService.DraftResponse create(HttpServletRequest request) {
        limits.check("drafts", request.getRemoteAddr(), 30, 3_600_000);
        return submissions.createDraft();
    }

    @GetMapping("/{id}")
    public ObjectNode get(@PathVariable String id, @RequestHeader(value = "X-Submission-Token", required = false) String token) {
        return submissions.getOwned(id, token);
    }

    @PutMapping("/{id}")
    public ObjectNode save(@PathVariable String id, @RequestHeader(value = "X-Submission-Token", required = false) String token, @RequestBody SubmissionInput input) {
        return submissions.save(id, token, input);
    }

    @PostMapping("/{id}/submit")
    public ObjectNode submit(@PathVariable String id, @RequestHeader(value = "X-Submission-Token", required = false) String token) {
        return submissions.submit(id, token);
    }
}
