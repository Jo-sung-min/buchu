package kr.co.buchu.security;

import com.fasterxml.jackson.core.StreamReadConstraints;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.DispatcherType;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;

import java.util.Map;

@Configuration
public class SecurityConfig {
    @Bean SecurityContextRepository securityContextRepository() { return new HttpSessionSecurityContextRepository(); }
    @Bean HttpSessionCsrfTokenRepository csrfTokenRepository() { return new HttpSessionCsrfTokenRepository(); }
    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }
    // Disable Boot's generated default account. The single administrator is configured explicitly via environment.
    @Bean UserDetailsService userDetailsService() { return name -> { throw new UsernameNotFoundException("Unknown user"); }; }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, SecurityContextRepository contexts,
                                            HttpSessionCsrfTokenRepository csrf, ObjectMapper mapper) throws Exception {
        http.securityContext(context -> context.securityContextRepository(contexts))
                .csrf(config -> config.csrfTokenRepository(csrf)
                        .ignoringRequestMatchers(request -> ("PUT".equals(request.getMethod()) && request.getServletPath().startsWith("/api/uploads/local/"))
                                || ("POST".equals(request.getMethod()) && "/api/payments/webhook".equals(request.getServletPath()))))
                .authorizeHttpRequests(authorize -> authorize
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/admin/login").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/admin/session").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .anyRequest().permitAll())
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, exception) -> {
                            response.setStatus(401); response.setContentType("application/json;charset=UTF-8");
                            mapper.writeValue(response.getWriter(), Map.of("status", 401, "message", "관리자 로그인이 필요합니다."));
                        })
                        .accessDeniedHandler((request, response, exception) -> {
                            response.setStatus(403); response.setContentType("application/json;charset=UTF-8");
                            mapper.writeValue(response.getWriter(), Map.of("status", 403, "message", "요청을 확인할 수 없습니다. 새로고침 후 다시 시도해 주세요."));
                        }))
                .requestCache(cache -> cache.disable())
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable())
                .logout(logout -> logout.disable());
        return http.build();
    }

    @Bean Jackson2ObjectMapperBuilderCustomizer boundedJson() {
        return builder -> builder.postConfigurer(mapper -> mapper.getFactory().setStreamReadConstraints(
                StreamReadConstraints.builder().maxNestingDepth(40).maxStringLength(400_000).maxDocumentLength(1_000_000).build()));
    }
}
