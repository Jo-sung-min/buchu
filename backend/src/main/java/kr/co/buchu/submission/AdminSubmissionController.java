package kr.co.buchu.submission;

import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/submissions")
public class AdminSubmissionController {
    private final SubmissionService submissions;
    public AdminSubmissionController(SubmissionService submissions) { this.submissions = submissions; }

    @GetMapping
    public SubmissionService.AdminList list(@RequestParam(defaultValue = "PENDING") String status,
                                            @RequestParam(defaultValue = "") String q,
                                            @RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "20") int size) {
        return submissions.listAdmin(status, q, page, size);
    }

    @GetMapping("/{id}")
    public ObjectNode get(@PathVariable String id) { return submissions.getAdmin(id); }

    @PostMapping("/{id}/review")
    public ObjectNode review(@PathVariable String id, @RequestBody SubmissionService.ReviewInput input, Authentication authentication) {
        return submissions.review(id, input, authentication.getName());
    }
}
