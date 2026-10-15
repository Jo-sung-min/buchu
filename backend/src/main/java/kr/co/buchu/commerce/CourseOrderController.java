package kr.co.buchu.commerce;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import kr.co.buchu.course.CourseModels.LessonContent;
import kr.co.buchu.course.CourseModels.Course;
import kr.co.buchu.security.RequestRateLimiter;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class CourseOrderController {
    private final CourseOrderService orders;
    private final RequestRateLimiter limits;
    public CourseOrderController(CourseOrderService orders, RequestRateLimiter limits) { this.orders = orders; this.limits = limits; }

    @ModelAttribute
    void privateResponses(HttpServletResponse response) { response.setHeader("Cache-Control", "no-store"); }

    @GetMapping("/payments/config")
    public CourseOrderService.PaymentConfig config() { return orders.config(); }

    @PostMapping("/course-orders")
    @ResponseStatus(HttpStatus.CREATED)
    public CourseOrderService.CreatedOrder create(@RequestBody CourseOrderService.CreateInput input, HttpServletRequest request) {
        limits.check("course-orders", request.getRemoteAddr(), 10, 60_000);
        return orders.create(input);
    }

    @GetMapping("/course-orders/{id}")
    public CourseOrderService.CourseOrder get(@PathVariable String id, @RequestHeader(value = "X-Order-Token", required = false) String token) {
        return orders.get(id, token);
    }

    @PostMapping("/course-orders/{id}/confirm")
    public CourseOrderService.CourseOrder confirm(@PathVariable String id, @RequestHeader(value = "X-Order-Token", required = false) String token,
                                                  @RequestBody CourseOrderService.ConfirmInput input, HttpServletRequest request) {
        limits.check("course-confirm", request.getRemoteAddr(), 20, 60_000);
        return orders.confirm(id, token, input);
    }

    @GetMapping("/course-orders/{id}/course")
    public Course course(@PathVariable String id, @RequestHeader(value = "X-Order-Token", required = false) String token) {
        return orders.course(id, token);
    }

    @GetMapping("/course-orders/{id}/lessons/{lessonId}")
    public LessonContent lesson(@PathVariable String id, @PathVariable String lessonId,
                                @RequestHeader(value = "X-Order-Token", required = false) String token) {
        return orders.lesson(id, token, lessonId);
    }

    @PostMapping("/course-orders/{id}/lessons/{lessonId}/progress")
    public CourseOrderService.CourseOrder progress(@PathVariable String id, @PathVariable String lessonId,
                                                   @RequestHeader(value = "X-Order-Token", required = false) String token,
                                                   @RequestBody CourseOrderService.ProgressInput input, HttpServletRequest request) {
        limits.check("course-progress", request.getRemoteAddr(), 120, 60_000);
        return orders.progress(id, token, lessonId, input);
    }

    @GetMapping("/admin/course-orders")
    public CourseOrderService.OrderPage adminList(@RequestParam(defaultValue = "0") int page,
                                                  @RequestParam(defaultValue = "20") int size,
                                                  @RequestParam(required = false) String status) {
        return orders.adminList(page, size, status);
    }

    @PostMapping("/admin/course-orders/{id}/cancel")
    public CourseOrderService.CourseOrder cancel(@PathVariable String id, @RequestBody CourseOrderService.CancelInput input) {
        return orders.cancel(id, input);
    }
}
