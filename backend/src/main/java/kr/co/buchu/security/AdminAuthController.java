package kr.co.buchu.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
public class AdminAuthController {
    private final String username;
    private final String encodedPassword;
    private final boolean configured;
    private final PasswordEncoder passwords;
    private final SecurityContextRepository contexts;
    private final HttpSessionCsrfTokenRepository csrf;
    private final RequestRateLimiter limits;

    public AdminAuthController(@Value("${buchu.admin.username:}") String username,
                               @Value("${buchu.admin.password:}") String password,
                               PasswordEncoder passwords, SecurityContextRepository contexts,
                               HttpSessionCsrfTokenRepository csrf, RequestRateLimiter limits) {
        this.username = username;
        this.configured = !username.isBlank() && !password.isBlank();
        this.encodedPassword = passwords.encode(configured ? password : UUID.randomUUID().toString());
        this.passwords = passwords; this.contexts = contexts; this.csrf = csrf; this.limits = limits;
    }

    @GetMapping("/api/auth/csrf")
    public Map<String, String> csrf(CsrfToken token) {
        return Map.of("token", token.getToken(), "headerName", token.getHeaderName());
    }

    @PostMapping("/api/admin/login")
    public SessionResponse login(@RequestBody LoginInput input, HttpServletRequest request, HttpServletResponse response) {
        limits.check("admin-login", request.getRemoteAddr(), 10, 60_000);
        if (!configured) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "관리자 계정이 설정되지 않았습니다. ADMIN_USERNAME과 ADMIN_PASSWORD를 설정해 주세요.");
        String suppliedUsername = input.username == null ? "" : input.username;
        String suppliedPassword = input.password == null ? "" : input.password;
        if (suppliedUsername.length() > 160 || suppliedPassword.length() > 200) throw invalidLogin();
        boolean passwordMatches = passwords.matches(suppliedPassword, encodedPassword);
        boolean usernameMatches = MessageDigest.isEqual(username.getBytes(StandardCharsets.UTF_8), suppliedUsername.getBytes(StandardCharsets.UTF_8));
        if (!passwordMatches || !usernameMatches) throw invalidLogin();
        if (request.getSession(false) != null) request.changeSessionId();
        else request.getSession(true);
        var authentication = UsernamePasswordAuthenticationToken.authenticated(username, null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context, request, response);
        csrf.saveToken(null, request, response);
        return new SessionResponse(true, username);
    }

    @GetMapping("/api/admin/session")
    public SessionResponse session(Authentication authentication) {
        boolean authenticated = authentication != null && authentication.isAuthenticated() && !(authentication instanceof AnonymousAuthenticationToken);
        return new SessionResponse(authenticated, authenticated ? authentication.getName() : null);
    }

    @PostMapping("/api/admin/logout")
    public SessionResponse logout(HttpServletRequest request, HttpServletResponse response, Authentication authentication) {
        csrf.saveToken(null, request, response);
        new SecurityContextLogoutHandler().logout(request, response, authentication);
        return new SessionResponse(false, null);
    }

    private static ResponseStatusException invalidLogin() { return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "아이디 또는 비밀번호를 확인해 주세요."); }
    public record LoginInput(String username, String password) {}
    public record SessionResponse(boolean authenticated, String username) {}
}
