package kr.co.buchu.ads;

import jakarta.servlet.http.HttpServletRequest;
import kr.co.buchu.security.RequestRateLimiter;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class AdvertisementController {
    private final AdvertisementService ads;
    private final RequestRateLimiter limits;

    public AdvertisementController(AdvertisementService ads, RequestRateLimiter limits) { this.ads = ads; this.limits = limits; }

    @GetMapping("/ads")
    public AdvertisementService.Board board() { return ads.board(); }

    @PostMapping("/ads/apply")
    @ResponseStatus(HttpStatus.CREATED)
    public AdvertisementService.Advertisement apply(@RequestBody AdvertisementService.ApplyInput input, HttpServletRequest request) {
        limits.check("ad-applications", request.getRemoteAddr(), 3, 600_000);
        return ads.apply(input);
    }

    @GetMapping("/admin/ads")
    public AdvertisementService.AdminPage adminList(@RequestParam(defaultValue = "ALL") String status,
                                                    @RequestParam(defaultValue = "0") int page,
                                                    @RequestParam(defaultValue = "20") int size) {
        return ads.adminList(status, page, size);
    }

    @PostMapping("/admin/ads/{id}/approve")
    public AdvertisementService.Advertisement approve(@PathVariable String id, @RequestBody(required = false) AdvertisementService.DecisionInput input) {
        return ads.approve(id, input == null ? null : input.months(), input == null ? null : input.note());
    }

    @PostMapping("/admin/ads/{id}/reject")
    public AdvertisementService.Advertisement reject(@PathVariable String id, @RequestBody AdvertisementService.DecisionInput input) {
        return ads.reject(id, input.note());
    }

    @PostMapping("/admin/ads/{id}/end")
    public AdvertisementService.Advertisement end(@PathVariable String id) { return ads.end(id); }
}
