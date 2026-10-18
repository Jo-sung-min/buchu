package kr.co.buchu.community;

import jakarta.servlet.http.HttpServletRequest;
import kr.co.buchu.security.RequestRateLimiter;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class CommunityPostController {
    private final CommunityPostService posts;
    private final RequestRateLimiter limits;

    public CommunityPostController(CommunityPostService posts, RequestRateLimiter limits) {
        this.posts = posts; this.limits = limits;
    }

    @GetMapping("/posts")
    public CommunityPostService.PostPage list(@RequestParam(required = false) String category,
                                              @RequestParam(defaultValue = "latest") String sort,
                                              @RequestParam(required = false) String q,
                                              @RequestParam(defaultValue = "0") int page,
                                              @RequestParam(defaultValue = "20") int size) {
        return posts.list(category, sort, q, page, size);
    }

    @PostMapping("/posts")
    @ResponseStatus(HttpStatus.CREATED)
    public CommunityPostService.CreatedPost create(@RequestBody CommunityPostService.PostInput input, HttpServletRequest request) {
        limits.check("community-posts", request.getRemoteAddr(), 5, 60_000);
        return posts.create(input);
    }

    @GetMapping("/posts/{id}")
    public CommunityPostService.Post read(@PathVariable String id) { return posts.read(id); }

    @DeleteMapping("/posts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id, @RequestHeader(value = "X-Post-Token", required = false) String token) {
        posts.deleteOwned(id, token);
    }

    @GetMapping("/posts/{id}/comments")
    public List<CommunityPostService.Comment> comments(@PathVariable String id) { return posts.comments(id); }

    @PostMapping("/posts/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public CommunityPostService.CreatedComment comment(@PathVariable String id, @RequestBody CommunityPostService.CommentInput input,
                                                       HttpServletRequest request) {
        limits.check("community-comments", request.getRemoteAddr(), 15, 60_000);
        return posts.comment(id, input);
    }

    @DeleteMapping("/comments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteComment(@PathVariable String id, @RequestHeader(value = "X-Post-Token", required = false) String token) {
        posts.deleteOwnedComment(id, token);
    }

    @GetMapping("/admin/posts")
    public CommunityPostService.PostPage adminList(@RequestParam(required = false) String category,
                                                   @RequestParam(defaultValue = "latest") String sort,
                                                   @RequestParam(required = false) String q,
                                                   @RequestParam(defaultValue = "0") int page,
                                                   @RequestParam(defaultValue = "20") int size) {
        return posts.list(category, sort, q, page, size);
    }

    @DeleteMapping("/admin/posts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void adminDelete(@PathVariable String id) { posts.deleteAdmin(id); }

    @DeleteMapping("/admin/comments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void adminDeleteComment(@PathVariable String id) { posts.deleteAdminComment(id); }
}
