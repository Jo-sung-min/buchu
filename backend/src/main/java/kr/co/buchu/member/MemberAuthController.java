package kr.co.buchu.member;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import kr.co.buchu.security.ClientAddress;
import kr.co.buchu.security.RequestRateLimiter;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

/** Member sessions sit beside the single admin session: same cookie, a ROLE_MEMBER authority whose name is the member id. */
@RestController
@RequestMapping("/api/auth")
public class MemberAuthController {
    public static final String ROLE = "ROLE_MEMBER";
    private final MemberService members;
    private final SecurityContextRepository contexts;
    private final HttpSessionCsrfTokenRepository csrf;
    private final RequestRateLimiter limits;

    public MemberAuthController(MemberService members, SecurityContextRepository contexts, HttpSessionCsrfTokenRepository csrf, RequestRateLimiter limits) {
        this.members = members; this.contexts = contexts; this.csrf = csrf; this.limits = limits;
    }

    /** The signed-in member for this request, if any. Admin sessions are not members. */
    public static Optional<MemberService.Member> current(Authentication authentication, MemberService members) {
        if (authentication == null || !authentication.isAuthenticated()) return Optional.empty();
        boolean member = authentication.getAuthorities().stream().anyMatch(authority -> ROLE.equals(authority.getAuthority()));
        return member ? members.find(authentication.getName()) : Optional.empty();
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public SessionResponse register(@RequestBody MemberService.RegisterInput input, HttpServletRequest request, HttpServletResponse response) {
        limits.check("member-register", ClientAddress.of(request), 5, 600_000);
        MemberService.Member member = members.register(input);
        start(member, request, response);
        return SessionResponse.of(member);
    }

    @PostMapping("/login")
    public SessionResponse login(@RequestBody LoginInput input, HttpServletRequest request, HttpServletResponse response) {
        limits.check("member-login", ClientAddress.of(request), 10, 60_000);
        MemberService.Member member = members.authenticate(input.username(), input.password())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "아이디 또는 비밀번호를 확인해 주세요."));
        start(member, request, response);
        return SessionResponse.of(member);
    }

    @GetMapping("/me")
    public SessionResponse me(Authentication authentication) {
        return current(authentication, members).map(SessionResponse::of).orElse(new SessionResponse(false, null));
    }

    @PostMapping("/logout")
    public SessionResponse logout(HttpServletRequest request, HttpServletResponse response, Authentication authentication) {
        csrf.saveToken(null, request, response);
        new SecurityContextLogoutHandler().logout(request, response, authentication);
        return new SessionResponse(false, null);
    }

    private void start(MemberService.Member member, HttpServletRequest request, HttpServletResponse response) {
        if (request.getSession(false) != null) request.changeSessionId();
        else request.getSession(true);
        var authentication = UsernamePasswordAuthenticationToken.authenticated(member.id(), null, List.of(new SimpleGrantedAuthority(ROLE)));
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context, request, response);
        csrf.saveToken(null, request, response);
    }

    public record LoginInput(String username, String password) {}
    public record SessionResponse(boolean authenticated, MemberService.Member member) {
        static SessionResponse of(MemberService.Member member) { return new SessionResponse(true, member); }
    }
}
