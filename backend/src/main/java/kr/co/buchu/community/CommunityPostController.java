package kr.co.buchu.community;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import kr.co.buchu.member.MemberAuthController;
import kr.co.buchu.member.MemberService;
import kr.co.buchu.security.ClientAddress;
import kr.co.buchu.security.RequestRateLimiter;
import kr.co.buchu.storage.UploadService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class CommunityPostController {
    private final CommunityPostService posts;
    private final MemberService members;
    private final RequestRateLimiter limits;
    private final UploadService uploads;

    public CommunityPostController(CommunityPostService posts, MemberService members, RequestRateLimiter limits, UploadService uploads) {
        this.posts = posts; this.members = members; this.limits = limits; this.uploads = uploads;
    }

    private MemberService.Member member(Authentication authentication) { return MemberAuthController.current(authentication, members).orElse(null); }
    private static String viewer(MemberService.Member member) { return member == null ? null : member.id(); }
    private static List<CommunityPostService.Post> seen(List<CommunityPostService.Post> items, String viewer) { return items.stream().map(post -> post.seenBy(viewer)).toList(); }

    @GetMapping("/posts")
    public CommunityPostService.PostPage list(@RequestParam(required = false) String category,
                                              @RequestParam(defaultValue = "latest") String sort,
                                              @RequestParam(required = false) String q,
                                              @RequestParam(defaultValue = "0") int page,
                                              @RequestParam(defaultValue = "20") int size,
                                              Authentication authentication) {
        CommunityPostService.PostPage result = posts.list(category, sort, q, page, size);
        return new CommunityPostService.PostPage(seen(result.items(), viewer(member(authentication))), result.total(), result.page(), result.size());
    }

    @PostMapping("/posts")
    @ResponseStatus(HttpStatus.CREATED)
    public CommunityPostService.CreatedPost create(@RequestBody CommunityPostService.PostInput input, HttpServletRequest request, Authentication authentication) {
        String address = ClientAddress.of(request);
        limits.check("community-posts", address, 5, 60_000);
        return posts.create(input, CommunityPostService.author(member(authentication), address));
    }

    /** Photo upload for a post, before the post exists: the same presigned PUT contract the submission form uses. */
    @PostMapping("/posts/uploads/presign")
    public ResponseEntity<UploadService.CommunityPresignResponse> presignImage(@Valid @RequestBody UploadService.PresignRequest input, HttpServletRequest request) {
        limits.check("community-uploads", ClientAddress.of(request), 30, 60_000);
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL, "private, no-store").body(uploads.presignCommunity(input));
    }

    @PostMapping("/posts/uploads/{uploadId}/complete")
    public ResponseEntity<UploadService.CompleteResponse> completeImage(@PathVariable String uploadId, @RequestHeader(value = "X-Upload-Token", required = false) String token) {
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL, "private, no-store").body(uploads.completeCommunity(uploadId, token));
    }

    @DeleteMapping("/posts/uploads/{uploadId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void discardImage(@PathVariable String uploadId, @RequestHeader(value = "X-Upload-Token", required = false) String token) {
        uploads.discardCommunityOwned(uploadId, token);
    }

    @GetMapping("/posts/home")
    public CommunityPostService.HomeFeed home(Authentication authentication) {
        CommunityPostService.HomeFeed feed = posts.home();
        String viewer = viewer(member(authentication));
        Map<String, List<CommunityPostService.Post>> grouped = new LinkedHashMap<>();
        feed.byCategory().forEach((category, items) -> grouped.put(category, seen(items, viewer)));
        return new CommunityPostService.HomeFeed(seen(feed.popular(), viewer), seen(feed.latest(), viewer), grouped, feed.total());
    }

    @GetMapping("/posts/{id}")
    public CommunityPostService.Post read(@PathVariable String id, Authentication authentication) { return posts.read(id).seenBy(viewer(member(authentication))); }

    @DeleteMapping("/posts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id, @RequestHeader(value = "X-Post-Token", required = false) String token, Authentication authentication) {
        posts.deleteOwned(id, token, viewer(member(authentication)));
    }

    @GetMapping("/posts/{id}/comments")
    public List<CommunityPostService.Comment> comments(@PathVariable String id, Authentication authentication) {
        String viewer = viewer(member(authentication));
        return posts.comments(id).stream().map(comment -> comment.seenBy(viewer)).toList();
    }

    @PostMapping("/posts/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public CommunityPostService.CreatedComment comment(@PathVariable String id, @RequestBody CommunityPostService.CommentInput input,
                                                       HttpServletRequest request, Authentication authentication) {
        String address = ClientAddress.of(request);
        limits.check("community-comments", address, 15, 60_000);
        return posts.comment(id, input, CommunityPostService.author(member(authentication), address));
    }

    @DeleteMapping("/comments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteComment(@PathVariable String id, @RequestHeader(value = "X-Post-Token", required = false) String token, Authentication authentication) {
        posts.deleteOwnedComment(id, token, viewer(member(authentication)));
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
